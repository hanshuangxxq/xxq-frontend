import type { ISOFile, MP4BoxBuffer, Movie, Track } from 'mp4box'
import { READ_LENGTH, VideoStreamError, VideoStreamSocket } from './wsClient'
import type { VideoStreamFailure } from './wsClient'

/**
 * 教学视频播放器：WS 字节区间 + mp4box 分段 + MSE。
 *
 * 服务端是「哑的字节区间服务器」——不转码、不按时间 seek，所以时间轴到字节偏移的换算
 * 全部在这里用 mp4box 完成（文档 §3.3）。
 *
 * ── `createFile(true)` 的 true 不能省 ──
 * mp4box 2.x 把 `createFile` 的首参改成了 `keepMdatData = false`（0.5.x 时代是 true）。
 * 不留 mdat 数据时，样本字节一进缓冲就被当垃圾回收掉，`getSample` 永远拿不到数据：
 * **moov 解析成功、onReady 照常触发，却一个分段都产不出来** —— 表现就是点播放后一直缓冲。
 *
 * ── 起播：不读完整个文件 ──
 * 教学视频基本都是非 faststart（moov 在文件尾），而 mdat 对解析器是个「未完成的 box」，
 * 它会停在 mdat 末尾那一字节等数据 —— 所以只有**倒着读**能让它尽早读到 moov：
 * 先读头 512KB（mp4box 要求首个 buffer 的 fileStart 为 0，否则一帧都不解析），
 * 再从文件尾往前逐段读，直到 onReady（细节见 probeForMoov）。
 * 之后才从头顺序读样本数据 —— 顺序读保证样本字节必然落在 mp4box 的主缓冲里。
 *
 * ── 缓存策略（短暂、运行期、不落盘）──
 * 读循环在「播放头前方已缓冲时长」超过 MAX_BUFFER_AHEAD_SEC 时暂停，防止一边播一边无限预读；
 * 播放推进时把播放头身后超过 KEEP_BEHIND_SEC 的已缓冲区间 `sourceBuffer.remove()` 掉，
 * 并调 `iso.releaseUsedSamples()` 让 mp4box 释放对应的样本数据。
 * 这样既不占内存，又保留了「前方一段」的缓冲以扛住网络抖动。
 *
 * ── 任意位置跳转：靠 mediaSource.duration，不靠「缓存够了」──
 * MSE 的 seekable 范围由**已 append 的区间**决定：不告诉 MSE 总时长，进度条就只能在
 * 「已缓冲的那一段」里拖 —— 于是必须从头顺序看完才能拖到后面（用户看到的正是这个）。
 * 故 moov 一解析出来（onReady）就把 mediaSource.duration 设成片长，整条时间轴立刻可拖，
 * 拖到未缓冲区间时由 seekTo 把字节游标挪到目标关键帧再续读。
 *
 * ── 读的并发 ──
 * 服务端按到达顺序串行 drain，客户端按偏移顺序喂 mp4box，但**一次并发发一批 read**：
 * 单个在途时每 512KB 就要等一个 RTT，一批（PREFETCH_BATCH 个）只等一次，直接把
 * 「视频一帧帧地爬」变成正常速率。
 *
 * ── 播完必须封口 ──
 * 读到文件尾、且最后一批分段都 append 完成时要调 `mediaSource.endOfStream()`
 * （见 maybeEndOfStream）。不发的话播放器会永远停在「等数据」——因为 moov 的片长比
 * 最后一个样本的结束时间多一点，currentTime 顶不到 duration，ended 也就永远不来。
 */

/**
 * 播放阶段，供 UI 显示。
 * `ended` 表示「整片已播完」—— 它必须与 `buffering` 分开：播完时 <video> 会先进入
 * 「等数据」状态，若按 buffering 显示，用户看到的就是一个永远转不完的「缓冲中」。
 */
export type PlayerPhase = 'connecting' | 'buffering' | 'playing' | 'ended'

