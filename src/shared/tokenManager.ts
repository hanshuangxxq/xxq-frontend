import { ref } from 'vue'

/**
 * Token 管理器:access/refresh token 与当前用户 id 的唯一权威来源。
 * token 以 ref 形式暴露(供 api 层响应式读取),同时持久化到 localStorage,
 * 页面刷新后从这里恢复登录态。刷新逻辑由 auth store 通过 setPerformRefresh 注入,
 * 避免 tokenManager 反向依赖 auth 模块造成循环引用。
 */

const ACCESS_KEY = 'xxq-access-token'
const REFRESH_KEY = 'xxq-refresh-token'
const USER_ID_KEY = 'xxq-user-id'

/** 读 localStorage;隐私模式等禁用场景返回 null 而不是抛错 */
function loadStr(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 写/删 localStorage(value 为 null 时删除);失败静默忽略 */
function saveStr(key: string, value: string | null) {
  try {
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // localStorage unavailable
  }
}

function loadNum(key: string): number | null {
  const raw = loadStr(key)
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function saveNum(key: string, value: number | null) {
  saveStr(key, value !== null ? String(value) : null)
}

/** 当前 access token;api 层每次请求从这里取,刷新后自动生效 */
export const accessToken = ref<string | null>(loadStr(ACCESS_KEY))
/** 当前 refresh token;main.ts 据此判断是否存在可恢复的会话 */
export const refreshToken = ref<string | null>(loadStr(REFRESH_KEY))
/** 当前登录用户 id */
export const currentUserId = ref<number | null>(loadNum(USER_ID_KEY))

/** 刷新结果:成功 / 认证失败(需登出) / 网络或服务器错误(保留会话稍后重试) */
export type RefreshOutcome = 'success' | 'auth_failed' | 'network_error'

let _performRefresh: (() => Promise<RefreshOutcome>) | null = null
/** 进行中的刷新 Promise,用于并发请求共享同一次刷新(防止 401 风暴时重复刷新) */
let _refreshPromise: Promise<RefreshOutcome> | null = null

/** 由 auth store 注入实际的刷新实现(模块初始化时调用一次) */
export function setPerformRefresh(fn: () => Promise<RefreshOutcome>) {
  _performRefresh = fn
}

/** 登录/刷新成功后写入新 token 并持久化 */
export function setTokens(access: string, refresh: string, userId: number) {
  accessToken.value = access
  refreshToken.value = refresh
  currentUserId.value = userId
  saveStr(ACCESS_KEY, access)
  saveStr(REFRESH_KEY, refresh)
  saveNum(USER_ID_KEY, userId)
}

/** 清空全部会话状态(token、用户 id、缓存的用户信息) */
export function clearTokens() {
  accessToken.value = null
  refreshToken.value = null
  currentUserId.value = null
  saveStr(ACCESS_KEY, null)
  saveStr(REFRESH_KEY, null)
  saveNum(USER_ID_KEY, null)
  clearUser()
}

const USER_KEY = 'xxq-user'

/** 持久化用户会话信息(JSON),供刷新页面后免请求恢复用户基本资料 */
export function saveUser(user: unknown) {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  } catch {
    // localStorage unavailable
  }
}

/** 读取持久化的用户会话信息;无缓存或 JSON 损坏时返回 null */
export function loadUser(): unknown {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function clearUser() {
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    // localStorage unavailable
  }
}

/**
 * 执行 token 刷新(由 api 层在 401 时调用)。
 * 并发调用共享同一次刷新:第一个调用真正发起请求,其余等待同一 Promise。
 * 未注入刷新实现时直接返回 auth_failed。
 */
export async function refreshAccessToken(): Promise<RefreshOutcome> {
  if (!_performRefresh) return 'auth_failed'
  if (!_refreshPromise) {
    _refreshPromise = _performRefresh().finally(() => {
      _refreshPromise = null
    })
  }
  return _refreshPromise
}
