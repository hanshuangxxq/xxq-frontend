<script setup lang="ts">
/** 院系-本院看板:查看本院系学生的选题/匹配/中期进展,数据范围由后端按院系身份过滤,展示由 DashboardContent 承载 */
import { ref } from 'vue'
import { NCard } from 'naive-ui'
import ForbiddenState from '@/shared/components/ForbiddenState.vue'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import DashboardContent from '../../components/DashboardContent.vue'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'

const { isDepartment } = useRoleCheck()

const campaignId = ref<number | null>(null)
</script>

<template>
  <div class="graduation-page">
    <ForbiddenState v-if="!isDepartment" />
    <template v-else>
      <NCard class="context-card">
        <CampaignContextSelector v-model:campaign-id="campaignId" />
      </NCard>

      <NCard :title="$t('graduation.dept.dashboardTitle')" class="content-card">
        <DashboardContent
          :campaign-id="campaignId"
          :scope-label="$t('graduation.dept.myCollegeScope')"
        />
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./DeptDashboardPage.css"></style>
