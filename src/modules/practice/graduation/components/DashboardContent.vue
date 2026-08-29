<script setup lang="ts">
import { ref, computed, h, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NSpin,
  NEmpty,
  NButton,
  NDataTable,
  NSelect,
  NInput,
  NSpace,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchDashboard, exportDashboard, type DashboardQuery } from '../api'
import { fetchColleges } from '@/modules/college/api'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import {
  proposalStatusTagType,
  assignmentSourceTagType,
  midtermConclusionTagType,
  formatDateTime,
} from '@/modules/practice/utils'
import type { DashboardRow } from '../types'

/**
 * 毕设看板（教务全局 / 院系本院系，F-R-38/39）：
 * - 状态筛选（含聚合态 NOT_SUBMITTED/PENDING）+ 关键词 + 院系筛选（仅教务）
 * - 中期结论配色；「严重滞后」整行弱高亮预警
 * - Excel/CSV 导出（携带当前筛选，F-R-11/12）
 */
const props = defineProps<{
  campaignId: number | null
  /** 院系角色显示本院系范围说明 */
  scopeLabel?: string
  /** 是否显示院系筛选器（仅教务） */
  showCollegeFilter?: boolean
}>()

const { t } = useI18n()
const message = useMessage()

const rows = ref<DashboardRow[]>([])
const loading = ref(false)
const exporting = ref<'xlsx' | 'csv' | null>(null)

const filterStatus = ref<string | null>(null)
const keyword = ref('')
const collegeId = ref<number | null>(null)
const colleges = ref<{ id: number; name: string }[]>([])

const { pagination, reset } = useRemotePagination(loadData)

/** 状态筛选选项（含聚合态与明细态） */
const statusFilterOptions = computed(() => [
  { label: t('graduation.academic.notSubmitted'), value: 'NOT_SUBMITTED' },
  { label: t('graduation.common.statusPendingAgg'), value: 'PENDING' },
  { label: t('graduation.common.statusPendingDept'), value: 'PENDING_DEPT' },
  { label: t('graduation.common.statusPendingAcademic'), value: 'DEPT_APPROVED' },
  { label: t('graduation.common.statusApproved'), value: 'APPROVED' },
  { label: t('graduation.common.statusRejected'), value: 'REJECTED' },
])

const collegeOptions = computed(() => colleges.value.map((c) => ({ label: c.name, value: c.id })))

