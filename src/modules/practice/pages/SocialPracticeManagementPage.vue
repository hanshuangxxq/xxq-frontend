<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NDataTable,
  NButton,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NTag,
  NSpin,
  NPopconfirm,
  NTabs,
  NTabPane,
  NDatePicker,
  NRadioGroup,
  NRadio,
  NResult,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import EmptyState from '@/shared/components/EmptyState.vue'
import {
  fetchSocialPractices,
  createSocialPractice,
  updateSocialPractice,
  updateSocialPracticeStatus,
  deleteSocialPractice,
  fetchSocialPracticeApplications,
  reviewSocialPracticeApplication,
  fetchSocialPracticeReports,
  reviewSocialPracticeReport,
  deleteSocialPracticeReport,
} from '../api'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import {
  projectStatusTagType,
  auditStatusTagType,
  reportStatusTagType,
  formatDateTime,
  tsToIso,
  parseMembers,
  downloadPracticeFile,
} from '../utils'
import type {
  SocialPracticeResponse,
  SocialPracticeStatusCode,
  SocialPracticeCreateRequest,
  SocialPracticeApplicationResponse,
  SocialPracticeReportResponse,
  SocialPracticeReportReviewRequest,
  ReportStatusCode,
} from '../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const activeTab = ref('practices')

const statusOptions = computed(() => [
  { label: t('practice.socialPractice.statusDraft'), value: 'DRAFT' as SocialPracticeStatusCode },
  { label: t('practice.socialPractice.statusOpen'), value: 'OPEN' as SocialPracticeStatusCode },
  { label: t('practice.socialPractice.statusClosed'), value: 'CLOSED' as SocialPracticeStatusCode },
])

/** 中文状态 -> 枚举 code（状态按钮排除当前状态用） */
function statusCodeOf(status: string): string {
  if (status === '草稿') return 'DRAFT'
  if (status === '开放') return 'OPEN'
  return 'CLOSED'
}
const reportStatusOptions = computed(() => [
  {
    label: t('practice.socialPractice.reportStatusSubmitted'),
    value: 'SUBMITTED' as ReportStatusCode,
  },
  {
    label: t('practice.socialPractice.reportStatusReviewed'),
    value: 'REVIEWED' as ReportStatusCode,
  },
])

// ============ 项目 ============
const practiceLoading = ref(false)
const practices = ref<SocialPracticeResponse[]>([])
const { pagination: prPagination, reset: resetPr } = useRemotePagination(loadPractices)
const filterPrStatus = ref<SocialPracticeStatusCode | null>(null)

async function loadPractices() {
  practiceLoading.value = true
  try {
    const res = await fetchSocialPractices({
      status: filterPrStatus.value ?? undefined,
      page: prPagination.page,
      pageSize: prPagination.pageSize,
    })
    practices.value = res.data.records
    prPagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    practiceLoading.value = false
  }
}

function handlePrFilterChange() {
  resetPr()
  loadPractices()
}

async function handlePrStatusChange(row: SocialPracticeResponse, code: string) {
  try {
    await updateSocialPracticeStatus(row.id, code)
    message.success(t('practice.common.operationSuccess'))
    await loadPractices()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  }
}

async function handleDeletePractice(id: number) {
  try {
    await deleteSocialPractice(id)
    message.success(t('practice.common.deleteSuccess'))
    await loadPractices()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.deleteFail'))
  }
}

// 项目表单
interface PrForm {
  title: string
  description: string
  organizer: string
  startTs: number | null
  endTs: number | null
  capacity: number | null
}
const showPrForm = ref(false)
const prFormMode = ref<'create' | 'edit'>('create')
const editingPrId = ref<number | null>(null)
const savingPr = ref(false)
const prForm = ref<PrForm>(emptyPrForm())

function emptyPrForm(): PrForm {
  return { title: '', description: '', organizer: '', startTs: null, endTs: null, capacity: null }
}

function startCreatePr() {
  prFormMode.value = 'create'
  editingPrId.value = null
  prForm.value = emptyPrForm()
  showPrForm.value = true
}

function startEditPr(row: SocialPracticeResponse) {
  prFormMode.value = 'edit'
  editingPrId.value = row.id
  prForm.value = {
    title: row.title,
    description: row.description ?? '',
    organizer: row.organizer ?? '',
    startTs: row.startTime ? new Date(row.startTime).getTime() : null,
    endTs: row.endTime ? new Date(row.endTime).getTime() : null,
    capacity: row.capacity,
  }
  showPrForm.value = true
}

