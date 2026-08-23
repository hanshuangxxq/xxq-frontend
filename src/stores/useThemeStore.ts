import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'xxq-theme'
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

function loadFromStorage(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(loadFromStorage())
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
    localStorage.setItem(STORAGE_KEY, next)
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
