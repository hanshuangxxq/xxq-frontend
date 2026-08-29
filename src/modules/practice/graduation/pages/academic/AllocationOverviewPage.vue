<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpin,
  NEmpty,
  NButton,
  NDataTable,
  NModal,
  NSelect,
  NResult,
  NTag,
  NSpace,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import { fetchAssignmentOverview, fetchUnassignedStudentIds, fetchDashboard } from '../../api'
import { fetchColleges } from '@/modules/college/api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { AssignmentOverviewRow, DashboardRow } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const campaignId = ref<number | null>(null)
const rows = ref<AssignmentOverviewRow[]>([])
const loading = ref(false)
const collegeId = ref<number | null>(null)
const colleges = ref<{ id: number; name: string }[]>([])
const unassignedCount = ref(0)

/** 未分配清单：看板行合并姓名（unassigned 仅返回 id 列表） */
const dashboardRows = ref<DashboardRow[]>([])
const unassignedIds = ref<number[]>([])

const collegeOptions = computed(() => colleges.value.map((c) => ({ label: c.name, value: c.id })))

/** 未分配清单弹窗 */
const showUnassigned = ref(false)

const dashboardRowKey = (row: DashboardRow) => row.studentId

const unassignedColumns = computed<DataTableColumns<DashboardRow>>(() => [
  { title: t('graduation.common.studentNo'), key: 'studentNo', width: 120 },
  { title: t('graduation.common.student'), key: 'studentName', width: 100 },
  { title: t('graduation.common.className'), key: 'className', width: 130 },
  { title: t('graduation.academic.colName'), key: 'collegeName', width: 140 },
  { title: t('graduation.academic.gradeName'), key: 'gradeName', width: 90 },
  {
    title: t('graduation.academic.proposalTitle'),
    key: 'proposalTitle',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: (r) => r.proposalTitle ?? '-',
  },
])

async function loadData(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const [oRes, uRes, dRes] = await Promise.all([
      fetchAssignmentOverview(campaignId.value),
      fetchUnassignedStudentIds(campaignId.value, collegeId.value),
      fetchDashboard(campaignId.value, { page: 1, pageSize: 100 }),
    ])
    rows.value = oRes.data ?? []
    unassignedIds.value = uRes.data ?? []
    unassignedCount.value = unassignedIds.value.length
    dashboardRows.value = dRes.data.records
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

/** 未分配学生明细（看板合并姓名/班级/院系，F-R-38 口径） */
const unassignedDetail = computed(() => {
  const idSet = new Set(unassignedIds.value)
  return dashboardRows.value.filter((r) => idSet.has(r.studentId))
})

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  rows.value = []
  unassignedCount.value = 0
  if (id != null) {
    loadData()
    if (!colleges.value.length) {
      void fetchColleges().then((res) => {
        colleges.value = (res.data ?? []).map((c) => ({ id: c.id, name: c.collegeName }))
      })
    }
  }
}

function onCollegeChange(): void {
  if (campaignId.value != null) void loadData()
}

/** 空缺席位 > 0 的行高亮「待院系指定」 */
function rowClassName(row: AssignmentOverviewRow): string {
  return row.freeCount > 0 ? 'free-row' : ''
}

const overviewRowKey = (row: AssignmentOverviewRow) => row.teacherId

const columns = computed<DataTableColumns<AssignmentOverviewRow>>(() => [
  { title: t('graduation.academic.teacherNo'), key: 'teacherNo', width: 110 },
  { title: t('graduation.academic.teacherName'), key: 'teacherName', width: 110 },
  {
    title: t('graduation.academic.pickedCount'),
    key: 'pickedCount',
    width: 80,
    align: 'center',
  },
  {
    title: t('graduation.academic.allocatedCount'),
    key: 'allocatedCount',
    width: 80,
    align: 'center',
  },
  {
    title: t('graduation.academic.freeCount'),
    key: 'freeCount',
    width: 90,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: r.freeCount > 0 ? 'warning' : 'default', size: 'small', bordered: false },
        () => `${r.freeCount}/${r.capacity}`,
      ),
  },
  {
    title: t('graduation.academic.overviewTable'),
    key: 'capacity',
    width: 160,
    render: (r) => `${r.pickedCount + r.allocatedCount} / ${r.capacity}`,
  },
  {
    title: t('graduation.common.status'),
    key: 'freeCount',
    width: 110,
    align: 'center',
    render: (r) =>
      r.freeCount > 0
        ? h(NTag, { size: 'small', type: 'warning', bordered: false }, () =>
            t('graduation.academic.freeHighlight'),
          )
        : '-',
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

      <NCard :title="$t('graduation.academic.overviewTable')" class="content-card">
        <template #header-extra>
          <NSpace align="center" :size="12">
            <NSelect
              v-model:value="collegeId"
              :options="collegeOptions"
              :placeholder="$t('graduation.academic.filterCollege')"
              clearable
              style="width: 160px"
              @update:value="onCollegeChange"
            />
            <NTag size="small" type="info" :bordered="false">
              {{ $t('graduation.academic.unassignedCount', { count: unassignedCount }) }}
            </NTag>
            <NButton size="small" :disabled="unassignedCount === 0" @click="showUnassigned = true">
              {{ $t('graduation.academic.viewUnassigned') }}
            </NButton>
          </NSpace>
        </template>
        <NSpin :show="loading">
          <NDataTable
            :columns="columns"
            :data="rows"
            :row-key="overviewRowKey"
            :row-class-name="rowClassName"
            :single-line="false"
            :bordered="false"
            :scroll-x="860"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>

      <!-- 未分配学生清单弹窗（F-R-38：姓名等从看板合并） -->
      <NModal
        v-model:show="showUnassigned"
        preset="card"
        :title="$t('graduation.academic.unassignedTitle')"
        class="graduation-unassigned-modal"
      >
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && !unassignedDetail.length"
            :description="$t('graduation.common.empty')"
          />
          <NDataTable
            v-else
            :columns="unassignedColumns"
            :data="unassignedDetail"
            :row-key="dashboardRowKey"
            :single-line="false"
            :bordered="false"
            :scroll-x="680"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NModal>
    </template>
  </div>
</template>

<style scoped src="./AllocationOverviewPage.css"></style>

<style>
.graduation-unassigned-modal {
  width: 760px;
  max-width: 94vw;
}
</style>
