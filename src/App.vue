<script setup lang="ts">
import { computed } from 'vue'
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { useLocaleStore } from '@/stores/useLocaleStore'

const localeStore = useLocaleStore()
const naiveCfg = computed(() => localeStore.naiveConfig())
</script>

<template>
  <NConfigProvider :locale="naiveCfg.locale" :date-locale="naiveCfg.dateLocale">
    <NMessageProvider>
      <RouterView />
    </NMessageProvider>
  </NConfigProvider>
</template>
