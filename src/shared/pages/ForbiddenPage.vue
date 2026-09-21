<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NButton } from 'naive-ui'
import ForbiddenState from '@/shared/components/ForbiddenState.vue'
import { goBackOrFallback } from '@/shared/utils/lastVisitedPage'

const router = useRouter()

/** 返回上一页:优先回退浏览器历史(可回到静态落地页等站外来源),无历史时回应用内来源页/首页 */
function goBack() {
  goBackOrFallback(router)
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