async function handleSavePr() {
  const f = prForm.value
  if (!f.title.trim()) return message.warning(t('practice.socialPractice.titleRequired'))
  if (f.capacity == null || f.capacity <= 0)
    return message.warning(t('practice.socialPractice.capacityRequired'))
  const body: SocialPracticeCreateRequest = {
    title: f.title.trim(),
    description: f.description || undefined,
    organizer: f.organizer || undefined,
    startTime: f.startTs != null ? tsToIso(f.startTs) : null,
    endTime: f.endTs != null ? tsToIso(f.endTs) : null,
    capacity: f.capacity,
  }
  savingPr.value = true
  try {
    if (prFormMode.value === 'create') {
      await createSocialPractice(body)
    } else {
      await updateSocialPractice(editingPrId.value!, {
        title: body.title,
        description: body.description,
        organizer: body.organizer,
        startTime: body.startTime,
        endTime: body.endTime,
        capacity: body.capacity,
      })
    }
    message.success(t('practice.common.saveSuccess'))
    showPrForm.value = false
    await loadPractices()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.saveFail'))
  } finally {
    savingPr.value = false
  }
}

// 申报列表
const showApps = ref(false)
const appsOf = ref<SocialPracticeResponse | null>(null)
const apps = ref<SocialPracticeApplicationResponse[]>([])
const appLoading = ref(false)
const { pagination: appPagination, reset: resetApp } = useRemotePagination(loadApps)

async function loadApps() {
  if (!appsOf.value) return
  appLoading.value = true
  try {
    const res = await fetchSocialPracticeApplications(
      appsOf.value.id,
      appPagination.page,
      appPagination.pageSize,
    )
    apps.value = res.data.records
    appPagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    appLoading.value = false
  }
}

function openApps(row: SocialPracticeResponse) {
  appsOf.value = row
  showApps.value = true
  resetApp()
  loadApps()
}

// 申报审核
const showReviewApp = ref(false)
const reviewingApp = ref<SocialPracticeApplicationResponse | null>(null)
const reviewAppForm = ref<{ approved: boolean; reviewComment: string }>({
  approved: true,
  reviewComment: '',
})
const savingReviewApp = ref(false)

function startReviewApp(row: SocialPracticeApplicationResponse) {
  reviewingApp.value = row
  reviewAppForm.value = { approved: true, reviewComment: '' }
  showReviewApp.value = true
}

async function handleSaveReviewApp() {
  if (!reviewingApp.value) return
  savingReviewApp.value = true
  try {
    await reviewSocialPracticeApplication(reviewingApp.value.id, {
      approved: reviewAppForm.value.approved,
      reviewComment: reviewAppForm.value.reviewComment || undefined,
    })
    message.success(t('practice.common.operationSuccess'))
    showReviewApp.value = false
    await loadApps()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  } finally {
    savingReviewApp.value = false
  }
}

// ============ 报告 ============
const reportLoading = ref(false)
const reports = ref<SocialPracticeReportResponse[]>([])
const { pagination: reportPagination, reset: resetReport } = useRemotePagination(loadReports)
const filterReportStatus = ref<ReportStatusCode | null>(null)
let reportsLoaded = false

async function loadReports() {
  reportLoading.value = true
  try {
    const res = await fetchSocialPracticeReports({
      status: filterReportStatus.value ?? undefined,
      page: reportPagination.page,
      pageSize: reportPagination.pageSize,
    })
    reports.value = res.data.records
    reportPagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    reportLoading.value = false
  }
}

function handleReportFilterChange() {
  resetReport()
  loadReports()
}

async function handleDownloadReport(id: number) {
  try {
    await downloadPracticeFile(`/practice/social-practice-reports/${id}/download`)
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  }
}

async function handleDeleteReport(id: number) {
  try {
    await deleteSocialPracticeReport(id)
    message.success(t('practice.common.deleteSuccess'))
    await loadReports()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.deleteFail'))
  }
}

// 报告评审
const showReviewReport = ref(false)
const reviewingReport = ref<SocialPracticeReportResponse | null>(null)
const reviewReportForm = ref<{ score: number | null; feedback: string }>({
  score: null,
  feedback: '',
})
const savingReviewReport = ref(false)

