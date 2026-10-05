import type { ISOFile, MP4BoxBuffer, Movie } from 'mp4box'
import { VideoStreamError, VideoStreamSocket } from './wsClient'
import type { VideoStreamFailure } from './wsClient'

/**
 * 教学视频播放器：WS 字节区间 + mp4box 分段 + MSE。
 *
 * 服务端是「哑的字节区间服务器」——不转码、不按时间 seek，所以时间轴到字节偏移的换算
 * 全部在这里用 mp4box 完成（文档 §3.3）。
 *
 * ── 读循环为什么由 appendBuffer 的返回值驱动 ──
 * mp4box 的 `appendBuffer` 返回「下一个期望的 fileStart」。解析器从字节 0 开始走 box 头，
 * 遇到 mdat 时只读它的头就能跳到下一个 box，所以哪怕 moov 在文件尾，
 * 我们也能顺理成章地被它指到 moov 的偏移上去，只多读了头尾两段（服务端对头/尾 512KB 有缓存）。
 * 但有个硬约束：**第一个 appendBuffer 的 fileStart 必须是 0**，
 * 否则 MultiBufferStream.initialized() 会拒绝解析 —— 所以不能先探尾部。
 *
 * ── 缓存策略（短暂、运行期、不落盘）──
 * 读循环在「播放头前方已缓冲时长」超过 MAX_BUFFER_AHEAD_SEC 时暂停，防止一边播一边无限预读；
 * 播放推进时把播放头身后超过 KEEP_BEHIND_SEC 的已缓冲区间 `sourceBuffer.remove()` 掉，
 * 并调 `iso.releaseUsedSamples()` 让 mp4box 释放对应的样本数据。
 * 这样既不占内存，又保留了「前方一段」的缓冲以扛住网络抖动。
 */

/** 播放阶段，供 UI 显示（播完由 <video> 原生控件自会呈现，无需单独状态） */
export type PlayerPhase = 'connecting' | 'buffering' | 'playing'

/** 播放头前方最多预读的时长：够扛网络抖动，又不会无限占内存 */
const MAX_BUFFER_AHEAD_SEC = 30
/** 播放头身后保留的已缓冲时长，超出的部分回收 */
const KEEP_BEHIND_SEC = 10
/** 单次分段的样本数（越小时延越低、MSE append 次数越多） */
const SAMPLES_PER_SEGMENT = 500
/** 连续读取失败多少次后放弃（首次失败也计入） */
const MAX_CONSECUTIVE_READ_FAILURES = 6

export interface PlayerCallbacks {
  onPhase: (phase: PlayerPhase) => void
  onError: (failure: VideoStreamFailure, message: string) => void
  /** 收到 open 的 meta（含服务端权威 size/sha256/durationSec） */
  onMeta: (meta: { size: number; sha256: string; durationSec: number | null }) => void
}

export class VideoPlayerSession {
  private readonly video: HTMLVideoElement
  private readonly videoId: number
  private readonly token: string
  private readonly callbacks: PlayerCallbacks

  private socket: VideoStreamSocket | null = null
  private iso: ISOFile<SourceBuffer> | null = null
  private mediaSource: MediaSource | null = null
  private objectUrl: string | null = null
  /** trackId -> SourceBuffer，以及每轨待 append 的队列（同一 SourceBuffer 只允许一个未完成的 append） */
  private readonly sourceBuffers = new Map<number, SourceBuffer>()
  private readonly appendQueues = new Map<SourceBuffer, ArrayBuffer[]>()
  private readonly appending = new Set<SourceBuffer>()
  /** 每条轨已收到的分段序号，用于 releaseUsedSamples */
  private readonly nextSample = new Map<number, number>()

