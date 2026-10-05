import { API_BASE_URL } from '@/config'
import type { VideoMeta } from '../types'

/**
 * 教学视频流式播放的 WebSocket 字节区间客户端。
 *
 * 协议见 docs/课程视频WS协议.md,但下面几条是**读了后端实现后确定的**关键约束,
 * 与文档字面描述不同,改动前务必先看后端 VideoStreamWebSocketHandler:
 *
 * 1. **跳转时先对在途 read 发 `cancel`,再换一代(generation)。** 协议 §5/§6:
 *    cancel 取消尚未发送的 read 并**归还在途名额** —— 不发的话服务端仍按 8 个在途记账,
 *    而本客户端已把 inflight 清零,两边配额就此错位,连续跳转会先撞服务端 429。
 *    (历史上后端 handleCancel 漏了从 `inflight` 移除 req,取消满 8 次即连接不可用,
 *    故本客户端曾刻意不发;该泄漏后端已修,现按协议发 cancel。)
 *    换代仍然保留 —— 旧代已发出的帧到达后直接丢弃,不必依赖 cancel 的时效。
 * 2. **不发 `ping` 之类的心跳。** 后端把任何文本帧都按 VideoCommand 解析,
 *    未知指令会回一条 400 error 帧。保活只能靠 read 流量本身。
 * 3. **握手失败的 HTTP 状态码在浏览器里读不到** —— 浏览器 WebSocket API 不暴露失败握手的
 *    状态码,401/403/404 一律只表现为 onclose(1006)。要区分「未登录/无权限/文件没了」,
 *    只能另发一次 HTTP 请求去探(见 VideoPlayerModal)。
 * 4. 在途上限服务端是 8,这里自压到 6 留余量。
 */

/** 服务端允许的单次 read 上限(1MB);压到 512KB 以平滑播放起播延迟 */
export const READ_LENGTH = 512 * 1024

/** 自限的在途 read 数,低于服务端上限 8 */
const MAX_INFLIGHT = 6

/** 429 退避:100ms → 200ms → 400ms(文档 §6) */
const RETRY_DELAYS_MS = [100, 200, 400]

/** 一个 read 请求对应的待决条目 */
interface PendingRead {
  offset: number
  length: number
  resolve: (payload: Uint8Array) => void
  reject: (error: Error) => void
  /** 已退避重试次数,超过 RETRY_DELAYS_MS 长度则放弃 */
  attempt: number
  generation: number
  timer: ReturnType<typeof setTimeout> | null
}

/** 播放失败的可分类原因,供 UI 决定文案与是否重连 */
export type VideoStreamFailure =
  | { kind: 'auth' }
  | { kind: 'forbidden' }
  | { kind: 'gone' }
  | { kind: 'overload' }
  | { kind: 'network' }
  | { kind: 'server'; message: string }

export class VideoStreamError extends Error {
  readonly failure: VideoStreamFailure
  /**
   * 该请求因跳转换代而作废。跳转是正常操作，调用方对这类失败要静默处理，
   * 不能计入「连续读取失败」的熔断计数 —— 故用显式标记而不是匹配错误文案。
   */
  readonly stale: boolean
  constructor(failure: VideoStreamFailure, message: string, stale = false) {
    super(message)
    this.name = 'VideoStreamError'
    this.failure = failure
    this.stale = stale
  }
}

