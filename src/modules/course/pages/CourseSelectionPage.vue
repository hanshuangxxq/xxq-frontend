<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NCard, NSpace, NEmpty } from 'naive-ui'

const { t } = useI18n()
</script>

<template>
  <div style="padding: 24px">
    <NSpace vertical :size="16">
      <NCard :title="$t('course.title')">
        <NEmpty :description="$t('course.noCourses')" />
      </NCard>
    </NSpace>
  </div>
</template>
