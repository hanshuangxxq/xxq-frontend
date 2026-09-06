<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NButton } from 'naive-ui'
import ForbiddenState from '@/shared/components/ForbiddenState.vue'
import { getLastVisitedPath } from '@/shared/utils/lastVisitedPage'

const router = useRouter()

/** 返回进入 403 之前访问的页面;无记录(如新开标签页直接输入地址)时回首页兜底 */
function goBack() {
  router.push(getLastVisitedPath() ?? '/')
}
</script>

<template>
  <div class="forbidden-page">
    <ForbiddenState>
      <template #footer>
        <NButton type="primary" @click="goBack">{{ $t('not-found.back') }}</NButton>
      </template>
    </ForbiddenState>
  </div>
</template>

<style scoped src="./ForbiddenPage.css"></style>
