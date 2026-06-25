<script setup lang="ts">
import { NConfigProvider, NSpace, NButton } from 'naive-ui'
import { useLocaleStore } from '@/stores/useLocaleStore'

const localeStore = useLocaleStore()
const naiveCfg = localeStore.naiveConfig()

function toggleLocale() {
  const next = localeStore.current === 'zh-CN' ? 'en' : 'zh-CN'
  localeStore.setLocale(next)
}
</script>

<template>
  <NConfigProvider :locale="naiveCfg.locale" :date-locale="naiveCfg.dateLocale">
    <NSpace vertical>
      <NButton @click="toggleLocale">
        {{ localeStore.current === 'zh-CN' ? 'Switch to English' : '切换到中文' }}
      </NButton>
      <h1>{{ $t('common.app.title') }}</h1>
      <p>{{ $t('common.app.welcome') }}</p>
    </NSpace>
  </NConfigProvider>
</template>