function startReviewReport(row: SocialPracticeReportResponse) {
  reviewingReport.value = row
  reviewReportForm.value = { score: null, feedback: '' }
  showReviewReport.value = true
}

async function handleSaveReviewReport() {
  if (!reviewingReport.value) return
  const body: SocialPracticeReportReviewRequest = {
    score: reviewReportForm.value.score ?? undefined,
    feedback: reviewReportForm.value.feedback || undefined,
  }
  savingReviewReport.value = true
  try {
    await reviewSocialPracticeReport(reviewingReport.value.id, body)
    message.success(t('practice.common.operationSuccess'))
    showReviewReport.value = false
    await loadReports()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  } finally {
    savingReviewReport.value = false
  }
}

function onTabChange(name: string | number) {
  if (name === 'reports' && !reportsLoaded) {
    reportsLoaded = true
    loadReports()
  }
}

// ============ 列定义 ============
const practiceColumns = computed<DataTableColumns<SocialPracticeResponse>>(() => [
  {
    title: t('practice.socialPractice.practiceTitle'),
    key: 'title',
    minWidth: 180,
    ellipsis: { tooltip: true },
  },
  {
    title: t('practice.common.organizer'),
    key: 'organizer',
    width: 130,
    ellipsis: { tooltip: true },
    render: (r) => r.organizer || '-',
  },
  {
    title: t('practice.common.capacity'),
    key: 'capacity',
    width: 110,
    align: 'center',
    render: (r) => `${r.selectedCount} / ${r.capacity}`,
  },
  {
    title: t('practice.common.startTime'),
    key: 'startTime',
    width: 150,
    render: (r) => formatDateTime(r.startTime),
  },
  {
    title: t('practice.common.endTime'),
    key: 'endTime',
    width: 150,
    render: (r) => formatDateTime(r.endTime),
  },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: projectStatusTagType(r.status), size: 'small', bordered: false },
        () => r.status,
      ),
  },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 400,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'small', onClick: () => startEditPr(row) }, () =>
          t('practice.common.edit'),
        ),
        // 状态变更：每个目标状态一个独立按钮（排除当前状态）
        ...statusOptions.value
          .filter((o) => o.value !== statusCodeOf(row.status))
          .map((o) =>
            h(NButton, { size: 'small', onClick: () => handlePrStatusChange(row, o.value) }, () =>
              t('practice.common.setStatus', { status: o.label }),
            ),
          ),
        h(NButton, { size: 'small', onClick: () => openApps(row) }, () =>
          t('practice.socialPractice.viewApplications'),
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDeletePractice(row.id) },
          {
            default: () => t('practice.common.deleteConfirm'),
            trigger: () =>
              h(NButton, { size: 'small', type: 'error' }, () => t('practice.common.delete')),
          },
        ),
      ]),
  },
])

const appColumns = computed<DataTableColumns<SocialPracticeApplicationResponse>>(() => [
  { title: t('practice.common.student'), key: 'studentName', width: 110 },
  {
    title: t('practice.socialPractice.teamName'),
    key: 'teamName',
    width: 120,
    render: (r) => r.teamName || '-',
  },
  {
    title: t('practice.socialPractice.members'),
    key: 'members',
    width: 90,
    align: 'center',
    render: (r) => {
      const n = parseMembers(r.members).length
      return n > 0 ? `${n} 人` : '-'
    },
  },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: auditStatusTagType(r.status), size: 'small', bordered: false },
        () => r.status,
      ),
  },
  {
    title: t('practice.socialPractice.applyReason'),
    key: 'applyReason',
    minWidth: 140,
    ellipsis: { tooltip: true },
    render: (r) => r.applyReason || '-',
  },
  {
    title: t('practice.common.reviewComment'),
    key: 'reviewComment',
    width: 150,
    ellipsis: { tooltip: true },
    render: (r) => r.reviewComment || '-',
  },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      row.status === '待审核'
        ? h(NButton, { size: 'small', type: 'primary', onClick: () => startReviewApp(row) }, () =>
            t('practice.socialPractice.reviewApply'),
          )
        : '-',
  },
])

