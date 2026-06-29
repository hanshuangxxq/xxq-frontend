import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/modules/auth/api'
import type { UserSession, LoginParams, RegisterParams } from '@/modules/auth/types'
import {
  refreshToken,
  currentUserId,
  setTokens,
  clearTokens,
  setPerformRefresh,
  saveUser,
  loadUser,
} from '@/shared/tokenManager'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserSession | null>(null)

  const savedUser = loadUser() as UserSession | null
  if (savedUser && savedUser.userId) {
    user.value = savedUser
  }

  const isLoggedIn = computed(() => user.value !== null)

  async function doRefresh(): Promise<boolean> {
    const rt = refreshToken.value
    if (!rt) return false
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
      return true
    } catch {
      user.value = null
      clearTokens()
      return false
    }
  }

  setPerformRefresh(doRefresh)

  async function login(params: LoginParams) {
    const session = await authApi.login(params)
    user.value = session
    setTokens(session.accessToken, session.refreshToken, session.userId)
    saveUser(session)
  }

  async function register(params: RegisterParams) {
    await authApi.register(params)
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

  return { user, isLoggedIn, login, register, logout, persistUser }
})
