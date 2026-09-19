import { reactive } from 'vue'
import { ApiNetworkError, BusinessError, HttpError, RequestCancelledError } from '@/shared/api'
import i18n from '@/i18n'
import { message } from '@/shared/discrete'
import { abortUpload, completeUpload, initUpload, putChunk, verifyUpload } from './api'
import {
  CHUNK_CONCURRENCY,
  MAX_CHUNK_ATTEMPTS,
  MAX_TOTAL_CHUNKS,
  MAX_VERIFY_ROUNDS,
  RETRY_BASE_DELAY_MS,
  TARGET_CHUNK_SIZE,
} from './constants'
import { hashChunkSha256, hashFileSha256 } from './sha256'
import type { BizCode, StoredFileRef } from './types'

/**
 * 分片上传任务(状态机 + 并发队列)。
 *
 * 契约见 docs/文件传输接口总览.md §3。任务对象不依赖任何组件实例,
 * 页面卸载、路由切换都不影响它继续跑;进度由全局上传面板消费。
 */

/**
 * 后端 400 错误没有机器可读的子码,只能按文案判别。字符串出处:
 * FileStorageServiceImpl.saveChunk / complete。改动后端文案会让这里失配,
 * 届时未识别的 400 一律按致命处理(不会盲重试),只是少了自愈能力。
 */
const MSG_CHUNK_DIGEST_MISMATCH = '分片校验失败'
const MSG_CHUNK_SIZE_MISMATCH = '分片大小不符'

/** 会话丢失后重建的最大轮次 */
const MAX_REINIT_ROUNDS = 2

export type UploadStatus =
  | 'idle'
  | 'hashing'
  | 'initializing'
  | 'uploading'
  | 'paused'
  | 'merging'
  | 'done'
  | 'failed'
  | 'cancelled'

/** 任务的响应式状态。全部字段都供上传面板直接绑定 */
export interface UploadTaskState {
  status: UploadStatus
  /** 0–100,可直接绑 NProgress */
  percentage: number
  /** 已发送字节(已完成分片 + 在途分片已发送部分) */
  uploadedBytes: number
  /** 服务端权威分片大小;init 之前为 0 */
  chunkSize: number
  totalChunks: number
  /** 已完成的分片数(含续传时服务端已有而跳过的) */
  doneChunks: number
  /** 瞬时速度 B/s(1 秒采样滑动窗口) */
  speed: number
  /** 预计剩余秒数;无法估算时为 null */
  etaSeconds: number | null
  /** 秒传命中:未传任何字节即完成 */
  instant: boolean
  /** 当前阶段说明(i18n 已翻译),如「分片上传失败,正在重试(2/4)」 */
  note: string | null
  /** 终态失败原因;成功/进行中为 null */
  error: Error | null
  /** complete 成功后的产物 */
  ref: StoredFileRef | null
}

/**
 * 全站共享的分片请求闸门。
 * 服务端的限流桶是按账号计数的,所以多个并发上传必须共享同一份额度,
 * 由 store 提供实现,任务只负责调用。
 */
export interface ChunkGate {
  /** 发分片前调用:必要时等待,保证窗口内请求数不超上限 */
  beforeChunk(): Promise<void>
  /** 收到 429 后调用:让所有任务一起冷却 */
  coolDown(delayMs: number): void
}

/** 一次分片上传任务 */
export interface UploadTask {
  /** 去重键:biz + 文件名 + 大小 + 修改时间 */
  readonly id: string
  readonly biz: BizCode
  readonly fileName: string
  readonly fileSize: number
  readonly state: UploadTaskState
  /** complete 成功后 resolve;失败/取消则 reject(错误均带 reported,页面不会重复提示) */
  readonly done: Promise<StoredFileRef>
  /** 暂停:中止在途分片、保留会话与已传分片(不发 DELETE) */
  pause(): void
  /** 从暂停恢复 */
  resume(): void
  /** 取消:中止在途分片并 DELETE 会话(仅用户主动取消才调) */
  cancel(): void
  /** 失败后重试:重新 init 恢复进度后接着传,不重算文件哈希 */
  retry(): void
}

export interface CreateUploadTaskOptions {
  file: File
  biz: BizCode
  concurrency?: number
  /** 全站共享的限流闸门 */
  gate?: ChunkGate
}

/** 任务失败:消息已由引擎弹出,标记 reported 以免调用方重复提示 */
class UploadFailedError extends Error {
  readonly reported = true
  constructor(message: string) {
    super(message)
    this.name = 'UploadFailedError'
  }
}

