<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NButton,
  NPopconfirm,
  NSpin,
  NEmpty,
  NTag,
  NCollapse,
  NCollapseItem,
  NDescriptions,
  NDescriptionsItem,
  NDataTable,
  NAlert,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  fetchCampaign,
  fetchCampaignClasses,
  closeCampaign,
  finalizeCampaign,
  openCampaign,
} from '../api'
import type {
  Campaign,
  CampaignStatus,
  SelectionClass,
} from '../types'

const { t } = useI18n()
const message = useMessage()
const route = useRoute()
const router = useRouter()

const campaignId = computed(() => Number(route.params.id))

const loading = ref(false)
const campaign = ref<Campaign | null>(null)
const classes = ref<SelectionClass[]>([])

const statusTagType: Record<CampaignStatus, 'default' | 'info' | 'warning' | 'success'> = {
  DRAFT: 'default',
  OPEN: 'success',
  CLOSED: 'warning',
  FINALIZED: 'info',
}

function formatDateTime(s: string | null | undefined): string {
  return s ? s.replace('T', ' ') : ''
}

async function loadCampaign() {
  try {
    const res = await fetchCampaign(campaignId.value)
    campaign.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('selection.loadFail'))
  }
}

async function loadClasses() {
  try {
    const res = await fetchCampaignClasses(campaignId.value)
    classes.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('selection.loadFail'))
  }
}

async function loadAll() {
  loading.value = true
  try {
    await loadCampaign()
    if (campaign.value?.status === 'FINALIZED') {
      await loadClasses()
    }
  } finally {
    loading.value = false
  }
}

const memberColumns: DataTableColumns<{
  studentId: number
  studentName: string
  studentNo: string
  className: string
}> = [
  { title: t('selection.studentNo'), key: 'studentNo', width: 120 },
  { title: t('selection.studentName'), key: 'studentName', width: 120 },
  { title: t('selection.className'), key: 'className', width: 160 },
]

async function handleClose() {
  try {
    await closeCampaign(campaignId.value)
    message.success(t('selection.close'))
    await loadCampaign()
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  }
}

async function handleOpen() {
  try {
    await openCampaign(campaignId.value)
    message.success(t('selection.open'))
    await loadCampaign()
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  }
}

async function handleFinalize() {
  try {
    await finalizeCampaign(campaignId.value)
    message.success(t('selection.finalize'))
    await loadCampaign()
    await loadClasses()
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  }
}

function goBack() {
  router.push('/selection')
}

onMounted(loadAll)
</script>

<template>
  <div class="campaign-detail-page">
    <NSpace vertical :size="16">
      <NCard>
        <div class="detail-header">
          <div class="detail-header-left">
            <NButton quaternary @click="goBack">{{ $t('selection.back') }}</NButton>
            <span class="detail-title">{{ campaign?.name }}</span>
            <NTag
              v-if="campaign"
              :type="statusTagType[campaign.status]"
              :bordered="false"
            >
              {{ $t(`selection.${campaign.status}`) }}
            </NTag>
          </div>
          <NSpace>
            <NPopconfirm
              v-if="campaign?.status === 'OPEN'"
              :on-positive-click="handleClose"
            >
              <template #trigger>
                <NButton type="warning">{{ $t('selection.close') }}</NButton>
              </template>
              {{ $t('selection.closeConfirm') }}
            </NPopconfirm>
            <NPopconfirm
              v-if="campaign?.status === 'CLOSED'"
              :on-positive-click="handleFinalize"
            >
              <template #trigger>
                <NButton type="primary">{{ $t('selection.finalize') }}</NButton>
              </template>
              {{ $t('selection.finalizeConfirm') }}
            </NPopconfirm>
          </NSpace>
        </div>
      </NCard>

      <NCard v-if="campaign">
        <NDescriptions :column="3" label-placement="left" bordered>
          <NDescriptionsItem :label="$t('selection.semester')">
            {{ campaign.semesterName }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.startTime')">
            {{ formatDateTime(campaign.startTime) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.endTime')">
            {{ formatDateTime(campaign.endTime) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.weekRange')">
            {{ $t('selection.weekRangeValue', { start: campaign.startWeek, end: campaign.endWeek }) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.selectedCourseCount')">
            {{ campaign.selectedCourseCount }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.createTime')">
            {{ formatDateTime(campaign.createTime) }}
          </NDescriptionsItem>
        </NDescriptions>
      </NCard>

      <NCard :title="$t('selection.classResults')">
        <NSpin :show="loading">
          <NAlert
            v-if="campaign && campaign.status !== 'FINALIZED'"
            type="info"
            :show-icon="false"
          >
            {{ $t('selection.noClassResults') }}
          </NAlert>
          <NEmpty
            v-else-if="!loading && classes.length === 0"
            :description="$t('selection.noClassResults')"
          />
          <NCollapse v-else arrow-placement="left">
            <NCollapseItem
              v-for="cls in classes"
              :key="cls.classId"
              :name="String(cls.classId)"
              :title="`${cls.courseName} - ${$t('selection.classNo')} ${cls.classNo} (${cls.studentCount} ${$t('selection.studentCount')})`"
            >
              <NDataTable
                :columns="memberColumns"
                :data="cls.members"
                :row-key="(r: { studentId: number }) => r.studentId"
                :single-line="false"
                :bordered="false"
                size="small"
              />
            </NCollapseItem>
          </NCollapse>
        </NSpin>
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped src="./CampaignDetailPage.css"></style>