/** 由 API_BASE_URL 推导 WS 基础地址(绝对地址取其 host;相对地址取当前页 origin) */
function resolveWsBaseUrl(): string {
  if (/^https?:\/\//i.test(API_BASE_URL)) {
    const url = new URL(API_BASE_URL)
    return `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`
  }
  const { protocol, host } = window.location
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`
}

/** 构造视频流连接 URL(token 走 query:浏览器原生 WebSocket 不支持自定义请求头) */
export function buildVideoWsUrl(videoId: number, token: string): string {
  return `${resolveWsBaseUrl()}/ws/video/${videoId}?token=${encodeURIComponent(token)}`
}

/**
 * 解析二进制数据帧:`[req:int32 大端][offset:int64 大端][payload]`。
 * 帧头 offset 回带的是**请求的偏移量**,不是读完的位置;请求越过文件尾时 payload 长度为 0。
 */
function decodeFrame(buf: ArrayBuffer): { req: number; offset: number; payload: Uint8Array } {
  const view = new DataView(buf)
  const req = view.getInt32(0)
  const offset = Number(view.getBigInt64(4))
  return { req, offset, payload: new Uint8Array(buf, 12) }
}

export class VideoStreamSocket {
  private ws: WebSocket | null = null
  private readonly url: string
  private nextReq = 0
  /** 当前代:跳转时自增,旧代未决的 read 直接作废 */
  private generation = 0
  private readonly pending = new Map<number, PendingRead>()
  /** 已发出但尚未收到应答的 read 数(含退避中的),用于自我限流 */
  private inflight = 0
  private readonly waiters: Array<() => void> = []
  private closed = false
  private failure: VideoStreamFailure | null = null

  constructor(videoId: number, token: string) {
    this.url = buildVideoWsUrl(videoId, token)
  }

  /** 建立连接并完成 open 握手,返回 meta(文件大小/摘要/时长) */
  connect(): Promise<VideoMeta> {
    return new Promise<VideoMeta>((resolve, reject) => {
      let settled = false
      let ws: WebSocket
      try {
        ws = new WebSocket(this.url)
      } catch {
        reject(new VideoStreamError({ kind: 'network' }, 'WebSocket 构造失败'))
        return
      }
      ws.binaryType = 'arraybuffer'
      this.ws = ws

      const fail = (failure: VideoStreamFailure, message: string) => {
        this.failure = failure
        if (!settled) {
          settled = true
          reject(new VideoStreamError(failure, message))
        }
      }

      ws.onopen = () => {
        // open 必须是第一个指令,早于任何 read
        ws.send(JSON.stringify({ action: 'open' }))
      }

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          this.handleTextFrame(event.data, (meta) => {
            if (!settled) {
              settled = true
              resolve(meta)
            }
          }, fail)
          return
        }
        this.handleBinaryFrame(event.data as ArrayBuffer)
      }

      ws.onerror = () => {
        // 失败握手的真实状态码在浏览器里拿不到,只能给出「网络类」结论;
        // 调用方应另发一次 HTTP 探测来区分未登录/无权限/文件不存在。
        fail({ kind: 'network' }, '视频连接建立失败')
      }

      ws.onclose = (event: CloseEvent) => {
        this.ws = null
        // ★ 必须置 closed:send() 在 ws 为 null 时是空操作,不置位的话后续 read()
        // 会通过上面的守卫、发不出请求、Promise 永不落地 —— 读循环就此永久挂起。
        this.closed = true
        // 1013 SERVICE_OVERLOAD = 服务端全局并发连接数已满(协议 §6),与普通断线区分开
        const pendingFailure: VideoStreamFailure =
          this.failure ?? (event.code === 1013 ? { kind: 'overload' } : { kind: 'network' })
        fail(pendingFailure, '视频连接已断开')
        // 连接断开后所有未决 read 都不可能再有应答
        for (const [, p] of this.pending) {
          if (p.timer) clearTimeout(p.timer)
          p.reject(new VideoStreamError(pendingFailure, '视频连接已断开'))
        }
        this.pending.clear()
        this.inflight = 0
        this.releaseWaiters()
      }
    })
  }

  private handleTextFrame(
    raw: string,
    onMeta: (meta: VideoMeta) => void,
    fail: (failure: VideoStreamFailure, message: string) => void,
  ): void {
    let msg: {
      type?: string
      videoId?: number
      size?: number
      sha256?: string
      durationSec?: number | null
      req?: number
      code?: number
      message?: string
    }
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (msg.type === 'meta') {
      onMeta({
        type: 'meta',
        videoId: msg.videoId ?? 0,
        size: msg.size ?? 0,
        sha256: msg.sha256 ?? '',
        durationSec: msg.durationSec ?? null,
      })
      return
    }
    if (msg.type !== 'error') return

    const code = msg.code ?? 500
    const message = msg.message ?? ''
    const req = msg.req
    // 没有 req 的 error 是连接级的(open 失败、未知指令、读取失败)
    if (req == null) {
      fail(classifyErrorCode(code, message), message || '视频流错误')
      return
    }
    const p = this.pending.get(req)
    if (!p) return
    if (code === 429) {
      this.retryAfterBackoff(req, p)
      return
    }
    this.settle(req, p, () =>
      p.reject(new VideoStreamError(classifyErrorCode(code, message), message || '读取视频失败')),
    )
  }

  private handleBinaryFrame(buf: ArrayBuffer): void {
    const { req, payload } = decodeFrame(buf)
    const p = this.pending.get(req)
    if (!p) return
    // payload 长度为 0 = 已到文件尾,属正常结束信号,交给调用方按空数组处理
    this.settle(req, p, () => p.resolve(payload))
  }

  /** 结束一个待决 read:清定时器、释放在途名额、移出表,再执行完成动作 */
  private settle(req: number, p: PendingRead, done: () => void): void {
    if (p.timer) clearTimeout(p.timer)
    this.pending.delete(req)
    this.inflight = Math.max(0, this.inflight - 1)
    this.releaseWaiters()
    done()
  }

  private retryAfterBackoff(req: number, p: PendingRead): void {
    const delay = RETRY_DELAYS_MS[p.attempt]
    if (delay == null) {
      this.settle(req, p, () =>
        p.reject(new VideoStreamError({ kind: 'overload' }, '服务器持续限流')),
      )
      return
    }
    p.attempt += 1
    p.timer = setTimeout(() => {
      p.timer = null
      // 该 read 已作废(跳转/关闭)则不再重发
      if (this.closed || p.generation !== this.generation || !this.ws) return
      this.send({ action: 'read', req, offset: p.offset, length: p.length })
    }, delay)
  }

  private releaseWaiters(): void {
    while (this.inflight < MAX_INFLIGHT && this.waiters.length > 0) {
      this.waiters.shift()?.()
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.inflight < MAX_INFLIGHT) return
    await new Promise<void>((resolve) => this.waiters.push(resolve))
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  /**
   * 读取字节区间。返回的 payload 可能短于请求长度(尾部短读,正常现象);
   * 长度为 0 表示已到文件尾。同代的读取按调用顺序发号,应答按 req 配对。
   */
  async read(offset: number, length = READ_LENGTH): Promise<Uint8Array> {
    if (this.closed) throw new VideoStreamError({ kind: 'network' }, '连接已关闭')
    await this.acquireSlot()
    if (this.closed) throw new VideoStreamError({ kind: 'network' }, '连接已关闭')

    const req = this.nextReq++
    const generation = this.generation
    return new Promise<Uint8Array>((resolve, reject) => {
      this.pending.set(req, { offset, length, resolve, reject, attempt: 0, generation, timer: null })
      this.inflight += 1
      this.send({ action: 'read', req, offset, length })
    })
  }

  /**
   * 开启新一代:跳转时调用。先按协议 §5 对在途 read 发 `cancel`(服务端据此归还在途名额),
   * 再让本代的在途 read 作废(结果被丢弃、不再重发),并重置在途计数,
   * 使新位置的读取不必排在旧读取后面。
   */
  beginGeneration(): number {
    for (const req of this.pending.keys()) {
      this.send({ action: 'cancel', req })
    }
    this.generation += 1
    for (const [req, p] of this.pending) {
      if (p.timer) clearTimeout(p.timer)
      p.reject(new VideoStreamError({ kind: 'network' }, '已跳转，请求作废', true))
      this.pending.delete(req)
    }
    this.inflight = 0
    this.releaseWaiters()
    return this.generation
  }

  /** 当前代:调用方可用它判断异步链路是否已经过期 */
  get currentGeneration(): number {
    return this.generation
  }

  get isClosed(): boolean {
    return this.closed
  }

  /** 连接失败/断开的原因(正常时 null);读循环发现连接已断时据此向 UI 报错 */
  get closeFailure(): VideoStreamFailure | null {
    return this.failure
  }

  close(): void {
    this.closed = true
    for (const p of this.pending.values()) {
      if (p.timer) clearTimeout(p.timer)
    }
    this.pending.clear()
    this.inflight = 0
    this.waiters.length = 0
    this.ws?.close()
    this.ws = null
  }
}

/** 把后端 error 帧的 code 映射为可分支的失败原因 */
function classifyErrorCode(code: number, message: string): VideoStreamFailure {
  switch (code) {
    case 401:
      return { kind: 'auth' }
    case 403:
      return { kind: 'forbidden' }
    case 404:
      return { kind: 'gone' }
    case 429:
      return { kind: 'overload' }
    default:
      return { kind: 'server', message }
  }
}
