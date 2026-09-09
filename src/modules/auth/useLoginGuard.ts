import { ref, computed, onUnmounted } from 'vue'

const STORAGE_KEY = 'xxq-login-guard'
/** 连续失败多少次后触发临时锁定 */
const MAX_FAILURES = 5
/** 锁定时长(秒),按锁定次数逐级递增,超过档位后按最后一档 */
const LOCK_DURATIONS = [30, 60, 120, 300]

interface LoginGuardState {
  /** 当前连续失败次数,达到 MAX_FAILURES 后归零并触发锁定 */
  failures: number
  /** 已触发过的锁定次数,用于递增锁定时长 */
  lockLevel: number
  /** 锁定截止时间戳(ms),0 表示未锁定 */
  lockUntil: number
}

const initialState: LoginGuardState = { failures: 0, lockLevel: 0, lockUntil: 0 }

function loadState(): LoginGuardState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...initialState }
    const parsed = JSON.parse(raw) as Partial<LoginGuardState>
    return {
      failures: typeof parsed.failures === 'number' ? parsed.failures : 0,
      lockLevel: typeof parsed.lockLevel === 'number' ? parsed.lockLevel : 0,
      lockUntil: typeof parsed.lockUntil === 'number' ? parsed.lockUntil : 0,
    }
  } catch {
    return { ...initialState }
  }
}

function saveState(state: LoginGuardState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 隐私模式等场景下 sessionStorage 可能不可用,降级为仅内存生效
  }
}

/**
 * 登录防爆破守卫:
 * - 连续失败 MAX_FAILURES 次后临时锁定,锁定时长按次数递增(30s → 60s → 120s → 300s)
 * - 状态持久化到 sessionStorage,刷新页面不会重置锁定
 * - 登录成功后清零
 *
 * 注意:前端限流只是交互层防护,真正的防爆破必须依赖后端登录接口的限流/验证码。
 */
export function useLoginGuard() {
  const state = ref<LoginGuardState>(loadState())
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined

  const lockedSeconds = computed(() =>
    Math.max(0, Math.ceil((state.value.lockUntil - now.value) / 1000)),
  )
  const isLocked = computed(() => lockedSeconds.value > 0)

  function stopTimer() {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  function startTimer() {
    if (timer !== undefined) return
    timer = setInterval(() => {
      now.value = Date.now()
      if (!isLocked.value) stopTimer()
    }, 500)
  }

  // 从 sessionStorage 恢复时若仍在锁定期内,立即启动倒计时
  if (isLocked.value) startTimer()

  /** 记录一次登录失败,达到阈值后进入锁定;返回剩余锁定秒数(0 表示未锁定) */
  function recordFailure(): number {
    const next = { ...state.value, failures: state.value.failures + 1 }
    if (next.failures >= MAX_FAILURES) {
      const duration = LOCK_DURATIONS[Math.min(next.lockLevel, LOCK_DURATIONS.length - 1)] ?? 300
      next.failures = 0
      next.lockLevel += 1
      next.lockUntil = Date.now() + duration * 1000
      now.value = Date.now()
      startTimer()
    }
    state.value = next
    saveState(next)
    return lockedSeconds.value
  }

  /** 登录成功:清空失败计数与锁定状态 */
  function recordSuccess() {
    stopTimer()
    state.value = { ...initialState }
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // 同 saveState,忽略存储异常
    }
  }

  onUnmounted(stopTimer)

  return { isLocked, lockedSeconds, recordFailure, recordSuccess }
}