const reportColumns = computed<DataTableColumns<SocialPracticeReportResponse>>(() => [
  { title: t('practice.common.student'), key: 'studentName', width: 110 },
  {
    title: t('practice.socialPractice.practiceTitle'),
    key: 'practiceTitle',
    minWidth: 160,
    ellipsis: { tooltip: true },
  },
  {
    title: t('practice.socialPractice.reportTitle'),
    key: 'title',
    minWidth: 160,
    ellipsis: { tooltip: true },
  },
  {
    title: t('practice.common.submitTime'),
    key: 'submitTime',
    width: 150,
    render: (r) => formatDateTime(r.submitTime),
  },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: reportStatusTagType(r.status), size: 'small', bordered: false },
        () => r.status,
      ),
  },
  {
    title: t('practice.socialPractice.reportScore'),
    key: 'score',
    width: 80,
    align: 'center',
    render: (r) => r.score ?? '-',
  },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 240,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'small', type: 'primary', onClick: () => startReviewReport(row) }, () =>
          t('practice.socialPractice.reviewReport'),
        ),
        h(NButton, { size: 'small', onClick: () => handleDownloadReport(row.id) }, () =>
          t('practice.socialPractice.downloadReport'),
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDeleteReport(row.id) },
          {
            default: () => t('practice.common.deleteConfirm'),
            trigger: () =>
              h(NButton, { size: 'small', type: 'error' }, () => t('practice.common.delete')),
          },
        ),
      ]),
  },
])

onMounted(() => {
  if (!isAcademicAdmin.value) return
  loadPractices()
})
</script>

