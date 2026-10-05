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
import { nextTick, ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NButton, NSpace, NSpin, NText } from 'naive-ui'
import { BusinessError, HttpError } from '@/shared/api'
import { accessToken } from '@/shared/tokenManager'
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

let session: VideoPlayerSession | null = null

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
    :title="video ? `${t('coursework.player.title')} - ${video.title}` : t('coursework.player.title')"
    @update:show="emit('update:show', $event)"
  >
    <div class="player-wrap">
      <video
        ref="videoEl"
        class="player-video"
        controls
        playsinline
        preload="auto"
        @timeupdate="handleTimeUpdate"
        @seeking="handleSeeking"
      ></video>

      <div v-if="failure" class="player-mask">
        <NText>{{ t(failureMessageKey(failure.kind)) }}</NText>
        <NButton size="small" type="primary" @click="handleRetry">
          {{ t('coursework.player.retry') }}
        </NButton>
      </div>
      <div v-else-if="phase === 'connecting' || phase === 'buffering'" class="player-mask">
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
