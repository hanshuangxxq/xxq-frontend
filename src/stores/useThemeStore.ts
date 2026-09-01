import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system']

const THEME_STORAGE_KEY = 'xxq-theme'

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

/** 读取本机持久化的主题模式;未设置或值非法时返回 null */
export function readStoredTheme(): ThemeMode | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    return THEME_MODES.includes(raw as ThemeMode) ? (raw as ThemeMode) : null
  } catch {
    return null
  }
}

function storeTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // localStorage unavailable
  }
}

/**
 * 主题模式。本机持久化到 localStorage:启动时同步读取,首帧即按用户主动设置渲染,
 * 不等后端偏好返回,避免闪屏;未设置过则跟随系统。登录后由 usePreferenceStore
 * 对比远端偏好,不一致时弹窗让用户选择以哪端为准。
 */
export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readStoredTheme() ?? 'system')
  const systemDark = ref(mediaQuery.matches)

  mediaQuery.addEventListener('change', (e) => {
    systemDark.value = e.matches
  })

  /** 实际生效的暗色状态:system 模式跟随操作系统 */
  const isDark = computed(() =>
    mode.value === 'system' ? systemDark.value : mode.value === 'dark',
  )

  function setMode(next: ThemeMode) {
    mode.value = next
    storeTheme(next)
  }

  // 同步 <html> 的 dark class,驱动 global.css 的 CSS 变量切换
  watch(
    isDark,
    (dark) => {
      document.documentElement.classList.toggle('dark', dark)
    },
    { immediate: true },
  )

  return { mode, isDark, setMode }
})