async function loadData(): Promise<void> {
  if (props.campaignId == null) return
  loading.value = true
  try {
    const query: DashboardQuery = {
      status: (filterStatus.value as DashboardQuery['status']) ?? undefined,
      keyword: keyword.value || undefined,
      collegeId: collegeId.value ?? undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
    const res = await fetchDashboard(props.campaignId, query)
    rows.value = res.data.records
    pagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function handleFilterChange(): void {
  reset()
  loadData()
}

function handleReset(): void {
  keyword.value = ''
  filterStatus.value = null
  collegeId.value = null
  handleFilterChange()
}

/** F-R-12：导出携带当前筛选，导出中加载态防重复点击 */
async function handleExport(format: 'xlsx' | 'csv'): Promise<void> {
  if (props.campaignId == null) return
  exporting.value = format
  try {
    await exportDashboard(props.campaignId, format, {
      status: (filterStatus.value as DashboardQuery['status']) ?? undefined,
      keyword: keyword.value || undefined,
      collegeId: collegeId.value ?? undefined,
    })
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  } finally {
    exporting.value = null
  }
}

watch(
  () => props.campaignId,
  (id) => {
    rows.value = []
    if (id != null) {
      reset()
      loadData()
      if (props.showCollegeFilter && !colleges.value.length) {
        void fetchColleges().then((res) => {
          colleges.value = (res.data ?? []).map((c) => ({ id: c.id, name: c.collegeName }))
        })
      }
    }
  },
  { immediate: true },
)

const dashboardRowKey = (row: DashboardRow) => row.studentId

const columns = computed<DataTableColumns<DashboardRow>>(() => [
  { title: t('graduation.common.studentNo'), key: 'studentNo', width: 110 },
  { title: t('graduation.common.student'), key: 'studentName', width: 90 },
  { title: t('graduation.academic.colName'), key: 'collegeName', width: 120 },
  { title: t('graduation.common.className'), key: 'className', width: 120 },
  { title: t('graduation.academic.gradeName'), key: 'gradeName', width: 80 },
  {
    title: t('graduation.academic.proposalStatus'),
    key: 'proposalStatus',
    width: 110,
    align: 'center',
    // F-R-38：未提交申请显示「未开始选题」
    render: (r) =>
      r.proposalStatus
        ? h(
            NTag,
            { type: proposalStatusTagType(r.proposalStatus), size: 'small', bordered: false },
            () => r.proposalStatus,
          )
        : h(NTag, { size: 'small', bordered: false }, () => t('graduation.academic.notSubmitted')),
  },
  {
    title: t('graduation.academic.proposalTitle'),
    key: 'proposalTitle',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: (r) => r.proposalTitle ?? '-',
  },
  {
    title: t('graduation.common.teacher'),
    key: 'teacherName',
    width: 100,
    render: (r) => r.teacherName ?? '-',
  },
  {
    title: t('graduation.common.source'),
    key: 'assignmentSource',
    width: 100,
    align: 'center',
    render: (r) =>
      r.assignmentSource
        ? h(
            NTag,
            { type: assignmentSourceTagType(r.assignmentSource), size: 'small', bordered: false },
            () => r.assignmentSource,
          )
        : '-',
  },
  {
    title: t('graduation.academic.midtermConclusion'),
    key: 'midtermConclusion',
    width: 110,
    align: 'center',
    // F-R-39：按配色渲染
    render: (r) =>
      r.midtermConclusion
        ? h(
            NTag,
            { type: midtermConclusionTagType(r.midtermConclusion), size: 'small', bordered: false },
            () => r.midtermConclusion,
          )
        : '-',
  },
  {
    title: t('graduation.academic.submitTime'),
    key: 'proposalSubmitTime',
    width: 150,
    render: (r) => formatDateTime(r.proposalSubmitTime),
  },
  {
    title: t('graduation.academic.approvedTime'),
    key: 'proposalApprovedTime',
    width: 150,
    render: (r) => formatDateTime(r.proposalApprovedTime),
  },
])

/** F-R-39：严重滞后整行弱高亮 */
function rowClassName(row: DashboardRow): string {
  return row.midtermConclusion === '严重滞后' ? 'warning-row' : ''
}
</script>

<template>
  <div class="dashboard-content">
    <NSpace align="center" :size="12" style="margin-bottom: 12px" wrap>
      <NSelect
        v-model:value="filterStatus"
        :options="statusFilterOptions"
        :placeholder="$t('graduation.common.status')"
        clearable
        style="width: 150px"
        @update:value="handleFilterChange"
      />
      <NInput
        v-model:value="keyword"
        :placeholder="$t('graduation.academic.keywordPlaceholder')"
        clearable
        style="width: 180px"
        @keyup.enter="handleFilterChange"
        @clear="handleFilterChange"
      />
      <NSelect
        v-if="showCollegeFilter"
        v-model:value="collegeId"
        :options="collegeOptions"
        :placeholder="$t('graduation.academic.filterCollege')"
        clearable
        style="width: 160px"
        @update:value="handleFilterChange"
      />
      <NButton type="primary" @click="handleFilterChange">{{
        $t('graduation.common.confirm')
      }}</NButton>
      <NButton @click="handleReset">{{ $t('graduation.common.reset') }}</NButton>
      <NButton
        :loading="exporting === 'xlsx'"
        :disabled="exporting != null"
        @click="handleExport('xlsx')"
      >
        {{ $t('graduation.academic.exportXlsx') }}
      </NButton>
      <NButton
        :loading="exporting === 'csv'"
        :disabled="exporting != null"
        @click="handleExport('csv')"
      >
        {{ $t('graduation.academic.exportCsv') }}
      </NButton>
      <span v-if="scopeLabel" class="scope-label">{{ scopeLabel }}</span>
      <span class="export-hint">{{ $t('graduation.academic.exportHint') }}</span>
    </NSpace>
    <NSpin :show="loading">
      <NDataTable
        :columns="columns"
        :data="rows"
        :row-key="dashboardRowKey"
        :row-class-name="rowClassName"
        :single-line="false"
        :bordered="false"
        :scroll-x="1560"
        remote
        :pagination="pagination"
      >
        <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
      </NDataTable>
    </NSpin>
  </div>
</template>

<style scoped src="./DashboardContent.css"></style>
