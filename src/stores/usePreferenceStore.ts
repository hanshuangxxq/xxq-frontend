import { ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/modules/auth/api'
import type { UserPreferences } from '@/modules/auth/types'
import { useThemeStore, readStoredTheme, THEME_MODES, type ThemeMode } from '@/stores/useThemeStore'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n'

/** 内置默认值:远端偏好缺失对应 key 时兜底 */
const DEFAULTS = {
  sidebarCollapsed: false,
}

/** 主题冲突:本机主动设置的主题与远端不一致时,记录两端取值等用户选择 */
export interface ThemeConflict {
  local: ThemeMode
  remote: ThemeMode
}

/**
 * 用户个性化偏好(侧边栏展开、主题模式、界面语言等),统一存储在后端(/api/preferences/me)。
 * 登录后 load() 拉取并覆盖合并到默认值;每次变更只 PUT 修改的字段(浅合并)。
 * 主题例外地同时持久化在 localStorage(首帧防闪屏):远端与本机不一致时弹窗让用户选择。
 * 语言不做本地持久化:默认跟随系统语言,远端有设置时以远端为准。
 */
export const usePreferenceStore = defineStore('preference', () => {
  const themeStore = useThemeStore()
  const localeStore = useLocaleStore()

  const sidebarCollapsed = ref(DEFAULTS.sidebarCollapsed)
  /** 是否已完成远端加载;加载完成前不同步,避免把默认值当作用户意愿写入 */
  const loaded = ref(false)
  /** 待用户裁决的主题冲突;非 null 时界面弹窗询问 */
  const themeConflict = ref<ThemeConflict | null>(null)

  /** 浅合并保存,失败静默(下次变更会再次带上最新值) */
  function save(patch: UserPreferences) {
    if (!loaded.value) return
    authApi.updatePreferences(patch).catch(() => {})
  }

  /** 拉取远端偏好,合并到默认值上;后端从未设置时会返回 {}。幂等:已成功加载过则跳过 */
  async function load() {
    if (loaded.value) return
    try {
      const prefs = await authApi.getPreferences()
      sidebarCollapsed.value = prefs.sidebarCollapsed ?? DEFAULTS.sidebarCollapsed

      // 主题:首帧已按本机存储渲染。远端有设置且与本机主动设置不一致时,保留本机
      // 主题并记录冲突交给弹窗裁决;本机未设置过时直接采用远端;远端未设置过时
      // 把本机设置回写远端(本机设置即用户意愿)
      const remoteTheme = THEME_MODES.includes(prefs.theme as ThemeMode)
        ? (prefs.theme as ThemeMode)
        : null
      const storedTheme = readStoredTheme()
      if (remoteTheme) {
        if (storedTheme && storedTheme !== remoteTheme) {
          themeConflict.value = { local: storedTheme, remote: remoteTheme }
        } else if (remoteTheme !== themeStore.mode) {
          themeStore.setMode(remoteTheme)
        }
      } else if (storedTheme) {
        authApi.updatePreferences({ theme: storedTheme }).catch(() => {})
      }

      // 语言:远端有设置时以远端为准;否则保持系统语言(store 初始值已按浏览器语言探测)
      const lang = SUPPORTED_LOCALES.includes(prefs.lang as SupportedLocale)
        ? (prefs.lang as SupportedLocale)
        : null
      if (lang && lang !== localeStore.current) localeStore.setLocale(lang)
    } catch {
      // 拉取失败(如网络异常)时使用默认值,不影响页面使用
    } finally {
      loaded.value = true
    }
  }

  /** 裁决主题冲突:useRemote 采用远端主题(并写入本机);否则保留本机主题并回写远端 */
  function resolveThemeConflict(useRemote: boolean) {
    const conflict = themeConflict.value
    if (!conflict) return
    themeConflict.value = null
    if (useRemote) {
      themeStore.setMode(conflict.remote)
    } else {
      save({ theme: conflict.local })
    }
  }

  function setSidebarCollapsed(value: boolean) {
    sidebarCollapsed.value = value
    save({ sidebarCollapsed: value })
  }

  function setTheme(mode: ThemeMode) {
    themeStore.setMode(mode)
    save({ theme: mode })
  }

  function setLang(locale: SupportedLocale) {
    localeStore.setLocale(locale)
    save({ lang: locale })
  }

  /** 退出登录/布局卸载时重置本地状态(主题与语言保留,下次登录的 load 会覆盖) */
  function reset() {
    loaded.value = false
    sidebarCollapsed.value = DEFAULTS.sidebarCollapsed
    themeConflict.value = null
  }

  return {
    sidebarCollapsed,
    loaded,
    themeConflict,
    load,
    resolveThemeConflict,
    setSidebarCollapsed,
    setTheme,
    setLang,
    reset,
  }
})
