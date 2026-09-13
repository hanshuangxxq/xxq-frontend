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

/**
 * 认证 store:当前用户会话的唯一权威来源(角色、资料、登录态)。
 * - 初始化时从 localStorage 恢复上次会话(token 本身由 @/shared/tokenManager 管理)
 * - 通过 setPerformRefresh 向 tokenManager 注入刷新实现,api 层 401 时自动换新 token
 * - 登出分两步:logout() 通知后端,clearSession() 在跳转登录页后清空本地会话
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserSession | null>(null)

  const savedUser = loadUser() as UserSession | null
  if (savedUser && savedUser.userId) {
    user.value = savedUser
  }

  const isLoggedIn = computed(() => user.value !== null)

  /** 登出流程进行中:路由守卫据此允许已登录用户进入 /login,以便先跳转再清理会话 */
  const isLoggingOut = ref(false)

  /**
   * 执行 token 刷新(注入 tokenManager 的实现,不对外使用)。
   * 网络/服务器错误保留会话(后端可能在重启);仅认证失败才清空会话。
   */
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

  /** 登录:成功后写入会话、token 并持久化用户资料 */
  async function login(params: LoginParams) {
    const session = await authApi.login(params)
    user.value = session
    setTokens(session.accessToken, session.refreshToken, session.userId)
    saveUser(session)
  }

  /** 通知后端登出;即使请求失败(如后端不可达)也要继续本地登出流程 */
  async function logout() {
    isLoggingOut.value = true
    try {
      await authApi.logout()
    } catch {
      // 忽略登出接口错误,本地会话仍会清空
    }
  }

  /**
   * 清空本地会话(用户与 token)。
   * 必须在跳转到登录页之后再调用:若跳转前清空用户,当前页面的角色守卫会因角色消失
   * 而短暂渲染「无权限」页面。
   */
  function clearSession() {
    user.value = null
    clearTokens()
    isLoggingOut.value = false
  }

  /** 用户资料变更后(如改头像/改名)重新持久化到 localStorage */
  function persistUser() {
    if (user.value) saveUser(user.value)
  }

  return { user, isLoggedIn, isLoggingOut, login, logout, clearSession, persistUser }
})
