<script setup lang="ts">
/**
 * 教学视频播放弹窗：把 VideoPlayerSession 的生命周期绑到弹窗开合上。
 *
 * 关于失败分类的一个坑（文档 §3.3 与浏览器实际行为不一致）:
 * 文档说握手失败会返回 401/403 这些**真实 HTTP 状态码**，服务端确实如此，
 * 但**浏览器 WebSocket API 不暴露失败握手的状态码** —— 一律只表现为 onclose(1006)。
 * 所以这里在 WS 失败后另发一次 `GET /videos/{id}`（silent）去探真实原因：
 * 403 → 无权限、404 → 文件已回收、401 → 登录失效、其它 → 网络问题。
 */
import { computed, nextTick, ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NButton, NSpace, NSpin, NText } from 'naive-ui'
import { BusinessError, HttpError } from '@/shared/api'
import { accessToken, ensureFreshAccessToken } from '@/shared/tokenManager'
import playSvg from '@/icons/play.svg'
import pauseSvg from '@/icons/pause.svg'
import { fetchVideoDetail } from '../api'
import { VideoPlayerSession, type PlayerPhase } from '../video/player'
import type { VideoStreamFailure } from '../video/wsClient'
import type { VideoView } from '../types'

const props = defineProps<{
  show: boolean
  video: VideoView | null
}>()

const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const { t } = useI18n()

const videoEl = ref<HTMLVideoElement | null>(null)
const phase = ref<PlayerPhase>('connecting')
const failure = ref<VideoStreamFailure | null>(null)
/** 服务端 meta 回报的权威时长（HTTP 里的 durationSec 可能为 null） */
const liveDuration = ref<number | null>(null)
/**
 * `<video>` 自己的暂停状态（未开始 / 用户暂停 / 播完都是 true）。
 * 中间大播放键以它为准，而不是以 phase 为准 —— phase 描述的是「数据链路」，
 * 暂停与否只有元素自己知道。
 */
const paused = ref(true)
/**
 * 原生控件条 + 中间大按钮是否露面。播放中**空闲 IDLE_HIDE_MS 后自动收起**，
 * 画面独占整个区域（沉浸态）；点/移到视频上随时召唤回来。
 * 暂停、播完、连接中则常驻 —— 那些状态本来就该能操作。
 */
const chromeVisible = ref(true)

let session: VideoPlayerSession | null = null

/** 正在等数据：连接中或缓冲中 */
const loading = computed(() => phase.value === 'connecting' || phase.value === 'buffering')
/**
 * 中间大按钮：暂停态常显（播放键），播放态只在界面被召唤出来时显（暂停键）。
 * 隐藏时 overlayVisible 也跟着落空，画面回归纯净。
 */
const showBigButton = computed(() => !failure.value && (paused.value || chromeVisible.value))
/** 覆盖层是否出现 */
const overlayVisible = computed(() => showBigButton.value || loading.value)
/** 沉浸态：播放中且界面已收起（此时连鼠标指针一起藏掉） */
const immersive = computed(() => !chromeVisible.value && !paused.value && !failure.value)
/** 大按钮的无障碍名：播完是「重新播放」，暂停中「播放」，播放中「暂停」 */
const bigButtonLabel = computed(() =>
  t(
    !paused.value
      ? 'coursework.player.pause'
      : phase.value === 'ended'
        ? 'coursework.player.replay'
        : 'coursework.player.play',
  ),
)
/** 大按钮图标：暂停显示播放三角，播放显示暂停双竖条 */
const bigButtonIcon = computed(() => (paused.value ? playSvg : pauseSvg))
/** 覆盖层压暗程度：等数据时压得重些（要看清转圈），单纯暂停时轻压，播放中不压 */
const overlayDimClass = computed(() =>
  loading.value ? 'player-mask--dim' : paused.value ? 'player-mask--dim-soft' : '',
)

/** 播放中「无操作」多久后收起界面进入沉浸态 */
const IDLE_HIDE_MS = 3000
/** 指针是否按着（拖进度条时别把界面收走） */
let pointerDown = false
let hideTimer: ReturnType<typeof setTimeout> | null = null

function clearHideTimer(): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

/** 播放中才计时：暂停/播完/连接中界面常驻 */
function scheduleHide(): void {
  clearHideTimer()
  if (paused.value || pointerDown) return
  hideTimer = setTimeout(() => {
    hideTimer = null
    if (!paused.value && !pointerDown) chromeVisible.value = false
  }, IDLE_HIDE_MS)
}

/** 任何操作都先把界面召唤出来，再重新计时 */
function revealChrome(): void {
  chromeVisible.value = true
  scheduleHide()
}

function handlePointerDown(): void {
  pointerDown = true
  revealChrome()
  // 指针可能在控件条上抬起（事件不回冒到这里），挂一次 window 兜底，否则界面再也不会收
  window.addEventListener('pointerup', handlePointerUp, { once: true, capture: true })
}