/** 期望的分片字节数。末片是余数,由 file.size 收口 */
function chunkSizeAt(chunkSize: number, totalChunks: number, fileSize: number, index: number) {
  const last = totalChunks - 1
  return index === last ? fileSize - chunkSize * last : chunkSize
}

/** 首次上传的分片数量:按目标片大小推导,并夹在后端允许的范围内 */
function planTotalChunks(fileSize: number): number {
  const byTarget = Math.ceil(fileSize / TARGET_CHUNK_SIZE)
  return Math.max(1, Math.min(byTarget, fileSize, MAX_TOTAL_CHUNKS))
}

/** 可读的失败原因 */
function describeError(e: unknown): string {
  if (e instanceof BusinessError) return e.message
  if (e instanceof HttpError) return i18n.global.t('common.error.server', { status: e.status })
  if (e instanceof ApiNetworkError) return i18n.global.t('common.error.network')
  if (e instanceof Error && e.message) return e.message
  return i18n.global.t('file.error.unknown')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 创建一个分片上传任务并立即开始。流程:整文件哈希 → init/秒传 → 并发传分片 → complete。
 * 失败时会弹一次提示,并以带 reported 的错误拒绝 done。
 */
export function createUploadTask(options: CreateUploadTaskOptions): UploadTask {
  const { file, biz, concurrency = CHUNK_CONCURRENCY, gate } = options

  const state = reactive<UploadTaskState>({
    status: 'idle',
    percentage: 0,
    uploadedBytes: 0,
    chunkSize: 0,
    totalChunks: 0,
    doneChunks: 0,
    speed: 0,
    etaSeconds: null,
    instant: false,
    note: null,
    error: null,
    ref: null,
  })

  let uploadId: string | null = null
  /** 哈希结果与文件内容绑定,重试时可复用,不必重算 */
  let fileSha256 = ''
  /** 已完成的分片序号(含续传时服务端已有而跳过的) */
  const completed = new Set<number>()
  /** 在途分片:序号 -> 中止控制器与已发送字节 */
  const inFlight = new Map<number, { controller: AbortController; loaded: number }>()
  let pending: number[] = []

  let pauseRequested = false
  let cancelRequested = false
  /** 服务端报「已合并」,分片无需再传,直接去 complete */
  let mergeRequested = false
  /** 会话丢失,需要重新 init 后重来 */
  let reinitRequested = false
  /** run() 是否在执行中,防止重入 */
  let running = false
  let settled = false

  // done 每次重试都会换成新 promise:失败后页面拿到的旧 promise 已被 reject,
  // 若沿用同一个,「面板点重试 → 上传成功」就无人知晓,业务提交永远不会发生。
  // 对外通过 getter 暴露,保证 await task.done 拿到的总是当前这一轮。
  let resolveDone!: (ref: StoredFileRef) => void
  let rejectDone!: (e: unknown) => void
  let donePromise = createDonePromise()

  function createDonePromise(): Promise<StoredFileRef> {
    return new Promise<StoredFileRef>((resolve, reject) => {
      resolveDone = resolve
      rejectDone = reject
    })
  }

  // ---- 进度 ----

  function recomputeProgress(): void {
    if (state.chunkSize <= 0 || state.totalChunks <= 0) return
    let sent = 0
    for (const index of completed)
      sent += chunkSizeAt(state.chunkSize, state.totalChunks, file.size, index)
    for (const [index, entry] of inFlight) {
      sent += Math.min(
        entry.loaded,
        chunkSizeAt(state.chunkSize, state.totalChunks, file.size, index),
      )
    }
    state.uploadedBytes = Math.min(sent, file.size)
    state.percentage = file.size > 0 ? Math.min(100, (state.uploadedBytes / file.size) * 100) : 0
  }

  const samples: { at: number; bytes: number }[] = []
  let speedTimer: ReturnType<typeof setInterval> | undefined

  function startSpeedTicker(): void {
    if (speedTimer !== undefined) return
    speedTimer = setInterval(() => {
      const now = Date.now()
      samples.push({ at: now, bytes: state.uploadedBytes })
      // 保留 6 个采样点(约 5 秒窗口),避免瞬时抖动让速度与剩余时间乱跳
      while (samples.length > 6) samples.shift()
      const first = samples[0]
      const last = samples[samples.length - 1]
      if (!first || !last) return
      const elapsed = (last.at - first.at) / 1000
      if (elapsed <= 0) return
      const speed = (last.bytes - first.bytes) / elapsed
      state.speed = speed > 0 ? speed : 0
      const remaining = file.size - state.uploadedBytes
      state.etaSeconds = speed > 0 && remaining > 0 ? Math.ceil(remaining / speed) : null
    }, 1000)
  }

  function stopSpeedTicker(): void {
    if (speedTimer === undefined) return
    clearInterval(speedTimer)
    speedTimer = undefined
    state.speed = 0
    state.etaSeconds = null
  }

  // ---- 终态 ----

  function settleSuccess(ref: StoredFileRef): void {
    if (settled) return
    settled = true
    stopSpeedTicker()
    state.ref = ref
    state.error = null
    state.status = 'done'
    state.percentage = 100
    state.uploadedBytes = file.size
    resolveDone(ref)
  }

  function settleFailure(e: unknown): void {
    if (settled) return
    settled = true
    stopSpeedTicker()
    state.error = e instanceof Error ? e : new Error(String(e))
    state.status = 'failed'
    state.note = null
    const text = describeError(e)
    message.error(text)
    rejectDone(new UploadFailedError(text))
  }

  function settleCancelled(): void {
    if (settled) return
    settled = true
    stopSpeedTicker()
    state.status = 'cancelled'
    state.note = null
    // RequestCancelledError 自带 reported,页面不会重复提示;用户刚点了取消,也无需再弹
    rejectDone(new RequestCancelledError())
  }

  function abortInFlight(): void {
    for (const entry of inFlight.values()) entry.controller.abort()
  }

  // ---- 初始化 / 恢复 ----

  async function ensureSession(): Promise<void> {
    state.status = 'initializing'
    const res = await initUpload({
      biz,
      originalName: file.name,
      totalSize: file.size,
      totalChunks: planTotalChunks(file.size),
      sha256: fileSha256,
    })
    const session = res.data

    // ★ 必须先判 completedFile:秒传时服务端返回 chunkSize=0 / totalChunks=0,
    //   若先算进度会得到 NaN,NProgress 只会画出一条坏进度条而不会报错。
    if (session.completedFile) {
      state.instant = true
      state.uploadedBytes = file.size
      state.percentage = 100
      state.doneChunks = 1
      state.ref = session.completedFile
      return
    }

    // ★ 服务端权威粒度:续传时它忽略我们请求里的 totalChunks(磁盘 meta.json 为准)。
    //   用客户端的 TARGET_CHUNK_SIZE 切片会导致「分片大小不符」而全量重传。
    state.chunkSize = session.chunkSize
    state.totalChunks = session.totalChunks
    uploadId = session.uploadId
    if (state.chunkSize <= 0 || state.totalChunks <= 0 || !uploadId) {
      throw new BusinessError(i18n.global.t('file.error.sessionCorrupt'), 500)
    }

    const received = new Set(session.receivedChunks)
    completed.clear()
    for (const index of received) completed.add(index)
    pending = []
    for (let index = 0; index < state.totalChunks; index++) {
      if (!received.has(index)) pending.push(index)
    }
    state.doneChunks = completed.size
    recomputeProgress()
  }

  // ---- 分片上传 ----

  /** 单个分片失败的处置方式 */
  type ChunkFailure =
    | { kind: 'retry' }
    | { kind: 'reinit' }
    | { kind: 'merged' }
    | { kind: 'stopped' }
    | { kind: 'fatal'; error: Error }

  function classifyChunkError(e: unknown): ChunkFailure {
    if (e instanceof RequestCancelledError) return { kind: 'stopped' }

    if (e instanceof ApiNetworkError) return { kind: 'retry' }

    if (e instanceof HttpError) {
      // 429 可能是真实 HTTP 状态(如 nginx limit_req),也可能是业务码,两条都要认
      if (e.status === 429 || e.status >= 500) return { kind: 'retry' }
      return { kind: 'fatal', error: e }
    }

    if (e instanceof BusinessError) {
      if (e.code === 429) return { kind: 'retry' }
      if (e.code === 409) return { kind: 'merged' }
      if (e.code === 404) return { kind: 'reinit' }
      if (e.code === 400 && e.message.includes(MSG_CHUNK_DIGEST_MISMATCH)) {
        return { kind: 'retry' }
      }
      // 其余 400(含「分片大小不符」)粒度对不上,盲重试会死循环,一律致命
      if (e.code === 400 && e.message.includes(MSG_CHUNK_SIZE_MISMATCH)) {
        return {
          kind: 'fatal',
          error: new BusinessError(i18n.global.t('file.error.chunkSizeMismatch'), 400),
        }
      }
      return { kind: 'fatal', error: e }
    }

    return { kind: 'fatal', error: e instanceof Error ? e : new Error(String(e)) }
  }

  /**
   * 上传一个分片,内部处理重试。返回 false 表示 worker 应当退出
   * (暂停、取消、已合并或需要重建会话)。
   */
  async function uploadOne(index: number): Promise<boolean> {
    const controller = new AbortController()
    const entry = { controller, loaded: 0 }
    inFlight.set(index, entry)

    let attempt = 0
    try {
      for (;;) {
        if (cancelRequested || pauseRequested || mergeRequested || reinitRequested) {
          return false
        }
        attempt++

        try {
          await gate?.beforeChunk()
          if (cancelRequested || pauseRequested || mergeRequested || reinitRequested) return false

          // ★ 一律按服务端返回的 chunkSize 切片(file.size 收口末片),不要用 TARGET_CHUNK_SIZE
          const start = index * state.chunkSize
          const end =
            index === state.totalChunks - 1
              ? file.size
              : Math.min(start + state.chunkSize, file.size)
          const blob = file.slice(start, end)

          entry.loaded = 0
          const digest = await hashChunkSha256(await blob.arrayBuffer())

          await putChunk(uploadId!, index, blob, digest, {
            signal: controller.signal,
            onProgress: (loaded) => {
              entry.loaded = loaded
              recomputeProgress()
            },
          })

          inFlight.delete(index)
          completed.add(index)
          state.doneChunks = completed.size
          state.note = null
          recomputeProgress()
          return true
        } catch (e) {
          const failure = classifyChunkError(e)

          if (failure.kind === 'stopped') {
            // 暂停或取消:会话与已传分片都保留,序号由下面的 finally 放回队列
            return false
          }
          if (failure.kind === 'merged') {
            inFlight.delete(index)
            mergeRequested = true
            abortInFlight()
            return false
          }
          if (failure.kind === 'reinit') {
            inFlight.delete(index)
            reinitRequested = true
            // 在途分片一起停掉,避免重建会话时还有请求落在旧 uploadId 上
            abortInFlight()
            return false
          }
          if (failure.kind === 'fatal') {
            inFlight.delete(index)
            throw failure.error
          }

          // retry:超过尝试上限才放弃
          if (attempt >= MAX_CHUNK_ATTEMPTS) {
            inFlight.delete(index)
            throw e
          }
          const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
          const rateLimited =
            (e instanceof HttpError && e.status === 429) ||
            (e instanceof BusinessError && e.code === 429)
          if (rateLimited) {
            gate?.coolDown(delayMs)
            state.note = i18n.global.t('file.error.rateLimited')
          } else {
            state.note = i18n.global.t('file.error.chunkRetrying', {
              attempt,
              max: MAX_CHUNK_ATTEMPTS,
            })
          }
          await sleep(delayMs)
        }
      }
    } finally {
      inFlight.delete(index)
      // 暂停时若这一片没传完就放回队列,恢复后接着传。
      // 放在 finally 而不是各个 return 分支:退出路径有四五条(轮询到暂停、
      // 限流等待中被暂停、分片被 abort……),漏掉任何一条都会永久丢片,
      // 只能等 complete 失败后由 verify 兜底重传。
      if (pauseRequested && !cancelRequested && !completed.has(index)) {
        pending.unshift(index)
        recomputeProgress()
      }
    }
  }

  /** 并发跑满待传队列 */
  async function drain(): Promise<void> {
    const workerCount = Math.min(concurrency, Math.max(1, pending.length))
    const workers: Promise<void>[] = []
    for (let i = 0; i < workerCount; i++) workers.push(runWorker())
    await Promise.all(workers)
  }

  async function runWorker(): Promise<void> {
    for (;;) {
      if (cancelRequested || pauseRequested || mergeRequested || reinitRequested) return
      const index = pending.shift()
      if (index === undefined) return
      const shouldContinue = await uploadOne(index)
      if (!shouldContinue) return
    }
  }

  // ---- 合并 ----

  /**
   * 合并成品。分片不齐时用 /verify 拿缺失清单精准补传,而不是全量重来。
   * complete 与 verify 在服务端都是幂等的,超时重试安全。
   */
  async function completeWithRecovery(): Promise<void> {
    state.status = 'merging'
    state.note = null
    for (let round = 0; round <= MAX_VERIFY_ROUNDS; round++) {
      try {
        const res = await completeUpload(uploadId!)
        settleSuccess(res.data)
        return
      } catch (e) {
        // 会话丢了(如 Redis 重启):重新 init 由磁盘 meta.json 重建后重试
        if (e instanceof BusinessError && e.code === 404) {
          await ensureSession()
          if (state.ref) {
            settleSuccess(state.ref)
            return
          }
          continue
        }
        // 只对「分片不齐 / 校验失败」做补传恢复,其余直接失败
        if (!(e instanceof BusinessError) || e.code !== 400) throw e
        if (round === MAX_VERIFY_ROUNDS) throw e

        state.note = i18n.global.t('file.error.verifyRetry')
        const verified = await verifyUpload(uploadId!)
        const retryable = verified.data.retryable
        if (retryable.length === 0) throw e

        // ★ retryable 已由服务端合并 missing ∪ badDigest,直接用它,不要再自己求并集
        for (const index of retryable) {
          if (!completed.has(index)) pending.push(index)
        }
        state.status = 'uploading'
        await drain()
        if (cancelRequested) throw new RequestCancelledError()
        state.status = 'merging'
      }
    }
  }

  // ---- 主流程 ----

  async function run(): Promise<void> {
    if (running || settled) return
    running = true
    try {
      // ① 整文件哈希(重试时结果仍有效,跳过)
      if (!fileSha256) {
        state.status = 'hashing'
        state.note = null
        fileSha256 = await hashFileSha256(file, (progress) => {
          state.uploadedBytes = progress.loaded
          state.percentage =
            progress.total > 0 ? Math.min(100, (progress.loaded / progress.total) * 100) : 0
        })
      }

      // 哈希期间用户可能已经取消:此时已经 settle 过,直接收手,
      // 否则会白发一次 init 请求、凭空创建出一个上传会话
      if (cancelRequested || settled) return

      // ② init / 秒传 / 恢复进度
      if (!uploadId && !state.ref) await ensureSession()
      if (state.ref && state.instant) {
        settleSuccess(state.ref)
        return
      }

      // ③ 并发传分片;会话丢失时重建后重来
      let reinitRounds = 0
      for (;;) {
        reinitRequested = false
        state.status = 'uploading'
        startSpeedTicker()
        await drain()

        if (cancelRequested) throw new RequestCancelledError()
        if (pauseRequested) {
          state.status = 'paused'
          stopSpeedTicker()
          return
        }
        if (reinitRequested) {
          stopSpeedTicker()
          if (++reinitRounds > MAX_REINIT_ROUNDS) {
            throw new BusinessError(i18n.global.t('file.error.sessionExpired'), 404)
          }
          await ensureSession()
          if (state.ref) {
            settleSuccess(state.ref)
            return
          }
          continue
        }
        break
      }

      // ④ 合并
      stopSpeedTicker()
      if (mergeRequested) {
        // 服务端说已合并:会话可能已失效,complete 会自己按 404 重建
        state.status = 'merging'
      }
      await completeWithRecovery()
    } catch (e) {
      if (e instanceof RequestCancelledError) settleCancelled()
      else settleFailure(e)
    } finally {
      running = false
    }
  }

  // ---- 对外控制 ----

  function pause(): void {
    if (settled || pauseRequested) return
    if (state.status !== 'uploading' && state.status !== 'hashing') return
    pauseRequested = true
    abortInFlight()
  }

  function resume(): void {
    if (settled || !pauseRequested) return
    pauseRequested = false
    state.status = 'uploading'
    void run()
  }

  function cancel(): void {
    if (settled) return
    cancelRequested = true
    pauseRequested = false
    abortInFlight()
    // 仅用户主动取消才删会话与分片目录(接口文档 §3.7);失败静默 ——
    // 服务端有 7 天分片 / 24h 会话的自动清理兜底
    if (uploadId) void abortUpload(uploadId).catch(() => undefined)
    settleCancelled()
  }

  function retry(): void {
    if (state.status !== 'failed' || running) return
    state.error = null
    state.note = null
    settled = false
    // 换一个新 promise,让重新发起提交的页面能拿到这一轮的结果
    donePromise = createDonePromise()
    pauseRequested = false
    cancelRequested = false
    mergeRequested = false
    reinitRequested = false
    // 不 DELETE 会话:重新 init 会由磁盘 meta.json 重建并跳过已传分片。
    // uploadId 是确定性派生值,重新 init 拿到的还是同一个。
    uploadId = null
    void run()
  }

  void run()

  return {
    id: `${biz}:${file.name}:${file.size}:${file.lastModified}`,
    biz,
    fileName: file.name,
    fileSize: file.size,
    state,
    get done() {
      return donePromise
    },
    pause,
    resume,
    cancel,
    retry,
  }
}