  /**
   * 下一个待读的字节偏移。读循环严格顺序推进（原因见 readLoop 内的注释），
   * 所以用一个游标即可；跳转时把它重置到关键帧偏移。
   */
  private nextOffset = 0
  private reading = false
  /**
   * 读循环代次。跳转时自增，让「在飞的旧循环」在自己的 finally 里认出自己已被取代，
   * 不去清掉新循环刚设上的 reading 标志 —— 否则两个循环会并行跑，重复读同一段。
   */
  private readLoopId = 0
  private destroyed = false
  private consecutiveFailures = 0
  private durationSec: number | null = null
  private fileSize = 0
  /** 跳转目标：分段到达后把 currentTime 挪过去 */
  private pendingSeekTime: number | null = null
  /** 由本播放器赋值 currentTime 触发的 seeking 目标（见 consumeInternalSeek） */
  private internalSeekTarget: number | null = null

  constructor(video: HTMLVideoElement, videoId: number, token: string, callbacks: PlayerCallbacks) {
    this.video = video
    this.videoId = videoId
    this.token = token
    this.callbacks = callbacks
  }

  /** 建连接、装 mp4box/MSE、起读循环。抛出的错误已由调用方分类展示，这里不弹 toast。 */
  async start(): Promise<void> {
    this.callbacks.onPhase('connecting')
    const socket = new VideoStreamSocket(this.videoId, this.token)
    this.socket = socket
    const meta = await socket.connect()
    if (this.destroyed) return
    this.fileSize = meta.size
    this.durationSec = meta.durationSec
    this.callbacks.onMeta(meta)

    if (typeof MediaSource === 'undefined') {
      throw new VideoStreamError({ kind: 'server', message: 'unsupported' }, '不支持 MSE')
    }
    const mediaSource = new MediaSource()
    this.mediaSource = mediaSource
    this.objectUrl = URL.createObjectURL(mediaSource)
    this.video.src = this.objectUrl

    // 动态引入：mp4box 只有播放视频时才用得上，不进主包
    const { createFile } = await import('mp4box')
    if (this.destroyed) return

    const iso = createFile() as unknown as ISOFile<SourceBuffer>
    this.iso = iso
    iso.onReady = (info: Movie) => this.onReady(info)
    iso.onSegment = (id, sourceBuffer, buffer, nextSampleNumber) => {
      this.nextSample.set(id, nextSampleNumber)
      this.enqueueAppend(sourceBuffer, buffer)
    }
    iso.onError = (module: string, message: string) => {
      // mp4box 的解析错误通常意味着文件本身不规范，继续读下去也不会有结果
      this.fail({ kind: 'server', message: `${module}: ${message}` }, message)
    }

    // 等 MediaSource 就绪再开始读，否则第一个分段没有可 append 的 SourceBuffer
    await new Promise<void>((resolve) => {
      mediaSource.addEventListener('sourceopen', () => resolve(), { once: true })
    })
    if (this.destroyed) return

    this.callbacks.onPhase('buffering')
    void this.readLoop(0)
  }

  private onReady(info: Movie): void {
    if (this.destroyed || !this.mediaSource) return
    const tracks = info.tracks
    if (tracks.length === 0) {
      this.fail({ kind: 'server', message: 'no track' }, '视频没有可播放的轨道')
      return
    }
    const mime = buildMimeType(info)
    if (!MediaSource.isTypeSupported(mime)) {
      this.fail({ kind: 'server', message: mime }, `浏览器不支持该编码: ${mime}`)
      return
    }

    try {
      for (const track of tracks) {
        const sourceBuffer = this.mediaSource.addSourceBuffer(mime)
        sourceBuffer.mode = 'segments'
        sourceBuffer.addEventListener('updateend', () => this.flushAppendQueue(sourceBuffer))
        sourceBuffer.addEventListener('error', () => {
          this.fail({ kind: 'server', message: 'SourceBuffer error' }, '解码缓冲出错')
        })
        this.sourceBuffers.set(track.id, sourceBuffer)
        this.appendQueues.set(sourceBuffer, [])
        this.iso?.setSegmentOptions(track.id, sourceBuffer, { nbSamples: SAMPLES_PER_SEGMENT })
      }

      const init = this.iso?.initializeSegmentation()
      const initBuffer = Array.isArray(init) ? init[0]?.buffer : init?.buffer
      if (!initBuffer) {
        this.fail({ kind: 'server', message: 'no init segment' }, '无法生成初始化分段')
        return
      }
      // 初始化分段是整条视频的公共头，不属于任何一轨，投给任一 SourceBuffer 即可被所有轨复用
      const first = this.sourceBuffers.values().next().value
      if (!first) {
        this.fail({ kind: 'server', message: 'no source buffer' }, '无法创建解码缓冲')
        return
      }
      this.appendQueues.get(first)?.push(initBuffer as ArrayBuffer)
      this.flushAppendQueue(first)
      this.iso?.start()
    } catch (e) {
      this.fail(
        { kind: 'server', message: e instanceof Error ? e.message : String(e) },
        '初始化播放失败',
      )
    }
  }

