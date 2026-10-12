import type { LogEntry, LogTransport } from './types'

/** 待发送队列上限:后端长时间不可达时丢最旧,防内存膨胀 */
const QUEUE_MAX = 100
/** 定时 flush 间隔 */
const FLUSH_INTERVAL_MS = 15_000
/** error 入队后的合批延迟:同一故障引发的连续错误并入一批 */
const ERROR_FLUSH_DELAY_MS = 2_000
/** 正常批量上限(与后端 BATCH_MAX 一致) */
const BATCH_MAX = 20
/** fetch keepalive 请求体上限 64KB,兜底发送时压缩批量与单条体积 */
const KEEPALIVE_BATCH_MAX = 5
const KEEPALIVE_STACK_MAX = 2_000
const KEEPALIVE_BREADCRUMB_MAX = 10
const KEEPALIVE_MESSAGE_MAX = 500
/** 发送失败的重试上限,超过丢弃(日志是尽力而为,不影响业务) */
const RETRY_MAX = 3
/** 被限流(429)后的冷却时间:期间只入队不发送 */
const RATE_LIMIT_COOLDOWN_MS = 60_000

interface PendingEntry {
  entry: LogEntry
  retries: number
}

/** 待发送队列,按签名去重聚合(Map 保持插入序,键 = 去重签名) */
const pending = new Map<string, PendingEntry>()

let transport: LogTransport | null = null
let flushing = false
let errorFlushTimer: number | undefined
let cooldownUntil = 0

/** 去重签名:同类型 + 同消息 + 堆栈首行视为同一来源 */
function signatureOf(entry: LogEntry): string {
  const firstStackLine = entry.stack?.split('\n', 2)[1]?.trim() ?? ''
  return `${entry.type}|${entry.message}|${firstStackLine}`
}

/** main.ts 注入 transport 时调用一次;注册定时 flush 与页面隐藏兜底 */
export function initReporter(t: LogTransport) {
  transport = t
  window.setInterval(() => void flush('timer'), FLUSH_INTERVAL_MS)
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('visibilitychange', onVisibilityChange)
}

/** 入队:同源日志在待发送期间聚合为 count;队列满丢最旧 */
export function enqueue(entry: LogEntry) {
  const sig = signatureOf(entry)
  const existing = pending.get(sig)
  if (existing) {
    existing.entry.count += 1
    return
  }
  if (pending.size >= QUEUE_MAX) {
    const oldestKey = pending.keys().next().value
    if (oldestKey !== undefined) pending.delete(oldestKey)
  }
  pending.set(sig, { entry, retries: 0 })
  if (entry.level === 'error') scheduleErrorFlush()
}

function scheduleErrorFlush() {
  if (errorFlushTimer !== undefined) return
  errorFlushTimer = window.setTimeout(() => {
    errorFlushTimer = undefined
    void flush('timer')
  }, ERROR_FLUSH_DELAY_MS)
}

function onPageHide() {
  void flush('pagehide')
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') void flush('pagehide')
}

/** keepalive 体积压缩:截短堆栈、只留末尾面包屑,保证请求体 < 64KB */
function compact(entry: LogEntry): LogEntry {
  return {
    ...entry,
    message:
      entry.message.length > KEEPALIVE_MESSAGE_MAX
        ? entry.message.slice(0, KEEPALIVE_MESSAGE_MAX)
        : entry.message,
    stack:
      entry.stack && entry.stack.length > KEEPALIVE_STACK_MAX
        ? entry.stack.slice(0, KEEPALIVE_STACK_MAX)
        : entry.stack,
    breadcrumbs: entry.breadcrumbs?.slice(-KEEPALIVE_BREADCRUMB_MAX),
  }
}

async function flush(reason: 'timer' | 'pagehide') {
  if ((flushing && reason === 'timer') || !transport || pending.size === 0) return
  if (Date.now() < cooldownUntil) return

  const keepalive = reason === 'pagehide'
  const max = keepalive ? KEEPALIVE_BATCH_MAX : BATCH_MAX
  const batch: PendingEntry[] = []
  for (const [sig, item] of pending) {
    if (batch.length >= max) break
    pending.delete(sig)
    batch.push(item)
  }

  flushing = true
  try {
    await transport(
      { logs: batch.map((p) => (keepalive ? compact(p.entry) : p.entry)) },
      { keepalive },
    )
  } catch (e) {
    handleFailure(batch, e)
  } finally {
    flushing = false
  }
}

function handleFailure(batch: PendingEntry[], e: unknown) {
  // 被限流:进入冷却期,批次不计失败次数直接回队(解除后自然发出)。
  // 鸭子类型判断 code/status === 429:reporter 不能 import api 模块的 BusinessError/HttpError(循环引用);
  // instanceof 守卫先行,transport 若异常地 reject 非 Error 也不会在这里再抛错
  if (
    e instanceof Error &&
    ((e as { code?: unknown }).code === 429 || (e as { status?: unknown }).status === 429)
  ) {
    cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS
    requeue(batch)
    return
  }
  requeue(batch.filter((p) => ++p.retries <= RETRY_MAX))
}

function requeue(batch: PendingEntry[]) {
  for (const p of batch) {
    const sig = signatureOf(p.entry)
    const current = pending.get(sig)
    if (current) {
      // 同签名条目已在队列中(在途期间新到的):合并计数,保留较新的上下文
      current.entry.count += p.entry.count
      current.retries = Math.max(current.retries, p.retries)
      continue
    }
    // 队列满时直接丢弃,不再挤掉其他条目
    if (pending.size >= QUEUE_MAX) return
    pending.set(sig, p)
  }
}
