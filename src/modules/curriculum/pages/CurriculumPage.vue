<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NCard, NSpace } from 'naive-ui'

const { t } = useI18n()
</script>

<template>
  <div class="curriculum-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('curriculum.title')">
        <p>{{ $t('curriculum.empty') }}</p>
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped src="./CurriculumPage.css"></style>
