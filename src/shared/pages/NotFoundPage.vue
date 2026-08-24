<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NButton, NResult } from 'naive-ui'
import { getLastVisitedPath } from '@/shared/utils/lastVisitedPage'

const router = useRouter()

/** 返回进入 404 之前访问的页面;无记录(如新开标签页直接打开)时回首页兜底 */
function goBack() {
  router.push(getLastVisitedPath() ?? '/')
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
