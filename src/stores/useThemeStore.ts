import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

/**
 * 主题模式。不做本地持久化:登录后由 usePreferenceStore 从后端拉取并 setMode,
 * 用户修改也经 usePreferenceStore.setTheme 同步到后端。
 */
export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('system')
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
