<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NCard, NEllipsis, NProgress, NScrollbar, NSpace, NTag } from 'naive-ui'
import { formatBytes } from '@/shared/utils/format'
import { useUploadStore } from '../store'
import type { UploadStatus, UploadTask } from '../uploadTask'

/**
 * 全局上传进度面板:固定在视口右下角,任何文件分片上传在此展示进度。
 *
 * 为什么独立成面板而不是页面内联进度:
 * 一次 2GB 上传可能跑十几分钟,用户会关掉提交弹窗、切到别的路由;
 * 上传本身活得比发起它的组件久,进度指示也必须如此。
 *
 * 与 GlobalLoading 的关系:上传的所有 api 调用都显式传 loading:false,
 * 分片 PUT 走的 putBinary 也从不注册进全局加载管理,所以上传期间
 * **只会出现这一个指示器**,不会与底部居中的加载药丸重叠。
 * 反过来,点加载药丸的「取消」也不会中断正在进行的上传 —— 那是本面板的职责。
 */
const { t } = useI18n()
const store = useUploadStore()

/** 状态 -> 标签色 */
function statusType(status: UploadStatus): 'default' | 'info' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'done':
      return 'success'
    case 'failed':
      return 'error'
    case 'paused':
      return 'warning'
    case 'cancelled':
      return 'default'
    default:
      return 'info'
  }
}

/** 状态文案;秒传命中是 done 的一个特例,单独措辞 */
function statusLabel(task: UploadTask): string {
  if (task.state.status === 'done' && task.state.instant) return t('file.status.instant')
  return t(`file.status.${task.state.status}`)
}

/**
 * 进度条语义色。用 NProgress 的 status 而不是写死的十六进制色值,
 * 这样暗色模式与主题覆盖能一并生效。
 */
function progressStatus(task: UploadTask): 'default' | 'success' | 'error' {
  if (task.state.status === 'failed') return 'error'
  if (task.state.status === 'done') return 'success'
  return 'default'
}

/** 标题:有进行中的才带数量,否则只显示「文件上传」 */
const panelTitle = computed(() =>
  store.activeCount > 0
    ? t('file.panel.titleCount', { count: store.activeCount })
    : t('file.panel.title'),
)

/**
 * 是否显示进度条。哈希阶段也要显示:整文件 SHA-256 对 2GB 文件要跑几十秒,
 * 这期间的 percentage 就是哈希进度,不画条用户会以为卡死了。
 */
function showProgress(task: UploadTask): boolean {
  return (
    task.state.status === 'hashing' || task.state.totalChunks > 0 || task.state.status === 'done'
  )
}

/**
 * 进度条下方的量化信息:已处理/总量,进行中再补速度与剩余时间。
 * 哈希阶段这里走的也是已读字节数,所以文案用中性的「已处理」而非「已上传」。
 */
function metaText(task: UploadTask): string {
  const done = formatBytes(task.state.uploadedBytes)
  const total = formatBytes(task.fileSize)
  const size = t('file.panel.bytesOf', { done, total })
  if (task.state.etaSeconds !== null && task.state.speed > 0) {
    return `${size} · ${formatBytes(task.state.speed)}/s · ${t('file.panel.remaining', {
      time: formatDuration(task.state.etaSeconds),
    })}`
  }
  return size
}

function formatDuration(seconds: number): string {
  const total = Math.max(1, Math.ceil(seconds))
  if (total < 60) return t('file.panel.seconds', { n: total })
  return t('file.panel.minutes', { m: Math.floor(total / 60), s: total % 60 })
}

/** 进行中(含刚入队还没开始) */
function isActive(task: UploadTask): boolean {
  return !['done', 'failed', 'cancelled'].includes(task.state.status)
}

function isPaused(task: UploadTask): boolean {
  return task.state.status === 'paused'
}

function isFailed(task: UploadTask): boolean {
  return task.state.status === 'failed'
}
</script>

<template>
  <Transition name="upload-panel">
    <div v-if="store.hasTasks" class="upload-panel" role="status" aria-live="polite">
      <NCard size="small" class="upload-panel-card" :bordered="false">
        <template #header>
          <span class="upload-panel-title">{{ panelTitle }}</span>
        </template>
        <template #header-extra>
          <NSpace :size="4">
            <NButton size="tiny" quaternary @click="store.clearFinished()">
              {{ $t('file.panel.clearFinished') }}
            </NButton>
            <NButton size="tiny" quaternary @click="store.minimized = !store.minimized">
              {{ store.minimized ? $t('file.panel.expand') : $t('file.panel.minimize') }}
            </NButton>
          </NSpace>
        </template>

        <div v-show="!store.minimized" class="upload-panel-body">
          <NProgress
            type="line"
            :percentage="Math.round(store.overallPercentage)"
            :height="4"
            :show-indicator="false"
          />

          <NScrollbar class="upload-panel-list">
            <div v-for="task in store.tasks" :key="task.id" class="upload-row">
              <div class="upload-row-head">
                <NEllipsis class="upload-row-name">{{ task.fileName }}</NEllipsis>
                <NTag size="tiny" :type="statusType(task.state.status)" :bordered="false">
                  {{ statusLabel(task) }}
                </NTag>
              </div>

              <NProgress
                v-if="showProgress(task)"
                type="line"
                :percentage="Math.round(task.state.percentage)"
                :height="6"
                :show-indicator="false"
                :status="progressStatus(task)"
              />

              <div class="upload-row-meta">
                <span>{{ metaText(task) }}</span>
                <span v-if="task.state.note" class="upload-row-note">{{ task.state.note }}</span>
              </div>

              <NSpace :size="4" class="upload-row-actions">
                <NButton v-if="isPaused(task)" size="tiny" @click="task.resume()">
                  {{ $t('file.action.resume') }}
                </NButton>
                <NButton v-else-if="isActive(task)" size="tiny" @click="task.pause()">
                  {{ $t('file.action.pause') }}
                </NButton>
                <NButton v-if="isFailed(task)" size="tiny" @click="task.retry()">
                  {{ $t('file.action.retry') }}
                </NButton>
                <NButton v-if="isActive(task) || isPaused(task)" size="tiny" @click="task.cancel()">
                  {{ $t('file.action.cancel') }}
                </NButton>
                <NButton v-else size="tiny" @click="store.remove(task.id)">
                  {{ $t('file.action.remove') }}
                </NButton>
              </NSpace>
            </div>
          </NScrollbar>
        </div>
      </NCard>
    </div>
  </Transition>
</template>

<style scoped src="./UploadProgressPanel.css"></style>
