<script setup lang="ts">
import { ref } from 'vue'
import { NCard } from 'naive-ui'
import ForbiddenState from '@/shared/components/ForbiddenState.vue'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import DashboardContent from '../../components/DashboardContent.vue'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'

const { isAcademicAdmin } = useRoleCheck()

const campaignId = ref<number | null>(null)
</script>

<template>
  <div class="graduation-page">
    <ForbiddenState v-if="!isAcademicAdmin" />
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
