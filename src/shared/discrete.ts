import { computed } from 'vue'
import { createDiscreteApi, darkTheme } from 'naive-ui'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { darkThemeOverrides, lightThemeOverrides } from '@/theme'

/**
 * 脱离组件树的 message 实例(供 api 层等非组件场景使用)。
 * 通过响应式 configProviderProps 让 toast 跟随主题与语言切换。
 * 注意:组件内请继续使用 useMessage()(由 App.vue 的 NMessageProvider 提供)。
 */
export const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => {
    const themeStore = useThemeStore()
    const localeStore = useLocaleStore()
    const naiveCfg = localeStore.naiveConfig()
    return {
      theme: themeStore.isDark ? darkTheme : null,
      themeOverrides: themeStore.isDark ? darkThemeOverrides : lightThemeOverrides,
      locale: naiveCfg.locale,
      dateLocale: naiveCfg.dateLocale,
    }
  }),
})
