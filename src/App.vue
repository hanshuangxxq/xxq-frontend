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

const localeStore = useLocaleStore()
const themeStore = useThemeStore()
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