function handlePointerUp(): void {
  pointerDown = false
  scheduleHide()
}

/** 失败原因 -> 文案键 */
function failureMessageKey(kind: VideoStreamFailure['kind']): string {
  switch (kind) {
    case 'auth':
      return 'coursework.player.errorAuth'
    case 'forbidden':
      return 'coursework.player.errorForbidden'
    case 'gone':
      return 'coursework.player.errorGone'
    case 'overload':
      return 'coursework.player.errorOverload'
    case 'network':
      return 'coursework.player.errorNetwork'
    case 'server':
      return 'coursework.player.errorGeneric'
  }
}

/**
 * WS 失败后用一次 HTTP 探测换到可展示的原因。
 * 探测本身也失败时退回「网络问题」，不再往下猜。
 */
async function classifyFailure(videoId: number): Promise<VideoStreamFailure> {
  try {
    // 探测要静默:失败原因由播放器自己展示,别让 api 层再弹一次、也别白闪全局加载药丸
    await fetchVideoDetail(videoId, { silent: true, loading: false })
    // 详情拿得到说明权限与文件都在，那握手失败多半是网络层
    return { kind: 'network' }
  } catch (e) {
    if (e instanceof BusinessError) {
      if (e.code === 403) return { kind: 'forbidden' }
      if (e.code === 404) return { kind: 'gone' }
      if (e.code === 401) return { kind: 'auth' }
      return { kind: 'server', message: e.message }
    }
    if (e instanceof HttpError) {
      if (e.status === 403) return { kind: 'forbidden' }
      if (e.status === 404) return { kind: 'gone' }
      if (e.status === 401) return { kind: 'auth' }
    }
    return { kind: 'network' }
  }
}

function destroySession(): void {
  session?.destroy()
  session = null
  phase.value = 'connecting'
  failure.value = null
  liveDuration.value = null
  paused.value = true
  chromeVisible.value = true
  clearHideTimer()
}

/**
 * 等 <video> 真正挂上再起播。
 * NModal 的内容是懒挂载的，show 翻成 true 的同一 tick 里 ref 还是 null，
 * 必须让 Vue 的更新跑完（必要时再等一帧）。
 */
async function startWhenReady(video: VideoView): Promise<void> {
  await nextTick()
  if (!videoEl.value) await nextTick()
  const el = videoEl.value
  if (!el || !props.show) return
  await start(video, el)
}

async function start(video: VideoView, el: HTMLVideoElement): Promise<void> {
  destroySession()
  // 视频流 WS 的 token 只在握手时用一次(query 参数),而 access token 只有 30 分钟:
  // 页面挂机久了手里的 token 早已过期,握手会被服务端拒 —— 浏览器又读不到失败状态码,
  // 只会被下面的 HTTP 探测误判成「网络问题」。故握手前先确保 token 未临近过期。
  await ensureFreshAccessToken()
  // 刷新期间弹窗被关掉/换了视频:本次起播作废,别去建一条没人用的连接
  // (服务端全局限 200 条并发连接,泄漏不起)
  if (!props.show || props.video?.id !== video.id) return
  const token = accessToken.value
  if (!token) {
    failure.value = { kind: 'auth' }
    return
  }
  const current = new VideoPlayerSession(el, video.id, token, {
    onPhase: (p) => {
      phase.value = p
    },
    onMeta: (meta) => {
      liveDuration.value = meta.durationSec
    },
    // moov 解析出的片长比 meta 里的权威（meta 可能为 null），一到就覆盖
    onDuration: (seconds) => {
      liveDuration.value = seconds
    },
    onError: (f) => {
      failure.value = f
    },
  })
  session = current
  try {
    await current.start()
  } catch {
    // 握手阶段的失败拿不到 HTTP 状态码，另发一次 HTTP 探测换成可展示的原因
    failure.value = await classifyFailure(video.id)
  }
}

/** 播放推进：回收身后的缓冲，并在前方缓冲不足时续读 */
function handleTimeUpdate() {
  session?.tick()
}

/**
 * 「缓冲中」遮罩以 <video> 自己的事件为准，而不是「append 过一次分段」：
 * 音频轨只要 70KB 就能出分段，比视频轨早得多，按 append 收工会在画面全黑时就撤掉遮罩。
 * 另外 `waiting`/`stalled` 时必须补一次 tick —— timeupdate 在卡住时不派发，
 * 光等它续读会让播放器永久停在缓冲中。
 */
function handleWaiting() {
  // 整片已读完还报 waiting，那是播到结尾停住了（endOfStream 之前的一瞬），不是缓冲
  if (session?.isComplete) return
  phase.value = 'buffering'
  session?.tick()
}

function handleReady() {
  phase.value = 'playing'
}

function handlePlay() {
  paused.value = false
  // 起播后先让界面露一下再自动收起 —— 一上来就全黑会让人以为没反应
  revealChrome()
}

