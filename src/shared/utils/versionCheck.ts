import { message } from '@/shared/discrete'
import i18n from '@/i18n'

const CHECK_INTERVAL = 5 * 60 * 1000 // 定时轮询间隔:5 分钟
const MIN_RECHECK_GAP = 60 * 1000 // 页面切回前台时,距上次检查不足 1 分钟则跳过
const STARTUP_CHECK_TIMEOUT = 3000 // 启动时版本检查的超时时间,避免弱网阻塞应用启动
const RELOAD_GUARD_KEY = 'app-version-reload-guard'
const MAX_RELOAD_ATTEMPTS = 2 // 同一目标版本最多强制刷新次数,防止缓存未同步导致无限刷新

let timer: number | undefined
let lastCheckAt = 0

async function fetchServerVersion(signal?: AbortSignal): Promise<string | null> {
  try {
    // cache: 'no-store' + 时间戳参数双保险,绕过浏览器与中间代理的缓存
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: string }
    return data.version ?? null
  } catch {
    return null // 网络异常/超时时静默,由调用方决定后续
  }
}

/**
 * 刷新循环守卫:强制刷新后若仍被(浏览器/代理)缓存喂旧版本,
 * 同一目标版本重试 MAX_RELOAD_ATTEMPTS 次后放弃刷新,继续运行旧版
 */
function canReloadFor(targetVersion: string): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_GUARD_KEY)
    const guard = raw ? (JSON.parse(raw) as { version: string; attempts: number }) : null
    if (!guard || guard.version !== targetVersion) {
      sessionStorage.setItem(
        RELOAD_GUARD_KEY,
        JSON.stringify({ version: targetVersion, attempts: 1 }),
      )
      return true
    }
    if (guard.attempts >= MAX_RELOAD_ATTEMPTS) return false
    guard.attempts += 1
    sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify(guard))
    return true
  } catch {
    return true
  }
}

function clearReloadGuard() {
  try {
    sessionStorage.removeItem(RELOAD_GUARD_KEY)
  } catch {
    /* sessionStorage 不可用时忽略 */
  }
}

/**
 * 启动时版本校验(阻塞,带超时),覆盖「关闭浏览器后重新打开」与「手动刷新」场景:
 * 这两种场景浏览器都可能从缓存加载旧页面,此处检测到版本不一致即自动强制刷新换新版本。
 * 返回 true 表示已发起刷新,调用方不应继续启动旧版应用;版本一致/检查失败返回 false。
 */
export async function ensureLatestVersion(): Promise<boolean> {
  if (import.meta.env.DEV) return false
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), STARTUP_CHECK_TIMEOUT)
  try {
    const serverVersion = await fetchServerVersion(controller.signal)
    if (!serverVersion) return false
    if (serverVersion === __APP_VERSION__) {
      clearReloadGuard()
      return false
    }
    if (!canReloadFor(serverVersion)) return false
    window.location.reload()
    return true
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function checkForUpdate() {
  lastCheckAt = Date.now()
  const serverVersion = await fetchServerVersion()
  if (!serverVersion || serverVersion === __APP_VERSION__) return
  stopVersionCheck()
  // 自动更新:短暂提示让用户知晓页面即将刷新
  if (canReloadFor(serverVersion)) {
    message.loading(i18n.global.t('common.version.updating'), { duration: 1500 })
    window.setTimeout(() => window.location.reload(), 1500)
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && Date.now() - lastCheckAt >= MIN_RECHECK_GAP) {
    void checkForUpdate()
  }
}

function stopVersionCheck() {
  window.clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
}

/** 页面长期打开时的后台检测:定时轮询 + 切回前台时检查,发现新版本自动刷新(仅生产构建) */
export function startVersionCheck() {
  if (import.meta.env.DEV) return
  timer = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL)
  document.addEventListener('visibilitychange', onVisibilityChange)
}
