<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NButton, NResult } from 'naive-ui'
import { goBackOrFallback } from '@/shared/utils/lastVisitedPage'

const router = useRouter()

/** 返回上一页:优先回退浏览器历史(可回到静态落地页等站外来源),无历史时回应用内来源页/首页 */
function goBack() {
  goBackOrFallback(router)
}
</script>

<template>
  <div class="not-found-page">
    <NResult status="404" :title="$t('not-found.title')" :description="$t('not-found.description')">
      <template #icon>
        <div class="not-found-visual">
          <img class="not-found-logo" src="/favicon.ico" :alt="$t('common.app.title')" />
          <span class="not-found-code">404</span>
        </div>
      </template>
      <template #footer>
        <NButton type="primary" @click="goBack">{{ $t('not-found.back') }}</NButton>
      </template>
    </NResult>
  </div>
</template>

<style scoped src="./NotFoundPage.css"></style>
