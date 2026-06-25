import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/modules/auth/api'
import type { UserSession, LoginParams, RegisterParams } from '@/modules/auth/types'

const SESSION_KEY = 'xxq-session'

function loadSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as UserSession) : null
  } catch {
    return null
  }
}

function saveSession(session: UserSession | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(SESSION_KEY)
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserSession | null>(loadSession())

  const isLoggedIn = computed(() => user.value !== null)

  async function login(params: LoginParams) {
    user.value = await authApi.login(params)
    saveSession(user.value)
  }

  async function register(params: RegisterParams) {
    await authApi.register(params)
  }

  async function logout() {
    if (user.value) {
      try {
        await authApi.logout(user.value.tokenId)
      } finally {
        user.value = null
        saveSession(null)
      }
    }
  }

  return { user, isLoggedIn, login, register, logout }
})
