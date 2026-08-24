import { computed } from 'vue'
import { createDiscreteApi, darkTheme, type MessageApi } from 'naive-ui'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { darkThemeOverrides, lightThemeOverrides } from '@/theme'

let messageApi: MessageApi | null = null

function createMessage(): MessageApi {
  const { message } = createDiscreteApi(['message'], {
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
  return message
}

/**
 * 脱离组件树的 message 实例(供 api 层等非组件场景使用)。
 * 通过响应式 configProviderProps 让 toast 跟随主题与语言切换。
 * 注意:组件内请继续使用 useMessage()(由 App.vue 的 NMessageProvider 提供)。
 *
 * 惰性创建:createDiscreteApi 的内部应用一旦创建就会立即渲染并求值
 * configProviderProps;若在模块导入期执行,Pinia 尚未激活会直接抛错导致
 * 应用白屏。api 调用只发生在运行时(Pinia 就绪后),因此首次访问时再创建。
 */
export const message: MessageApi = new Proxy({} as MessageApi, {
  get(_target, prop: string | symbol) {
    messageApi ??= createMessage()
    const value = messageApi[prop as keyof MessageApi]
    return typeof value === 'function' ? value.bind(messageApi) : value
  },
})
