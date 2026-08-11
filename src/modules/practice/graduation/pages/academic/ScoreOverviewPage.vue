<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpin,
  NEmpty,
  NButton,
  NDataTable,
  NSelect,
  NResult,
  NTag,
  NSpace,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import { fetchScores, exportScores, fetchDashboard } from '../../api'
import { scoreStatusTagType, formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { ScoreResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const campaignId = ref<number | null>(null)
const list = ref<ScoreResponse[]>([])
const loading = ref(false)
const exporting = ref(false)
const collegeFilter = ref<string | null>(null)

/** 学号/院系来自看板行合并（ScoreResponse 不含学号/院系） */
const studentMeta = ref(new Map<number, { studentNo: string; collegeName: string }>())

const collegeOptions = computed(() => {
  const names = new Set<string>()
  for (const meta of studentMeta.value.values()) names.add(meta.collegeName)
  return [...names].map((n) => ({ label: n, value: n }))
})

const filteredRows = computed(() => {
  if (!collegeFilter.value) return list.value
  return list.value.filter(
    (s) => studentMeta.value.get(s.studentId)?.collegeName === collegeFilter.value,
  )
})

async function loadData(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const [sRes, dRes] = await Promise.all([
      fetchScores(campaignId.value),
      fetchDashboard(campaignId.value, { page: 1, pageSize: 100 }),
    ])
    list.value = sRes.data ?? []
    const meta = new Map<number, { studentNo: string; collegeName: string }>()
    for (const r of dRes.data.records) {
      meta.set(r.studentId, { studentNo: r.studentNo, collegeName: r.collegeName })
    }
    studentMeta.value = meta
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  list.value = []
  studentMeta.value = new Map()
  collegeFilter.value = null
  if (id != null) void loadData()
}

async function handleExport(): Promise<void> {
  if (campaignId.value == null) return
  exporting.value = true
  try {
    await exportScores(campaignId.value)
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  } finally {
    exporting.value = false
  }
}

const columns = computed<DataTableColumns<ScoreResponse>>(() => [
  {
    title: t('graduation.common.studentNo'),
    key: 'studentNo',
    width: 110,
    render: (r) => studentMeta.value.get(r.studentId)?.studentNo ?? '-',
  },
  { title: t('graduation.common.student'), key: 'studentName', width: 100 },
  {
    title: t('graduation.academic.colName'),
    key: 'collegeName',
    width: 120,
    render: (r) => studentMeta.value.get(r.studentId)?.collegeName ?? '-',
  },
  {
    title: t('graduation.student.advisorScore'),
    key: 'advisorScore',
    width: 80,
    align: 'center',
    render: (r) => r.advisorScore ?? '-',
  },
  {
    title: t('graduation.student.reviewerScore'),
    key: 'reviewerScore',
    width: 80,
    align: 'center',
    render: (r) => r.reviewerScore ?? '-',
  },
  {
    title: t('graduation.student.defenseScore'),
    key: 'defenseScore',
    width: 80,
    align: 'center',
    render: (r) => r.defenseScore ?? '-',
  },
  {
    title: t('graduation.student.totalScore'),
    key: 'totalScore',
    width: 80,
    align: 'center',
    render: (r) => r.totalScore ?? '-',
  },
  {
    title: t('graduation.common.status'),
    key: 'status',
    width: 110,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: scoreStatusTagType(r.status), size: 'small', bordered: false },
        () => r.status,
      ),
  },
  {
    title: t('graduation.common.publishTime'),
    key: 'publishTime',
    width: 150,
    render: (r) => formatDateTime(r.publishTime),
  },
])
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
        <CampaignContextSelector
          v-model:campaign-id="campaignId"
          @update:campaign-id="onCampaignChange"
        />
      </NCard>

      <NCard :title="$t('graduation.academic.scoreTableTitle')" class="content-card">
        <template #header-extra>
          <NSpace align="center" :size="12">
            <NSelect
              v-model:value="collegeFilter"
              :options="collegeOptions"
              :placeholder="$t('graduation.academic.filterCollege')"
              clearable
              style="width: 160px"
            />
            <NButton type="primary" :loading="exporting" @click="handleExport">
              {{ $t('graduation.academic.exportScoreTable') }}
            </NButton>
          </NSpace>
        </template>
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && !list.length"
            :description="$t('graduation.academic.scoresEmpty')"
          />
          <NDataTable
            v-else
            :columns="columns"
            :data="filteredRows"
            :row-key="(r: ScoreResponse) => r.id"
            :single-line="false"
            :bordered="false"
            :scroll-x="980"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./ScoreOverviewPage.css"></style>
