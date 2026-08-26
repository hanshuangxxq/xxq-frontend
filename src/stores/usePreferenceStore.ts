import { ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/modules/auth/api'
import type { UserPreferences } from '@/modules/auth/types'
import { useThemeStore, type ThemeMode } from '@/stores/useThemeStore'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n'

const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system']

/** 内置默认值:远端偏好缺失对应 key 时兜底 */
const DEFAULTS = {
  sidebarCollapsed: false,
  theme: 'system' as ThemeMode,
  lang: 'zh-CN' as SupportedLocale,
}

/**
 * 用户个性化偏好(侧边栏展开、主题模式、界面语言等),统一存储在后端(/api/preferences/me)。
 * 登录后 load() 拉取并覆盖合并到默认值;每次变更只 PUT 修改的字段(浅合并)。
 * 不做任何本地缓存。
 */
export const usePreferenceStore = defineStore('preference', () => {
  const themeStore = useThemeStore()
  const localeStore = useLocaleStore()

  const sidebarCollapsed = ref(DEFAULTS.sidebarCollapsed)
  /** 是否已完成远端加载;加载完成前不同步,避免把默认值当作用户意愿写入 */
  const loaded = ref(false)

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
      const theme = THEME_MODES.includes(prefs.theme as ThemeMode)
        ? (prefs.theme as ThemeMode)
        : DEFAULTS.theme
      if (theme !== themeStore.mode) themeStore.setMode(theme)
      const lang = SUPPORTED_LOCALES.includes(prefs.lang as SupportedLocale)
        ? (prefs.lang as SupportedLocale)
        : DEFAULTS.lang
      if (lang !== localeStore.current) localeStore.setLocale(lang)
    } catch {
      // 拉取失败(如网络异常)时使用默认值,不影响页面使用
    } finally {
      loaded.value = true
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
  }

  return { sidebarCollapsed, loaded, load, setSidebarCollapsed, setTheme, setLang, reset }
})
