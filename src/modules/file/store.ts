import { computed, markRaw, ref } from 'vue'
import { defineStore } from 'pinia'
import { CHUNK_CONCURRENCY, RATE_WINDOW_LIMIT, RATE_WINDOW_MS } from './constants'
import { createUploadTask, type ChunkGate, type UploadStatus, type UploadTask } from './uploadTask'
import type { BizCode } from './types'

/** 仍在推进中的状态;上传面板据此决定是否显示进度条与操作按钮 */
const ACTIVE_STATUSES: ReadonlySet<UploadStatus> = new Set<UploadStatus>([
  'idle',
  'hashing',
  'initializing',
  'uploading',
  'merging',
])

/** 已结束的状态 */
const SETTLED_STATUSES: ReadonlySet<UploadStatus> = new Set<UploadStatus>([
  'done',
  'failed',
  'cancelled',
])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 分片上传任务队列与进度状态。
 *
 * 任务存在 store 而非页面里:一次 2GB 上传可能跑十几分钟,用户会关弹窗、切路由,
 * 上传必须活得比发起它的组件久。面板也从这里读进度。
 */
export const useUploadStore = defineStore('upload', () => {
  const tasks = ref<UploadTask[]>([])
  /** 面板是否收起(只留标题行) */
  const minimized = ref(false)

  const hasTasks = computed(() => tasks.value.length > 0)
  const activeCount = computed(
    () => tasks.value.filter((task) => ACTIVE_STATUSES.has(task.state.status)).length,
  )
  const busy = computed(() => activeCount.value > 0)

  /** 聚合进度:按字节加权,而非各任务百分比的平均 */
  const overallPercentage = computed(() => {
    let total = 0
    let sent = 0
    for (const task of tasks.value) {
      total += task.fileSize
      sent += task.state.uploadedBytes
    }
    return total > 0 ? Math.min(100, (sent / total) * 100) : 0
  })

  const totalSpeed = computed(() => tasks.value.reduce((sum, task) => sum + task.state.speed, 0))

  // ---- 全站共享的分片限流闸门 ----
  // 服务端的限流桶按账号计数,多个并发上传必须共用同一份额度,
  // 否则两个任务会各自以为自己独占 600/分钟。
  const requestTimestamps: number[] = []
  let cooldownUntil = 0

  const gate: ChunkGate = {
    async beforeChunk(): Promise<void> {
      for (;;) {
        const now = Date.now()
        if (now < cooldownUntil) {
          await sleep(cooldownUntil - now)
          continue
        }
        const oldest = requestTimestamps[0]
        // 丢弃已滑出窗口的时戳
        if (oldest !== undefined && now - oldest >= RATE_WINDOW_MS) {
          requestTimestamps.shift()
          continue
        }
        if (requestTimestamps.length < RATE_WINDOW_LIMIT) {
          requestTimestamps.push(now)
          return
        }
        // 窗口已满:等最老的一次请求滑出去
        if (oldest === undefined) return
        await sleep(oldest + RATE_WINDOW_MS - now)
      }
    },
    coolDown(delayMs: number): void {
      cooldownUntil = Math.max(cooldownUntil, Date.now() + delayMs)
    },
  }

  /**
   * 入队并立即开始。
   *
   * 同一文件(biz + 文件名 + 大小 + 修改时间)已在传时复用现有任务:
   * 重复提交会让两个任务争抢同一个确定性 uploadId,服务端能容忍(同序号幂等覆盖),
   * 但第二个任务会白算一遍整文件哈希。
   *
   * 上次失败时也复用:直接重试同一个任务,已算好的整文件哈希与已传分片都还在,
   * 能真正断点续传。若丢掉它新建任务,2GB 文件要重新哈希几十秒再从头协商。
   */
  function enqueue(file: File, biz: BizCode): UploadTask {
    const id = `${biz}:${file.name}:${file.size}:${file.lastModified}`
    const existing = tasks.value.find((task) => task.id === id)
    if (existing) {
      // 进行中:直接复用,不重复哈希
      if (!SETTLED_STATUSES.has(existing.state.status)) return existing
      // 上次失败:重试同一个任务,哈希与已传分片都还在
      if (existing.state.status === 'failed') {
        existing.retry()
        return existing
      }
      // 上次已传完:done 已 resolve,await 会立刻拿到产物,无需再传一次
      if (existing.state.status === 'done') return existing
      // 用户主动取消过:按全新任务重来,把这个 id 从列表里摘掉避免重复项
      tasks.value = tasks.value.filter((task) => task.id !== id)
    }

    const task = markRaw(createUploadTask({ file, biz, concurrency: CHUNK_CONCURRENCY, gate }))
    tasks.value.push(task)
    minimized.value = false
    return task
  }

  /** 从面板移除一条;仍在传的会先取消,避免留下无人管理的孤儿上传 */
  function remove(id: string): void {
    const task = tasks.value.find((item) => item.id === id)
    if (!task) return
    if (!SETTLED_STATUSES.has(task.state.status)) task.cancel()
    tasks.value = tasks.value.filter((item) => item.id !== id)
  }

  /** 清掉所有已结束的任务 */
  function clearFinished(): void {
    tasks.value = tasks.value.filter((task) => !SETTLED_STATUSES.has(task.state.status))
  }

  /** 取消全部进行中的任务 */
  function cancelAll(): void {
    for (const task of tasks.value) {
      if (!SETTLED_STATUSES.has(task.state.status)) task.cancel()
    }
  }

  return {
    tasks,
    minimized,
    hasTasks,
    activeCount,
    busy,
    overallPercentage,
    totalSpeed,
    enqueue,
    remove,
    clearFinished,
    cancelAll,
  }
})
