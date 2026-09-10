<script setup lang="ts">
import { NSpin } from 'naive-ui'

/** 数据加载中占位:居中 spinner + 提示文字,用于页面/卡片等待后端数据时展示 */
defineProps<{ description?: string }>()
</script>

<template>
  <div class="loading-state">
    <NSpin size="medium" />
    <p class="loading-state-text">{{ description ?? $t('common.loading') }}</p>
  </div>
</template>

<style scoped src="./LoadingState.css"></style>