/** 播放头前方最多预读的时长：够扛网络抖动，又不会无限占内存 */
const MAX_BUFFER_AHEAD_SEC = 30
/** 播放头身后保留的已缓冲时长，超出的部分回收 */
const KEEP_BEHIND_SEC = 10
/**
 * 单次分段的样本数。mp4box 默认要求分段边界落在关键帧上，所以它实际决定的是
 * 「一个分段至少跨过几个关键帧周期」—— 教学视频 GOP ≈ 1s，30 样本正好落在第一个关键帧上。
 * 这个值直接决定**起播与每次跳转的等待字节数**（实测 15Mbps/30fps 视频）：
 * 100 样本 → 起播 6.5MB、跳转 8.5MB；30 样本 → 起播 3MB、跳转 2.5MB。再小也不会更快（受 GOP 限制）。
 * 调小的代价只是 MSE append 次数变多。
 */
const SAMPLES_PER_SEGMENT = 30
/** 连续读取失败多少次后放弃（首次失败也计入） */
const MAX_CONSECUTIVE_READ_FAILURES = 6
/** moov 探测最多往回读几段（512KB/段，共 8MB），超出就交给顺序读兜底 */
const MAX_TAIL_PROBE_CHUNKS = 16
/**
 * 一次并发发起的 read 数。服务端上限 8、wsClient 自压到 6，这里取 4：
 * 既把 RTT 由「每 512KB 一次」摊薄成「每批一次」，又给探测读/取消留出余量。
 */
const PREFETCH_BATCH = 4
/** 判定「该位置已在缓冲里、浏览器自己能跳过去」时，距区间末尾留的安全边距（贴着末尾跳过去立刻又缺数据） */
const BUFFERED_TAIL_MARGIN_SEC = 0.5

export interface PlayerCallbacks {
  onPhase: (phase: PlayerPhase) => void
  onError: (failure: VideoStreamFailure, message: string) => void
  /** 收到 open 的 meta（含服务端权威 size/sha256/durationSec） */
  onMeta: (meta: { size: number; sha256: string; durationSec: number | null }) => void
  /** 从 moov 解析出的真实片长（服务端 meta 的 durationSec 可能为 null，以这里为准） */
  onDuration: (durationSec: number) => void
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
  /** moov 是否已解析（onReady 已触发），探测读据此提前收工 */
  private moovReady = false
  /** 起播探测是否已做过（每个 session 只做一次） */
  private moovProbed = false
  /**
   * 读循环代次。跳转时自增，让「在飞的旧循环」在自己的 finally 里认出自己已被取代，
   * 不去清掉新循环刚设上的 reading 标志 —— 否则两个循环会并行跑，重复读同一段。
   */
  private readLoopId = 0
  private destroyed = false
  private consecutiveFailures = 0
  private durationSec: number | null = null
  private fileSize = 0
  /** 是否已把整份文件读到尾（最后一个样本都已交给 mp4box） */
  private readToEnd = false
  /** 是否已给 MediaSource 发过 endOfStream */
  private eosSent = false
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

    // ★ 首参 true = 保留 mdat 数据，漏掉它样本数据会被 mp4box 当垃圾回收掉，
    // 结果是 moov 解析成功却一个分段都产不出来（点播放后永远「缓冲中」）
    const iso = createFile(true) as unknown as ISOFile<SourceBuffer>
    this.iso = iso
    // 探测读的空洞会让 mp4box 把源缓冲误标成「已消费」（原因见 resetMdatBookkeeping），
    // 而 cleanBuffers() 在**每次** appendBuffer 末尾就按这些标记回收 —— 头段一旦被回收，
    // 落在里面的第 0 个样本就再也取不到（整条轨零分段、永远缓冲）。所以探测期间先停掉回收，
    // onReady 清完标记再放行；探测窗口最大 8MB，暂停回收不会吃掉多少内存。
    const stream = iso.stream
    const runCleanBuffers = stream.cleanBuffers.bind(stream)
    stream.cleanBuffers = () => {
      if (this.moovReady) runCleanBuffers()
    }
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
    this.moovReady = true
    // 探测读在文件中间留了空洞，mp4box 那份 mdat 副本与「已消费」标记都是错的，
    // 必须赶在本轮 processSamples 之前清掉
    this.resetMdatBookkeeping()
    this.applyDuration(info)

