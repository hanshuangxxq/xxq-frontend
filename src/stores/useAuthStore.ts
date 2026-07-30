import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/modules/auth/api'
import type { UserSession, LoginParams } from '@/modules/auth/types'
import {
  refreshToken,
  setTokens,
  clearTokens,
  setPerformRefresh,
  saveUser,
  loadUser,
  type RefreshOutcome,
} from '@/shared/tokenManager'
import { ApiNetworkError, HttpError } from '@/shared/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserSession | null>(null)

  const savedUser = loadUser() as UserSession | null
  if (savedUser && savedUser.userId) {
    user.value = savedUser
  }

  const isLoggedIn = computed(() => user.value !== null)

  async function doRefresh(): Promise<RefreshOutcome> {
    const rt = refreshToken.value
    if (!rt) return 'auth_failed'
    try {
      const result = await authApi.refresh(rt)
      setTokens(result.accessToken, result.refreshToken, result.userId)
      if (user.value) {
        user.value = {
          ...user.value,
          userId: result.userId,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        }
      }
      return 'success'
    } catch (e) {
      if (e instanceof ApiNetworkError) {
        // 后端暂时不可达(如重启中):保留 token,后续可重试,不登出
        return 'network_error'
      }
      if (e instanceof HttpError && e.status >= 500) {
        // 服务器错误(如重启后半就绪):保留 token,稍后重试,不登出
        return 'network_error'
      }
      // 认证失败(refresh token 无效等,401 或业务错误):登出
      user.value = null
      clearTokens()
      return 'auth_failed'
    }
  }

  setPerformRefresh(doRefresh)

  async function login(params: LoginParams) {
    const session = await authApi.login(params)
    user.value = session
    setTokens(session.accessToken, session.refreshToken, session.userId)
    saveUser(session)
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      user.value = null
      clearTokens()
    }
  }

  function persistUser() {
    if (user.value) saveUser(user.value)
  }

  return { user, isLoggedIn, login, logout, persistUser }
})
