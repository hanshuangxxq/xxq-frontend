<script setup lang="ts">
import { computed } from 'vue'
import { NConfigProvider, NMessageProvider, NSelect } from 'naive-ui'
import { useLocaleStore } from '@/stores/useLocaleStore'

const localeStore = useLocaleStore()
const naiveCfg = localeStore.naiveConfig()

const localeOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
]

const currentLocale = computed({
  get: () => localeStore.current,
  set: (v) => localeStore.setLocale(v),
})
</script>

<template>
  <NConfigProvider :locale="naiveCfg.locale" :date-locale="naiveCfg.dateLocale">
    <NMessageProvider>
      <div style="position: fixed; top: 8px; right: 16px; z-index: 1000; width: 100px">
        <NSelect v-model:value="currentLocale" :options="localeOptions" size="small" />
      </div>
      <RouterView />
    </NMessageProvider>
  </NConfigProvider>
</template>
