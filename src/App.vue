<script setup lang="ts">
/**
 * 应用根组件:向 Naive UI 注入语言/主题配置,并挂载全局单例组件
 * (路由出口、主题冲突弹窗、全局加载指示)。
 */
import { computed } from 'vue'
import { NConfigProvider, NMessageProvider, darkTheme } from 'naive-ui'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { darkThemeOverrides, lightThemeOverrides } from '@/theme'
import ThemeConflictDialog from '@/modules/layout/components/ThemeConflictDialog.vue'
import GlobalLoading from '@/shared/components/GlobalLoading.vue'
import { useDocumentHead } from '@/shared/composables/useDocumentHead'

const localeStore = useLocaleStore()
const themeStore = useThemeStore()

// 按路由 meta.titleKey 与界面语言同步 <title> 与 <html lang>(纯静态 SPA 无 SSR,
// 登录后页面统一 noindex,这里服务于标签页/书签/读屏,详见 useDocumentHead 注释)
useDocumentHead()
const naiveCfg = computed(() => localeStore.naiveConfig())
const naiveTheme = computed(() => (themeStore.isDark ? darkTheme : null))
const themeOverrides = computed(() =>
  themeStore.isDark ? darkThemeOverrides : lightThemeOverrides,
)
</script>

<template>
  <NConfigProvider
    :locale="naiveCfg.locale"
    :date-locale="naiveCfg.dateLocale"
    :theme="naiveTheme"
    :theme-overrides="themeOverrides"
  >
    <NMessageProvider>
      <RouterView />
      <ThemeConflictDialog />
      <GlobalLoading />
    </NMessageProvider>
  </NConfigProvider>
</template>