  /**
   * 读循环：按 appendBuffer 的返回值决定下一个偏移。
   * 循环会因「前方缓冲够多」「已到文件尾」「出错」「已销毁」而退出；恢复播放时由 watch 再次拉起。
   */
  private async readLoop(startOffset: number): Promise<void> {
    if (this.reading) return
    this.reading = true
    const loopId = ++this.readLoopId
    let offset = startOffset
    this.nextOffset = startOffset
    try {
      while (!this.destroyed) {
        const socket = this.socket
        const iso = this.iso
        if (!socket || !iso) return
        // 连接已断:destroy 路径由上面的 destroyed 拦掉,这里只可能是意外断开。
        // 必须报错 —— 静默 return 会让 UI 永远停在「缓冲中」,连重试按钮都不出现。
        if (socket.isClosed) {
          this.fail(socket.closeFailure ?? { kind: 'network' }, '视频流连接已断开')
          return
        }

        // 已经到文件尾（或读循环追上了 append 之外的尽头）
        if (this.fileSize > 0 && offset >= this.fileSize) {
          iso.flush()
          return
        }
        // 前方缓冲够多了，先停下等播放推进（这也是「短暂缓存」的上界）
        if (this.bufferedAheadSeconds() > MAX_BUFFER_AHEAD_SEC) return

        const payload = await socket.read(offset)
        if (this.destroyed) return
        this.consecutiveFailures = 0

        if (payload.byteLength === 0) {
          // 12 字节空头帧 = 已到文件尾，正常结束信号
          this.nextOffset = this.fileSize
          iso.flush()
          return
        }

        // ⚠️ 刻意忽略 appendBuffer 的返回值（它表示「解析器下一步想读哪」）。
        // moov 不在头部时它会直接把我们指到文件尾的 moov 上去，看起来省事，
        // 但**分段还需要 mdat 里的样本数据** —— 跳过的区间再也补不回来，
        // 结果是 moov 解析成功、却一个 onSegment 都出不来（播放永久卡住）。
        // 所以这里一律**顺序推进**：faststart(moov 在头)的视频照样即时起播；
        // moov 在尾的视频退化为「读完整个文件才能起播」——这是哑字节服务器 +
        // 非 faststart 文件本身的下限，不是这里能绕过的。
        this.nextOffset = offset + payload.byteLength
        const buffer = toMp4BoxBuffer(payload, offset)
        iso.appendBuffer(buffer)
        offset = this.nextOffset
        this.applyPendingSeek()
      }
    } catch (e) {
      if (this.destroyed) return
      // 跳转会主动作废在途 read，这类失败不是故障，不计入熔断、静默退出
      if (e instanceof VideoStreamError && e.stale) return
      this.consecutiveFailures += 1
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_READ_FAILURES) {
        this.fail(
          e instanceof VideoStreamError ? e.failure : { kind: 'network' },
          e instanceof Error ? e.message : String(e),
        )
        return
      }
      // 单次读取失败：短暂退避后从同一偏移重试
      await delay(300 * this.consecutiveFailures)
      if (!this.destroyed && this.readLoopId === loopId) {
        this.reading = false
        void this.readLoop(offset)
      }
      return
    } finally {
      // 只在「仍是当前循环」时清标志：跳转已起了新循环，别把它踩掉
      if (this.readLoopId === loopId) this.reading = false
    }
  }

  /** 播放头前方已缓冲的秒数（取当前时间所在区间的末端） */
  private bufferedAheadSeconds(): number {
    const buffered = this.video.buffered
    const now = this.video.currentTime
    for (let i = 0; i < buffered.length; i += 1) {
      const start = buffered.start(i)
      const end = buffered.end(i)
      if (now >= start && now <= end) return end - now
    }
    return 0
  }

  /** 把 SourceBuffer 的待 append 队列推进一格（同一 SourceBuffer 同时只允许一个未完成的 append） */
  private flushAppendQueue(sourceBuffer: SourceBuffer): void {
    if (this.destroyed || this.appending.has(sourceBuffer)) return
    if (sourceBuffer.updating) return
    const queue = this.appendQueues.get(sourceBuffer)
    const next = queue?.shift()
    if (!next) return
    try {
      this.appending.add(sourceBuffer)
      sourceBuffer.appendBuffer(next)
    } catch (e) {
      this.appending.delete(sourceBuffer)
      // QuotaExceeded：缓冲已满，丢掉播放头身后的部分腾地方，本次分段丢弃（后续会重新读到）
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        this.evictBehind(true)
        return
      }
      this.fail(
        { kind: 'server', message: e instanceof Error ? e.message : String(e) },
        '写入解码缓冲失败',
      )
      return
    }
    // appendBuffer 是异步的，updateend 会在完成后再次调用本方法推进队列
    this.appending.delete(sourceBuffer)
    if (!sourceBuffer.updating) this.flushAppendQueue(sourceBuffer)
  }

  private enqueueAppend(sourceBuffer: SourceBuffer, buffer: ArrayBuffer): void {
    if (this.destroyed) return
    const queue = this.appendQueues.get(sourceBuffer)
    if (!queue) return
    queue.push(buffer)
    this.flushAppendQueue(sourceBuffer)
    this.callbacks.onPhase('playing')
  }

  /** 回收播放头身后的已缓冲区间与 mp4box 持有的样本数据 */
  private evictBehind(aggressive = false): void {
    const keep = aggressive ? 0 : KEEP_BEHIND_SEC
    const cutoff = this.video.currentTime - keep
    if (cutoff <= 0) return
    for (const [trackId, sourceBuffer] of this.sourceBuffers) {
      if (sourceBuffer.updating) continue
      const buffered = sourceBuffer.buffered
      if (buffered.length === 0 || buffered.start(0) >= cutoff) continue
      try {
        sourceBuffer.remove(0, cutoff)
      } catch {
        // remove 与正在进行的 append 冲突时会抛 InvalidStateError，下一轮再试即可
        continue
      }
      const sample = this.nextSample.get(trackId)
      if (sample != null) {
        try {
          this.iso?.releaseUsedSamples(trackId, sample)
        } catch {
          // 释放失败只是内存没回收，不影响播放
        }
      }
    }
  }

  /** 播放推进时调用：回收身后缓冲，并在前方缓冲不足时重新拉起读循环 */
  tick(): void {
    if (this.destroyed) return
    this.evictBehind()
    if (!this.reading && this.nextOffset < this.fileSize
        && this.bufferedAheadSeconds() < MAX_BUFFER_AHEAD_SEC) {
      void this.readLoop(this.nextOffset)
    }
  }

  /**
   * 跳转：对在途 read 发 cancel 并换代作废（协议 §5）、清掉不连续的旧缓冲，
   * 用 mp4box 把目标时间换算成关键帧字节偏移后从那里重新读。
   */
  async seekTo(time: number): Promise<void> {
    const socket = this.socket
    const iso = this.iso
    if (!socket || !iso || this.destroyed) return

    // 走到这里就是一次**用户发起**的跳转:丢掉可能还没被认领的内部 seek 标记,
    // 免得它留着去误吞用户接下来的拖动
    this.internalSeekTarget = null
    this.pendingSeekTime = time
    socket.beginGeneration()
    // 换代让在飞的旧循环失效（它会在自己的 finally 里认出已被取代），再由下面起新循环
    this.readLoopId += 1
    this.reading = false

    for (const sourceBuffer of this.sourceBuffers.values()) {
      if (sourceBuffer.updating) {
        try {
          sourceBuffer.abort()
        } catch {
          // abort 失败不影响后续 remove
        }
      }
      try {
        const end = sourceBuffer.buffered.length
          ? sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1)
          : 0
        if (end > 0) sourceBuffer.remove(0, end)
      } catch {
        // 与 append 冲突时下一轮 tick 还会再清
      }
    }

    const position = iso.seek(time, true)
    const offset = typeof position?.offset === 'number' ? position.offset : 0
    void this.readLoop(offset)
  }

  /** 首个分段 append 完成后把 currentTime 落到跳转目标 */
  private applyPendingSeek(): void {
    const target = this.pendingSeekTime
    if (target == null) return
    if (this.video.buffered.length === 0) return
    this.pendingSeekTime = null
    // 这次赋值会异步派发 seeking 事件，先记下目标，供 consumeInternalSeek 认领
    this.internalSeekTarget = target
    try {
      this.video.currentTime = target
    } catch {
      // 极少数情况下目标还不在已缓冲范围内，浏览器会自行忽略
      this.internalSeekTarget = null
    }
  }

  /**
   * 认领一次「播放器自己发起的」seeking 事件：是内部赋值引起的就返回 true，
   * 调用方应忽略它。**不认领的后果**是内部 seek 再走一遍用户级 seekTo ——
   * 又换一代、又清掉刚填好的缓冲，画面白重来一遍（moov 未解析时还会退回字节 0）。
   * 按目标时间比对并一次消费，避免把用户随后的真实拖动误判成内部 seek。
   */
  consumeInternalSeek(time: number): boolean {
    if (this.internalSeekTarget == null) return false
    if (Math.abs(this.internalSeekTarget - time) > 0.25) return false
    this.internalSeekTarget = null
    return true
  }

  private fail(failure: VideoStreamFailure, message: string): void {
    if (this.destroyed) return
    this.callbacks.onError(failure, message)
  }

  destroy(): void {
    this.destroyed = true
    this.pendingSeekTime = null
    this.internalSeekTarget = null
    this.socket?.close()
    this.socket = null
    try {
      if (this.mediaSource?.readyState === 'open') this.mediaSource.endOfStream()
    } catch {
      // 忽略：连接可能已经因错误关闭
    }
    this.sourceBuffers.clear()
    this.appendQueues.clear()
    this.appending.clear()
    this.nextOffset = 0
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
    this.video.removeAttribute('src')
    this.video.load()
    this.iso = null
    this.mediaSource = null
  }
}

/** 由 mp4box 的轨道信息拼出 MSE 的 MIME 串（视频 + 音频编解码器） */
function buildMimeType(info: Movie): string {
  const codecs: string[] = []
  const video = info.videoTracks[0]
  const audio = info.audioTracks[0]
  if (video?.codec) codecs.push(video.codec)
  if (audio?.codec) codecs.push(audio.codec)
  return codecs.length > 0 ? `video/mp4; codecs="${codecs.join(',')}"` : 'video/mp4'
}

/**
 * 把 WS 收到的字节包装成 mp4box 需要的 buffer。
 * `fileStart` 是该段在原始文件中的偏移，mp4box 靠它把乱序到达的数据拼回正确位置。
 */
function toMp4BoxBuffer(payload: Uint8Array, fileStart: number): MP4BoxBuffer {
  const copy = payload.slice()
  const buffer = copy.buffer as ArrayBuffer
  ;(buffer as MP4BoxBuffer).fileStart = fileStart
  return buffer as MP4BoxBuffer
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
