<script setup lang="ts">
import { NButton, NCard, NSpin } from 'naive-ui'
import { cancelAllRequests, loadingVisible } from '@/shared/loading'

/**
 * 全局加载指示:任何后端请求(经 @/shared/api)超过 300ms 未完成时,
 * 自动在视口底部居中浮现(顶部留给 message,避免与消息重叠);
 * 用户可随时点击取消中止全部在途请求。
 * 页面无需也不应再自行实现「等待后端数据」的加载提示。
 */
function handleCancel() {
  cancelAllRequests()
}
</script>

<template>
  <Transition name="global-loading">
    <div v-if="loadingVisible" class="global-loading" role="status" aria-live="polite">
      <NCard size="small" class="global-loading-card" :bordered="false">
        <div class="global-loading-content">
          <NSpin size="small" />
          <span class="global-loading-text">{{ $t('common.loading') }}</span>
          <NButton size="tiny" quaternary class="global-loading-cancel" @click="handleCancel">
            {{ $t('common.cancelLoading') }}
          </NButton>
        </div>
      </NCard>
    </div>
  </Transition>
</template>

<style scoped src="./GlobalLoading.css"></style>
