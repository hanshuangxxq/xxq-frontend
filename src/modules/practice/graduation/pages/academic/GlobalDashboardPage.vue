<script setup lang="ts">
import { ref } from 'vue'
import { NCard, NResult } from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import DashboardContent from '../../components/DashboardContent.vue'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'

const { isAcademicAdmin } = useRoleCheck()

const campaignId = ref<number | null>(null)
</script>

<template>
  <div class="graduation-page">
    <NResult
      v-if="!isAcademicAdmin"
      status="403"
      :title="$t('graduation.common.noPermission')"
      :description="$t('graduation.common.noPermissionDesc')"
    />
    <template v-else>
      <NCard class="context-card">
        <CampaignContextSelector v-model:campaign-id="campaignId" />
      </NCard>

      <NCard :title="$t('graduation.academic.globalDashboardTitle')" class="content-card">
        <DashboardContent :campaign-id="campaignId" show-college-filter />
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./GlobalDashboardPage.css"></style>
