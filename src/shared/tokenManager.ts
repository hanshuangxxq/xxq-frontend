import { ref } from 'vue'

const ACCESS_KEY = 'xxq-access-token'
const REFRESH_KEY = 'xxq-refresh-token'
const USER_ID_KEY = 'xxq-user-id'

function loadStr(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

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

export const accessToken = ref<string | null>(loadStr(ACCESS_KEY))
export const refreshToken = ref<string | null>(loadStr(REFRESH_KEY))
export const currentUserId = ref<number | null>(loadNum(USER_ID_KEY))

let _performRefresh: (() => Promise<boolean>) | null = null
let _refreshPromise: Promise<boolean> | null = null

export function setPerformRefresh(fn: () => Promise<boolean>) {
  _performRefresh = fn
}

export function setTokens(access: string, refresh: string, userId: number) {
  accessToken.value = access
  refreshToken.value = refresh
  currentUserId.value = userId
  saveStr(ACCESS_KEY, access)
  saveStr(REFRESH_KEY, refresh)
  saveNum(USER_ID_KEY, userId)
}

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

export async function refreshAccessToken(): Promise<boolean> {
  if (!_performRefresh) return false
  if (!_refreshPromise) {
    _refreshPromise = _performRefresh().finally(() => {
      _refreshPromise = null
    })
  }
  return _refreshPromise
}