function handlePause() {
  paused.value = true
  // 暂停态界面常驻：这时候用户多半正要拖进度或调音量
  chromeVisible.value = true
  clearHideTimer()
}

/** 播完：转圈必须停 —— 中间换成大播放键，点它从头重播 */
function handleEnded() {
  phase.value = 'ended'
  paused.value = true
  chromeVisible.value = true
  clearHideTimer()
}

/**
 * 中间大按钮：暂停中点了就播（播完则从头重播），播放中点了就暂停。
 * 重播要显式回到起点（触发 seeking → seekTo(0) 重新拉数据），不依赖浏览器对 ended
 * 的隐式 seek —— 各版本表现不一致，而我们要的是「确定能重播」。
 */
async function handleBigButton() {
  const el = videoEl.value
  if (!el) return
  if (!paused.value) {
    el.pause()
    return
  }
  if (phase.value === 'ended' || el.ended) el.currentTime = 0
  try {
    await el.play()
  } catch {
    // 浏览器可能因自动播放策略或数据未就绪拒绝：保持暂停态（大播放键还在），用户可以再点
  }
}

/**
 * 拖动进度条。注意 `seeking` 事件也会被播放器**自己**赋值 currentTime 触发
 * （跳转完成后把播放头落到目标位置），那种内部 seek 必须先认领掉 ——
 * 否则会再走一遍 seekTo：又换一代、又清掉刚填好的缓冲，画面白重来一遍。
 */
function handleSeeking() {
  const el = videoEl.value
  if (!el) return
  const current = session
  if (!current || current.consumeInternalSeek(el.currentTime)) return
  void current.seekTo(el.currentTime)
}

function handleRetry() {
  const v = props.video
  if (v) void startWhenReady(v)
}

function close(): void {
  emit('update:show', false)
}

// 打开即起播；关闭立刻释放 WS 连接（服务端全局并发上限 200，不能泄漏）
watch(
  () => [props.show, props.video] as const,
  ([show, video]) => {
    if (show && video) void startWhenReady(video)
    else destroySession()
  },
  { immediate: true },
)

onBeforeUnmount(destroySession)

function displayDuration(): string {
  const seconds = liveDuration.value ?? props.video?.durationSec ?? null
  if (seconds == null || seconds <= 0) return '-'
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="coursework-modal coursework-player-modal"
    :title="
      video ? `${t('coursework.player.title')} - ${video.title}` : t('coursework.player.title')
    "
    @update:show="emit('update:show', $event)"
  >
    <!-- 指针一动/一按就召唤界面；播放中空闲下来自动收起，画面独占整个区域 -->
    <div
      class="player-wrap"
      :class="{ 'player-wrap--immersive': immersive }"
      @pointermove="revealChrome"
      @pointerdown="handlePointerDown"
    >
      <!-- controls 是开关而不是常驻：收起界面时连原生控件条一起藏掉才是沉浸态 -->
      <video
        ref="videoEl"
        class="player-video"
        :controls="chromeVisible"
        playsinline
        preload="auto"
        @timeupdate="handleTimeUpdate"
        @seeking="handleSeeking"
        @canplay="handleReady"
        @playing="handleReady"
        @seeked="handleReady"
        @play="handlePlay"
        @pause="handlePause"
        @ended="handleEnded"
        @waiting="handleWaiting"
        @stalled="handleWaiting"
      ></video>

      <div v-if="failure" class="player-mask player-mask--dim">
        <NText>{{ t(failureMessageKey(failure.kind)) }}</NText>
        <NButton size="small" type="primary" @click="handleRetry">
          {{ t('coursework.player.retry') }}
        </NButton>
      </div>
      <!-- 覆盖层不吃指针事件（只有大按钮自己吃）：挡住了原生控件就没法再操作播放了 -->
      <div
        v-else-if="overlayVisible"
        class="player-mask player-mask--passthrough"
        :class="overlayDimClass"
      >
        <button
          v-if="showBigButton"
          type="button"
          class="player-big-btn"
          :class="{ 'player-big-btn--play': paused }"
          :aria-label="bigButtonLabel"
          :title="bigButtonLabel"
          @click="handleBigButton"
        >
          <img :src="bigButtonIcon" alt="" />
        </button>
        <div
          v-if="loading"
          class="player-loading"
          :class="{ 'player-loading--below': showBigButton }"
        >
          <NSpin size="small" />
          <NText depth="3">
            {{
              t(
                phase === 'connecting'
                  ? 'coursework.player.connecting'
                  : 'coursework.player.buffering',
              )
            }}
          </NText>
        </div>
      </div>
    </div>
    <NText depth="3" class="player-meta">
      {{ t('coursework.video.playDuration') }}：{{ displayDuration() }}
    </NText>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="close">{{ t('coursework.player.close') }}</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped src="./VideoPlayerModal.css"></style>

<style>
.coursework-player-modal {
  width: 860px;
  max-width: 96vw;
}
</style>