<template>
  <div class="practice-page">
    <NResult
      v-if="!isAcademicAdmin"
      status="403"
      :title="$t('practice.common.noPermission')"
      :description="$t('practice.common.noPermissionDesc')"
    />
    <template v-else>
      <NTabs v-model:value="activeTab" type="line" animated @update:value="onTabChange">
        <!-- 项目管理 -->
        <NTabPane name="practices" :tab="$t('practice.socialPractice.tabPractices')">
          <NCard :title="$t('practice.socialPractice.tabPractices')">
            <template #header-extra>
              <NSpace align="center">
                <NSelect
                  v-model:value="filterPrStatus"
                  :options="statusOptions"
                  :placeholder="$t('practice.common.allStatus')"
                  clearable
                  style="width: 150px"
                  @update:value="handlePrFilterChange"
                />
                <NButton type="primary" @click="loadPractices">{{
                  $t('practice.common.query')
                }}</NButton>
                <NButton @click="handlePrFilterChange">{{ $t('practice.common.reset') }}</NButton>
                <NButton type="primary" @click="startCreatePr">{{
                  $t('practice.socialPractice.addPractice')
                }}</NButton>
              </NSpace>
            </template>
            <NSpin :show="practiceLoading">
              <NDataTable
                :columns="practiceColumns"
                :data="practices"
                :row-key="(r: SocialPracticeResponse) => r.id"
                :single-line="false"
                :bordered="false"
                :scroll-x="1270"
                remote
                :pagination="prPagination"
              >
                <template #empty
                  ><EmptyState :description="$t('practice.common.empty')"
                /></template>
              </NDataTable>
            </NSpin>
          </NCard>
        </NTabPane>

        <!-- 报告评审 -->
        <NTabPane name="reports" :tab="$t('practice.socialPractice.tabReports')">
          <NCard :title="$t('practice.socialPractice.tabReports')">
            <template #header-extra>
              <NSpace align="center">
                <NSelect
                  v-model:value="filterReportStatus"
                  :options="reportStatusOptions"
                  :placeholder="$t('practice.common.allStatus')"
                  clearable
                  style="width: 150px"
                  @update:value="handleReportFilterChange"
                />
                <NButton type="primary" @click="loadReports">{{
                  $t('practice.common.query')
                }}</NButton>
                <NButton @click="handleReportFilterChange">{{
                  $t('practice.common.reset')
                }}</NButton>
              </NSpace>
            </template>
            <NSpin :show="reportLoading">
              <NDataTable
                :columns="reportColumns"
                :data="reports"
                :row-key="(r: SocialPracticeReportResponse) => r.id"
                :single-line="false"
                :bordered="false"
                :scroll-x="980"
                remote
                :pagination="reportPagination"
              >
                <template #empty
                  ><EmptyState :description="$t('practice.common.empty')"
                /></template>
              </NDataTable>
            </NSpin>
          </NCard>
        </NTabPane>
      </NTabs>

      <!-- 项目表单 -->
      <NModal
        v-model:show="showPrForm"
        preset="card"
        :title="
          prFormMode === 'create'
            ? $t('practice.socialPractice.addPractice')
            : $t('practice.socialPractice.editPractice')
        "
        class="practice-form-modal"
      >
        <NForm :model="prForm" label-placement="top">
          <NFormItem :label="$t('practice.socialPractice.practiceTitle')" required>
            <NInput v-model:value="prForm.title" />
          </NFormItem>
          <NSpace :size="12" wrap>
            <NFormItem :label="$t('practice.common.organizer')" style="width: 240px">
              <NInput v-model:value="prForm.organizer" />
            </NFormItem>
            <NFormItem :label="$t('practice.common.capacity')" required style="width: 160px">
              <NInputNumber v-model:value="prForm.capacity" :min="1" style="width: 100%" />
            </NFormItem>
          </NSpace>
          <NSpace :size="12" wrap>
            <NFormItem :label="$t('practice.common.startTime')" style="width: 240px">
              <NDatePicker
                v-model:value="prForm.startTs"
                type="datetime"
                clearable
                style="width: 100%"
              />
            </NFormItem>
            <NFormItem :label="$t('practice.common.endTime')" style="width: 240px">
              <NDatePicker
                v-model:value="prForm.endTs"
                type="datetime"
                clearable
                style="width: 100%"
              />
            </NFormItem>
          </NSpace>
          <NFormItem :label="$t('practice.common.description')">
            <NInput
              v-model:value="prForm.description"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showPrForm = false">{{ $t('practice.common.cancel') }}</NButton>
            <NButton type="primary" :loading="savingPr" @click="handleSavePr">{{
              $t('practice.common.save')
            }}</NButton>
          </NSpace>
        </template>
      </NModal>

      <!-- 申报列表 -->
      <NModal
        v-model:show="showApps"
        preset="card"
        :title="$t('practice.socialPractice.applicationsOf', { title: appsOf?.title ?? '' })"
        class="practice-app-modal"
      >
        <NSpin :show="appLoading">
          <NDataTable
            :columns="appColumns"
            :data="apps"
            :row-key="(r: SocialPracticeApplicationResponse) => r.id"
            :single-line="false"
            :bordered="false"
            :scroll-x="920"
            remote
            :pagination="appPagination"
          >
            <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NModal>

      <!-- 申报审核 -->
      <NModal
        v-model:show="showReviewApp"
        preset="card"
        :title="$t('practice.socialPractice.reviewApply')"
        class="practice-form-modal"
      >
        <NForm :model="reviewAppForm" label-placement="top">
          <NFormItem :label="$t('practice.socialPractice.approve')" required>
            <NRadioGroup v-model:value="reviewAppForm.approved">
              <NRadio :value="true">{{ $t('practice.socialPractice.approve') }}</NRadio>
              <NRadio :value="false">{{ $t('practice.socialPractice.reject') }}</NRadio>
            </NRadioGroup>
          </NFormItem>
          <NFormItem :label="$t('practice.common.reviewComment')">
            <NInput
              v-model:value="reviewAppForm.reviewComment"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showReviewApp = false">{{ $t('practice.common.cancel') }}</NButton>
            <NButton type="primary" :loading="savingReviewApp" @click="handleSaveReviewApp">{{
              $t('practice.common.confirm')
            }}</NButton>
          </NSpace>
        </template>
      </NModal>

      <!-- 报告评审 -->
      <NModal
        v-model:show="showReviewReport"
        preset="card"
        :title="$t('practice.socialPractice.reviewReport')"
        class="practice-form-modal"
      >
        <NForm :model="reviewReportForm" label-placement="top">
          <NFormItem :label="$t('practice.socialPractice.reportScore')">
            <NInputNumber
              v-model:value="reviewReportForm.score"
              :min="0"
              :max="100"
              style="width: 100%"
            />
          </NFormItem>
          <NFormItem :label="$t('practice.common.feedback')">
            <NInput
              v-model:value="reviewReportForm.feedback"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showReviewReport = false">{{ $t('practice.common.cancel') }}</NButton>
            <NButton type="primary" :loading="savingReviewReport" @click="handleSaveReviewReport">{{
              $t('practice.common.confirm')
            }}</NButton>
          </NSpace>
        </template>
      </NModal>
    </template>
  </div>
</template>

<style scoped src="./SocialPracticeManagementPage.css"></style>

<style>
.practice-form-modal {
  width: 600px;
  max-width: 92vw;
}
.practice-app-modal {
  width: 980px;
  max-width: 96vw;
}
</style>