    const tracks = info.tracks.filter(isMediaTrack)
    if (tracks.length === 0) {
      this.fail({ kind: 'server', message: 'no track' }, '视频没有可播放的轨道')
      return
    }

    try {
      for (const track of tracks) {
        // 每轨用**自己的** mime：视频轨 video/mp4、音频轨 audio/mp4，
        // 一处声明两种编码会让 SourceBuffer 与要装的轨对不上
        const mime = buildTrackMimeType(track)
        if (!MediaSource.isTypeSupported(mime)) {
          this.fail({ kind: 'server', message: mime }, `浏览器不支持该编码: ${mime}`)
          return
        }
        const sourceBuffer = this.mediaSource.addSourceBuffer(mime)
        sourceBuffer.mode = 'segments'
        sourceBuffer.addEventListener('updateend', () => {
          this.flushAppendQueue(sourceBuffer)
          // 全片读完后，最后一个分段 append 完成的那一刻才是给 MSE 封口的时机
          this.maybeEndOfStream()
        })
        sourceBuffer.addEventListener('error', () => {
          this.fail({ kind: 'server', message: 'SourceBuffer error' }, '解码缓冲出错')
        })
        this.sourceBuffers.set(track.id, sourceBuffer)
        this.appendQueues.set(sourceBuffer, [])
        this.iso?.setSegmentOptions(track.id, sourceBuffer, { nbSamples: SAMPLES_PER_SEGMENT })
      }

      // ★ 每轨各取一份初始化分段（'per-track'）：MSE 要求**每个** SourceBuffer 都收到自己那条轨的
      // init 分段。用合并的那一份（默认 'combined'）只投给第一条轨，音频 SourceBuffer 就永远没有
      // 初始化分段，往它 append 媒体分段会被浏览器拒绝 —— 整条音轨不可用。
      const initSegments = this.iso?.initializeSegmentation('per-track') ?? []
      if (initSegments.length === 0) {
        this.fail({ kind: 'server', message: 'no init segment' }, '无法生成初始化分段')
        return
      }
      for (const segment of initSegments) {
        const queue = this.appendQueues.get(segment.user)
        if (!queue) continue
        queue.push(segment.buffer)
        this.flushAppendQueue(segment.user)
      }
      this.iso?.start()
    } catch (e) {
      this.fail(
        { kind: 'server', message: e instanceof Error ? e.message : String(e) },
        '初始化播放失败',
      )
    }
  }

  /**
   * 把片长告诉 MediaSource —— 这是「任意位置跳转」的前提，不是可选优化。
   *
   * MSE 的 seekable 范围由**已 append 的区间**推出来：不设 duration，原生进度条就只能在
   * 「已经缓冲到的那一段」里拖，用户要拖到后面就必须先从头把片子缓冲完 —— 表现就是
   * 「等很久才能跳、不能一上来就全局跳」。设上片长后整条时间轴立刻可拖，拖到未缓冲处由
   * seekTo 负责把字节游标挪到目标关键帧。
   *
   * 片长以 moov 解析值为准（服务端 meta 里的 durationSec 来自上传端元数据，可能为 null），
   * 两者取先到的可用值，并回传给 UI 显示。
   */
  private applyDuration(info: Movie): void {
    const fragment = info.fragment_duration
    const fromFragments = fragment && fragment.den > 0 ? fragment.num / fragment.den : 0
    const fromMoov = info.timescale > 0 ? info.duration / info.timescale : 0
    // 分片 MP4 的 mvhd.duration 常为 0，总时长只在 mehd 里，故取三级回退
    const seconds =
      fromMoov > 0 ? fromMoov : fromFragments > 0 ? fromFragments : (this.durationSec ?? 0)
    if (!Number.isFinite(seconds) || seconds <= 0) return
    this.durationSec = seconds
    try {
      // readyState 非 open 时赋值会抛 InvalidStateError：拿不到就退回「已缓冲范围内可拖」
      if (this.mediaSource?.readyState === 'open') this.mediaSource.duration = seconds
    } catch {
      // 忽略：个别浏览器对 duration 的赋值时机更挑剔，不影响播放
    }
    this.callbacks.onDuration(seconds)
  }

  /**
   * 整份文件读完后，必须显式告诉 MSE「没有更多数据了」。
   *
   * 不发的后果（线上真实故障）：moov 里 mvhd 的片长会比最后一个样本的结束时间多零点几秒，
   * 播到已缓冲数据末尾时 currentTime 已经顶到实际结尾、duration 却还差那零点几秒，
   * `<video>` 于是停在「等待数据」状态 —— 既不触发 ended，也没有进度可走，
   * UI 上就是一个永远转不完的「缓冲中」（暂停图标还亮着，用户以为卡死了）。
   *
   * 顺便把 duration 收窄到实际缓冲末端：让进度条、ended 判定、跳转夹取都以真实结尾为准。
   * endOfStream 要求所有 SourceBuffer 都不在 updating、队列也已排空，所以它挂在 updateend 之后调用。
   */
  private maybeEndOfStream(): void {
    if (this.eosSent || this.destroyed || !this.readToEnd) return
    const mediaSource = this.mediaSource
    if (mediaSource?.readyState !== 'open') return
    for (const sourceBuffer of this.sourceBuffers.values()) {
      if (sourceBuffer.updating || this.appendQueues.get(sourceBuffer)?.length) return
    }

    const buffered = this.video.buffered
    const end = buffered.length > 0 ? buffered.end(buffered.length - 1) : 0
    this.eosSent = true
    try {
      if (end > 0 && this.durationSec != null && end < this.durationSec) {
        mediaSource.duration = end
        this.durationSec = end
        this.callbacks.onDuration(end)
      }
    } catch {
      // 收窄失败只是时长不够精确，不能连累下面的 endOfStream
    }
    try {
      mediaSource.endOfStream()
    } catch {
      // 条件不满足（有 append 在飞 / 已经 ended）：撤标记，下一次 updateend 再来
      this.eosSent = false
    }
  }

  /**
   * 清掉 mp4box 在「mdat 齐了」时留下的两处副作用（起播探测读的空洞引起的）。
   *
   * 解析器只要能看到 mdat 末尾那一字节就认定 mdat 完整，于是调 transferMdatData()：
   * 1. 把 mdat 字节按 buffer 顺序抄进 mdat.stream —— 空洞两侧被当成连续数据，位置整体错位；
   *    getSample 在主缓冲里找不到样本时退到这份副本，拿到的就是**别处的字节**（花屏/解码报错）。
   *    故直接作废：找不到就返回「数据未到」，mp4box 会等后续分段补齐。
   * 2. 顺手把抄过的源缓冲标成「已消费」，cleanBuffers() 于是把头一段当垃圾扔掉 ——
   *    而**第 0 个样本正落在头一段里**。样本是顺序消费的，第 0 个取不到，整条轨就一个分段都产不出来
   *    （表现就是永远缓冲）。
   *
   * 只在 onReady（解析器刚跨过 mdat 的那一刻）执行一次：此刻还没有任何样本被消费，
   * 清标记不会把真正该回收的缓冲留下来。
   */
  private resetMdatBookkeeping(): void {
    const iso = this.iso
    if (!iso) return
    for (const mdat of iso.mdats) {
      ;(mdat as { stream?: unknown }).stream = undefined
    }
    for (const buffer of iso.stream?.buffers ?? []) {
      buffer.usedBytes = 0
    }
  }

  /**
   * 读循环：首次进入先做 moov 探测，之后从文件头起逐段顺序推进。
   * 循环会因「前方缓冲够多」「已到文件尾」「出错」「已销毁」而退出；播放推进时由 tick() 再次拉起。
   */
  private async readLoop(startOffset: number): Promise<void> {
    if (this.reading) return
    this.reading = true
    const loopId = ++this.readLoopId
    let offset = startOffset
    this.nextOffset = startOffset
    try {
      // 首次进入先探 moov：非 faststart 的文件不这么做就得读完整份文件才能起播
      if (!this.moovProbed) {
        offset = await this.probeForMoov()
        // 探测期间被跳转/销毁取代：交给新循环，别把两段读序混在一起
        if (this.destroyed || this.readLoopId !== loopId) return
        this.moovProbed = true
        this.nextOffset = offset
      }
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
          this.finishReading(iso)
          return
        }
        // 前方缓冲够多了，先停下等播放推进（这也是「短暂缓存」的上界）
        if (this.bufferedAheadSeconds() > MAX_BUFFER_AHEAD_SEC) return

        const end = await this.readAndFeedBatch(offset)
        if (this.destroyed) return
        this.consecutiveFailures = 0

        if (end === offset) {
          // 整批一个字节都没读到（游标已越过文件尾），正常结束信号
          this.nextOffset = this.fileSize
          this.finishReading(iso)
          return
        }

        // 一律**顺序推进**：分段要的是 mdat 里的样本数据，跳过去的区间再也补不回来
        // （mp4box 的 appendBuffer 返回值会直接指向文件尾的 moov，跟着跳就会
        // 「moov 解析成功却一个分段都产不出来」）。moov 已由 probeForMoov 提前拿到，
        // 所以这里只管一段接一段地读下去。
        this.nextOffset = end
        offset = end
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

  /**
   * 读到文件尾的收尾：flush 出最后几个分段，再尝试给 MSE 封口（见 maybeEndOfStream）。
   * flush 产出的分段是异步 append 的，封口多半发生在随后的 updateend 里；
   * 这里也调一次，是为了「最后一批一个分段都没产出、不会再有 updateend」的情况。
   */
  private finishReading(iso: ISOFile<SourceBuffer>): void {
    this.readToEnd = true
    iso.flush()
    this.maybeEndOfStream()
  }

  /**
   * 起播探测：按「头一段 + 从文件尾往前」的顺序读，直到 mp4box 解析出 moov。
   * 返回随后应当开始顺序读的偏移（即头段之后）。
   *
   * 为什么顺序是这个：
   * - 首个 buffer 的 fileStart 必须是 0，否则 MultiBufferStream.initialized() 拒绝解析，一帧都进不去；
   * - mdat 对解析器是「未完成的 box」，它会停在 mdat 末尾那一字节等数据 —— 所以只要读到的区间
   *   覆盖到那里，解析就继续往下走。倒着读时每一段都紧贴文件尾，一旦覆盖到 mdat 末尾，
   *   其后的 moov 也已就位（服务端对头/尾各 512KB 有缓存，这几段重复读几乎零成本）。
   * faststart（moov 在头）的文件在第一段就触发 onReady，这里直接返回，不做多余的读。
   */
  private async probeForMoov(): Promise<number> {
    const head = this.fileSize > 0 ? Math.min(READ_LENGTH, this.fileSize) : READ_LENGTH
    await this.readAndFeed(0, head)
    if (this.moovReady || this.destroyed || this.fileSize <= READ_LENGTH) return head

    let end = this.fileSize
    for (
      let i = 0;
      i < MAX_TAIL_PROBE_CHUNKS && !this.moovReady && !this.destroyed && end > 0;
      i += 1
    ) {
      const start = Math.max(0, end - READ_LENGTH)
      await this.readAndFeed(start, end - start)
      end = start
    }
    // 没探到（moov 异常大 / 尾段被服务端短读 / 文件本身有问题）：不做特殊处理 ——
    // 后面的顺序读走到文件尾时照样能解析出 moov，只是起播要等读完，不会卡死
    return head
  }

  /**
   * 顺序读一批：并发发 PREFETCH_BATCH 个 read（服务端按到达顺序串行 drain，应答天然有序），
   * 再**按偏移顺序**喂给 mp4box。顺序喂是硬约束（见 readLoop 内的注释），并发发的只是请求，
   * 两者不冲突；收益是把「一个 RTT 换 512KB」摊薄成「一个 RTT 换一批」。
   *
   * 返回这批之后应当从哪个偏移继续读（一个字节都没读到时原样返回 = 已到文件尾）。
   */
  private async readAndFeedBatch(offset: number): Promise<number> {
    const socket = this.socket
    const iso = this.iso
    if (!socket || !iso) throw new VideoStreamError({ kind: 'network' }, '视频连接已关闭')

    const offsets: number[] = []
    for (let i = 0; i < PREFETCH_BATCH; i += 1) {
      const at = offset + i * READ_LENGTH
      if (this.fileSize > 0 && at >= this.fileSize) break
      offsets.push(at)
    }
    if (offsets.length === 0) return offset

    const chunks = await Promise.all(offsets.map((at) => socket.read(at, READ_LENGTH)))
    let end = offset
    for (let i = 0; i < offsets.length; i += 1) {
      const payload = chunks[i]
      const at = offsets[i]
      // 空帧 = 已到文件尾；它后面的一定也是空帧，直接停
      if (!payload || at == null || payload.byteLength === 0) break
      // payload 的 fileStart 必须是**请求偏移**，mp4box 靠它把乱序到达的分段拼回正确位置
      iso.appendBuffer(toMp4BoxBuffer(payload, at))
      end = at + payload.byteLength
    }
    return end
  }

  /**
   * 读一段字节并喂给 mp4box，返回实际读到的长度（0 = 已到文件尾）。
   * 探测读用它（起播探测是「头一段 + 尾段回退」，本来就是随机读，不参与批量预取）。
   */
  private async readAndFeed(offset: number, length: number): Promise<number> {
    const socket = this.socket
    const iso = this.iso
    if (!socket || !iso) throw new VideoStreamError({ kind: 'network' }, '视频连接已关闭')
    const payload = await socket.read(offset, length)
    if (payload.byteLength === 0) return 0
    // payload 的 fileStart 必须是**请求偏移**，mp4box 靠它把乱序到达的分段拼回正确位置
    iso.appendBuffer(toMp4BoxBuffer(payload, offset))
    return payload.byteLength
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
    // 这里**不**报「可以播了」：音频轨的分段只要 70KB 就产出，比视频轨早得多，
    // 按它收工会让遮罩在画面还全黑时就消失。<video> 自己的 canplay/playing 才作数。
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
    if (
      !this.reading &&
      this.nextOffset < this.fileSize &&
      this.bufferedAheadSeconds() < MAX_BUFFER_AHEAD_SEC
    ) {
      void this.readLoop(this.nextOffset)
    }
  }

  /**
   * 跳转。分两种情况：
   * 1. 目标已在已缓冲区间内 —— 什么都不做，浏览器自己就能跳过去（清了反而要重拉）；
   * 2. 目标在缓冲外 —— 对在途 read 发 cancel 并换代作废（协议 §5）、清掉不连续的旧缓冲，
   *    用 mp4box 把目标时间换算成关键帧字节偏移后从那里重新读。
   */
  async seekTo(time: number): Promise<void> {
    const socket = this.socket
    const iso = this.iso
    if (!socket || !iso || this.destroyed) return

    // 走到这里就是一次**用户发起**的跳转:丢掉可能还没被认领的内部 seek 标记,
    // 免得它留着去误吞用户接下来的拖动
    this.internalSeekTarget = null

    const target = this.clampSeekTime(time)
    if (this.isBuffered(target)) {
      // 缓冲内的来回拖动应当零延迟：不动世代、不动缓冲、不重读
      this.pendingSeekTime = null
      return
    }

    // 先算偏移再动手：算不出来（moov 未就绪 / 目标超出轨长）就保持现状，别把好好的缓冲清掉
    const offset = this.resolveSeekOffset(iso, target)
    if (offset == null) return

    this.pendingSeekTime = target
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
        // 两类正常失败：与正在进行的 append 冲突（下一轮 tick 还会再清）；
        // 或已发过 endOfStream（MSE 在 'ended' 状态下禁止 remove，新数据 append 后自动回到 'open'），
        // 旧缓冲留着不影响跳转，交给 evictBehind 回收
      }
    }

    // 回看/重播要重新读：撤掉「已封口」的两个标记，读完再发一次 endOfStream
    // （MSE 在 'ended' 状态下收到 append 会自动回到 'open'，重发一次是合法的）
    this.readToEnd = false
    this.eosSent = false
    void this.readLoop(offset)
  }

  /** 目标时间夹到 [0, 片长)：超出片长会让 mp4box 的 seek 退化成「跳到文件尾」，一个字都读不回来 */
  private clampSeekTime(time: number): number {
    if (!Number.isFinite(time) || time <= 0) return 0
    const duration = this.durationSec
    if (duration != null && duration > 1 && time > duration - 1) return duration - 1
    return time
  }

  /** 该时间点是否已在 `<video>` 的已缓冲区间内（离区间末尾留余量，跳过去立刻能播才算数） */
  private isBuffered(time: number): boolean {
    const buffered = this.video.buffered
    for (let i = 0; i < buffered.length; i += 1) {
      if (time >= buffered.start(i) && time <= buffered.end(i) - BUFFERED_TAIL_MARGIN_SEC) {
        return true
      }
    }
    return false
  }

  /**
   * 目标时间 -> 该处关键帧的字节偏移（mp4box 用 moov 里的样本表算，不需要样本数据）。
   * 返回 null 表示「没有可补读的区间」：moov 还没解析出来（seek 会抛）、
   * 或 mp4box 认为目标数据已经躺在解析缓冲里（此时它返回的是缓冲区末端，可能直接是文件尾）。
   */
  private resolveSeekOffset(iso: ISOFile<SourceBuffer>, time: number): number | null {
    try {
      const offset = iso.seek(time, true)?.offset
      if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) return null
      if (this.fileSize > 0 && offset >= this.fileSize) return null
      return offset
    } catch {
      return null
    }
  }

  /** 首个分段 append 完成后把 currentTime 落到跳转目标 */
  private applyPendingSeek(): void {
    const target = this.pendingSeekTime
    if (target == null) return
    if (this.video.buffered.length === 0) return
    this.pendingSeekTime = null
    // 用户自己拖过去时 currentTime 已经在目标上，重复赋值不会派发 seeking ——
    // 认领标记留着就会误吞用户的下一次拖动，所以这里直接返回，不设标记
    if (Math.abs(this.video.currentTime - target) < 0.25) return
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

  /** 整份文件是否已读完（UI 据此区分「播完停住」与「真的在缓冲」） */
  get isComplete(): boolean {
    return this.readToEnd
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

/** 只有音视频轨进 MSE；字幕/元数据轨没有对应的 SourceBuffer */
function isMediaTrack(track: Track): boolean {
  return track.type === 'video' || track.type === 'audio'
}

/** 单轨的 MSE MIME 串：视频轨 video/mp4、音频轨 audio/mp4，只带这一条轨的 codec */
function buildTrackMimeType(track: Track): string {
  const type = track.type === 'audio' ? 'audio' : 'video'
  return track.codec ? `${type}/mp4; codecs="${track.codec}"` : `${type}/mp4`
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
