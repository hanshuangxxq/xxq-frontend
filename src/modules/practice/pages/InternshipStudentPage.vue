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
  NSelect,
  NTag,
  NSpin,
  NUpload,
  NPopconfirm,
  NTabs,
  NTabPane,
  NResult,
  useMessage,
  type DataTableColumns,
  type UploadFileInfo,
} from 'naive-ui'
import EmptyState from '@/shared/components/EmptyState.vue'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import {
  fetchAvailableInternships,
  applyInternship,
  fetchMyInternshipApplications,
  revokeInternshipApplication,
  fetchMyInternshipReports,
  submitInternshipReport,
  deleteInternshipReport,
  fetchAvailableTrainings,
  enrollTraining,
  fetchMyTrainingEnrollments,
  cancelTrainingEnrollment,
} from '../api'
import {
  auditStatusTagType,
  reportStatusTagType,
  enrollStatusTagType,
  formatDateTime,
  downloadPracticeFile,
} from '../utils'
import type {
  InternshipResponse,
  InternshipApplicationResponse,
  InternshipReportResponse,
  TrainingResponse,
  TrainingEnrollmentResponse,
} from '../types'

const { t } = useI18n()
const message = useMessage()
const { isStudent } = useRoleCheck()

const activeTab = ref('available')
const MAX_SIZE = 20 * 1024 * 1024

// ---- 可报名实习 ----
const availLoading = ref(false)
const available = ref<InternshipResponse[]>([])

async function loadAvailable() {
  availLoading.value = true
  try {
    const res = await fetchAvailableInternships()
    available.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    availLoading.value = false
  }
}

const showApply = ref(false)
const applyingItem = ref<InternshipResponse | null>(null)
const applyForm = ref<{ applyReason: string }>({ applyReason: '' })
const savingApply = ref(false)

function startApply(row: InternshipResponse) {
  applyingItem.value = row
  applyForm.value = { applyReason: '' }
  showApply.value = true
}

async function handleApply() {
  if (!applyingItem.value) return
  savingApply.value = true
  try {
    await applyInternship({
      internshipId: applyingItem.value.id,
      applyReason: applyForm.value.applyReason || undefined,
    })
    message.success(t('practice.common.operationSuccess'))
    showApply.value = false
    await loadMyApplications()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  } finally {
    savingApply.value = false
  }
}

const internshipRowKey = (row: InternshipResponse) => row.id

const availableColumns = computed<DataTableColumns<InternshipResponse>>(() => [
  { title: t('practice.internship.internshipTitle'), key: 'title', minWidth: 180, ellipsis: { tooltip: true } },
  { title: t('practice.common.company'), key: 'company', width: 130, ellipsis: { tooltip: true }, render: (r) => r.company || '-' },
  { title: t('practice.internship.supervisor'), key: 'supervisorName', width: 110, render: (r) => r.supervisorName || '-' },
  { title: t('practice.common.capacity'), key: 'capacity', width: 110, align: 'center', render: (r) => `${r.selectedCount} / ${r.capacity}` },
  { title: t('practice.common.startTime'), key: 'startTime', width: 150, render: (r) => formatDateTime(r.startTime) },
  { title: t('practice.common.endTime'), key: 'endTime', width: 150, render: (r) => formatDateTime(r.endTime) },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) => {
      const applied = myApplications.value.some(
        (a) => a.internshipId === row.id && (a.status === '待审核' || a.status === '已通过'),
      )
      if (applied) {
        return h(
          NButton,
          { size: 'small', type: 'primary', secondary: true, disabled: true },
          () => t('practice.internship.applied'),
        )
      }
      return h(NButton, { size: 'small', type: 'primary', onClick: () => startApply(row) }, () => t('practice.internship.apply'))
    },
  },
])

// ---- 我的报名 ----
const myAppLoading = ref(false)
const myApplications = ref<InternshipApplicationResponse[]>([])

async function loadMyApplications() {
  myAppLoading.value = true
  try {
    const res = await fetchMyInternshipApplications()
    myApplications.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    myAppLoading.value = false
  }
}

async function handleRevoke(id: number) {
  try {
    await revokeInternshipApplication(id)
    message.success(t('practice.common.revokeSuccess'))
    await loadMyApplications()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.revokeFail'))
  }
}

const internshipApplicationRowKey = (row: InternshipApplicationResponse) => row.id

const myAppColumns = computed<DataTableColumns<InternshipApplicationResponse>>(() => [
  { title: t('practice.internship.internshipTitle'), key: 'internshipTitle', minWidth: 180, ellipsis: { tooltip: true } },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 100,
    align: 'center',
    render: (r) => h(NTag, { type: auditStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  { title: t('practice.internship.apply'), key: 'applyReason', width: 150, ellipsis: { tooltip: true }, render: (r) => r.applyReason || '-' },
  { title: t('practice.common.applyTime'), key: 'applyTime', width: 150, render: (r) => formatDateTime(r.applyTime) },
  { title: t('practice.common.reviewTime'), key: 'reviewTime', width: 150, render: (r) => formatDateTime(r.reviewTime) },
  { title: t('practice.common.reviewComment'), key: 'reviewComment', width: 160, ellipsis: { tooltip: true }, render: (r) => r.reviewComment || '-' },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      row.status === '待审核'
        ? h(NPopconfirm, { onPositiveClick: () => handleRevoke(row.id) }, {
            default: () => t('practice.internship.revokeConfirm'),
            trigger: () => h(NButton, { size: 'small', type: 'warning' }, () => t('practice.internship.revoke')),
          })
        : '-',
  },
])

// ---- 我的实习报告 ----
const reportLoading = ref(false)
const myReports = ref<InternshipReportResponse[]>([])

async function loadMyReports() {
  reportLoading.value = true
  try {
    const res = await fetchMyInternshipReports()
    myReports.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    reportLoading.value = false
  }
}

const approvedInternships = computed(() => myApplications.value.filter((a) => a.status === '已通过'))
const internshipOptions = computed(() => approvedInternships.value.map((a) => ({ label: a.internshipTitle, value: a.internshipId })))

const showReportForm = ref(false)
const reportFormMode = ref<'create' | 'edit'>('create')
const reportForm = ref<{ internshipId: number | null; title: string; summary: string }>({ internshipId: null, title: '', summary: '' })
const fileList = ref<UploadFileInfo[]>([])
const savingReport = ref(false)

function startSubmitReport() {
  reportFormMode.value = 'create'
  reportForm.value = { internshipId: null, title: '', summary: '' }
  fileList.value = []
  showReportForm.value = true
}

function startResubmitReport(row: InternshipReportResponse) {
  reportFormMode.value = 'edit'
  reportForm.value = { internshipId: row.internshipId, title: row.title, summary: row.summary ?? '' }
  fileList.value = []
  showReportForm.value = true
}

async function handleSubmitReport() {
  const f = reportForm.value
  if (f.internshipId == null) return message.warning(t('practice.internship.internshipRequired'))
  if (!f.title.trim()) return message.warning(t('practice.internship.titleRequired'))
  const file = fileList.value[0]?.file
  if (!file) return message.warning(t('practice.common.fileRequired'))
  if (file.size > MAX_SIZE) return message.warning(t('practice.common.fileTooLarge'))
  savingReport.value = true
  try {
    await submitInternshipReport(
      { internshipId: f.internshipId, title: f.title.trim(), summary: f.summary || undefined },
      file,
    )
    message.success(t('practice.internship.submitSuccess'))
    showReportForm.value = false
    await loadMyReports()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.saveFail'))
  } finally {
    savingReport.value = false
  }
}

async function handleDownloadReport(id: number) {
  try {
    await downloadPracticeFile(`/practice/internship-reports/${id}/download`)
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  }
}

async function handleDeleteReport(id: number) {
  try {
    await deleteInternshipReport(id)
    message.success(t('practice.common.deleteSuccess'))
    await loadMyReports()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.deleteFail'))
  }
}

const internshipReportRowKey = (row: InternshipReportResponse) => row.id

const reportColumns = computed<DataTableColumns<InternshipReportResponse>>(() => [
  { title: t('practice.internship.internshipTitle'), key: 'internshipTitle', minWidth: 160, ellipsis: { tooltip: true } },
  { title: t('practice.internship.reportTitle'), key: 'title', minWidth: 160, ellipsis: { tooltip: true } },
  { title: t('practice.common.submitTime'), key: 'submitTime', width: 150, render: (r) => formatDateTime(r.submitTime) },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) => h(NTag, { type: reportStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  { title: t('practice.internship.reportScore'), key: 'score', width: 80, align: 'center', render: (r) => r.score ?? '-' },
  { title: t('practice.common.feedback'), key: 'feedback', width: 160, ellipsis: { tooltip: true }, render: (r) => r.feedback || '-' },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 260,
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        row.status === '已提交'
          ? h(NButton, { size: 'small', type: 'primary', onClick: () => startResubmitReport(row) }, () => t('practice.internship.resubmitReport'))
          : null,
        h(NButton, { size: 'small', onClick: () => handleDownloadReport(row.id) }, () => t('practice.internship.downloadReport')),
        row.status === '已提交'
          ? h(NPopconfirm, { onPositiveClick: () => handleDeleteReport(row.id) }, {
              default: () => t('practice.common.deleteConfirm'),
              trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('practice.common.delete')),
            })
          : null,
      ]),
  },
])

// ---- 可报名培训 ----
const availTrainLoading = ref(false)
const availableTrainings = ref<TrainingResponse[]>([])

async function loadAvailableTrainings() {
  availTrainLoading.value = true
  try {
    const res = await fetchAvailableTrainings()
    availableTrainings.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    availTrainLoading.value = false
  }
}

async function handleEnroll(row: TrainingResponse) {
  try {
    await enrollTraining(row.id)
    message.success(t('practice.common.operationSuccess'))
    await loadMyTrainings()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  }
}

const trainingRowKey = (row: TrainingResponse) => row.id

const availTrainColumns = computed<DataTableColumns<TrainingResponse>>(() => [
  { title: t('practice.internship.trainingTitle'), key: 'title', minWidth: 180, ellipsis: { tooltip: true } },
  { title: t('practice.common.teacher'), key: 'teacherName', width: 110, render: (r) => r.teacherName || '-' },
  { title: t('practice.common.enrolledCount'), key: 'capacity', width: 110, align: 'center', render: (r) => `${r.enrolledCount} / ${r.capacity}` },
  { title: t('practice.common.startTime'), key: 'startTime', width: 150, render: (r) => formatDateTime(r.startTime) },
  { title: t('practice.common.endTime'), key: 'endTime', width: 150, render: (r) => formatDateTime(r.endTime) },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) => h(NButton, { size: 'small', type: 'primary', onClick: () => handleEnroll(row) }, () => t('practice.internship.enroll')),
  },
])

// ---- 我的培训 ----
const myTrainLoading = ref(false)
const myTrainings = ref<TrainingEnrollmentResponse[]>([])

async function loadMyTrainings() {
  myTrainLoading.value = true
  try {
    const res = await fetchMyTrainingEnrollments()
    myTrainings.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    myTrainLoading.value = false
  }
}

async function handleCancelEnroll(id: number) {
  try {
    await cancelTrainingEnrollment(id)
    message.success(t('practice.common.operationSuccess'))
    await loadMyTrainings()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  }
}

const trainingEnrollmentRowKey = (row: TrainingEnrollmentResponse) => row.id

const myTrainColumns = computed<DataTableColumns<TrainingEnrollmentResponse>>(() => [
  { title: t('practice.internship.trainingTitle'), key: 'courseTitle', minWidth: 180, ellipsis: { tooltip: true } },
  { title: t('practice.common.enrollTime'), key: 'enrollTime', width: 180, render: (r) => formatDateTime(r.enrollTime) },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 110,
    align: 'center',
    render: (r) => h(NTag, { type: enrollStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 110,
    render: (row) =>
      row.status === '已报名'
        ? h(NPopconfirm, { onPositiveClick: () => handleCancelEnroll(row.id) }, {
            default: () => t('practice.internship.cancelEnrollConfirm'),
            trigger: () => h(NButton, { size: 'small', type: 'warning' }, () => t('practice.internship.cancelEnroll')),
          })
        : '-',
  },
])

onMounted(() => {
  if (!isStudent.value) return
  loadAvailable()
  loadMyApplications()
  loadMyReports()
  loadAvailableTrainings()
  loadMyTrainings()
})
</script>

<template>
  <div class="practice-page">
    <NResult
      v-if="!isStudent"
      status="403"
      :title="$t('practice.common.noPermission')"
      :description="$t('practice.common.noPermissionDesc')"
    />
    <template v-else>
    <NTabs v-model:value="activeTab" type="line" animated>
      <!-- 可报名实习 -->
      <NTabPane name="available" :tab="$t('practice.internship.tabAvailable')">
        <NCard>
          <NSpin :show="availLoading">
            <NDataTable :columns="availableColumns" :data="available" :row-key="internshipRowKey" :single-line="false" :bordered="false" :scroll-x="980">
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 我的报名 -->
      <NTabPane name="myApplications" :tab="$t('practice.internship.tabMyApplications')">
        <NCard>
          <NSpin :show="myAppLoading">
            <NDataTable :columns="myAppColumns" :data="myApplications" :row-key="internshipApplicationRowKey" :single-line="false" :bordered="false" :scroll-x="1080">
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 我的实习报告 -->
      <NTabPane name="myReports" :tab="$t('practice.internship.tabMyReports')">
        <NCard :title="$t('practice.internship.tabMyReports')">
          <template #header-extra>
            <NButton v-if="approvedInternships.length > 0" type="primary" @click="startSubmitReport">
              {{ $t('practice.internship.submitReport') }}
            </NButton>
          </template>
          <NSpin :show="reportLoading">
            <EmptyState v-if="!reportLoading && myReports.length === 0" :description="$t('practice.common.empty')" />
            <NDataTable v-else :columns="reportColumns" :data="myReports" :row-key="internshipReportRowKey" :single-line="false" :bordered="false" :scroll-x="1000">
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 可报名培训 -->
      <NTabPane name="availableTrainings" :tab="$t('practice.internship.tabAvailableTrainings')">
        <NCard>
          <NSpin :show="availTrainLoading">
            <NDataTable :columns="availTrainColumns" :data="availableTrainings" :row-key="trainingRowKey" :single-line="false" :bordered="false" :scroll-x="920">
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 我的培训 -->
      <NTabPane name="myTrainings" :tab="$t('practice.internship.tabMyTrainings')">
        <NCard>
          <NSpin :show="myTrainLoading">
            <NDataTable :columns="myTrainColumns" :data="myTrainings" :row-key="trainingEnrollmentRowKey" :single-line="false" :bordered="false" :scroll-x="700">
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>
    </NTabs>

    <!-- 报名实习 -->
    <NModal v-model:show="showApply" preset="card" :title="$t('practice.internship.apply')" class="practice-form-modal">
      <NForm :model="applyForm" label-placement="top">
        <NFormItem :label="$t('practice.internship.apply')">
          <NInput v-model:value="applyForm.applyReason" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showApply = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingApply" @click="handleApply">{{ $t('practice.common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 提交/重传报告 -->
    <NModal
      v-model:show="showReportForm"
      preset="card"
      :title="reportFormMode === 'edit' ? $t('practice.internship.resubmitReport') : $t('practice.internship.submitReport')"
      class="practice-form-modal"
    >
      <NForm :model="reportForm" label-placement="top">
        <NFormItem :label="$t('practice.internship.internshipTitle')" required>
          <NSelect
            v-model:value="reportForm.internshipId"
            :options="internshipOptions"
            :disabled="reportFormMode === 'edit'"
            :placeholder="$t('practice.internship.internshipRequired')"
          />
        </NFormItem>
        <NFormItem :label="$t('practice.internship.reportTitle')" required>
          <NInput v-model:value="reportForm.title" />
        </NFormItem>
        <NFormItem :label="$t('practice.common.summary')">
          <NInput v-model:value="reportForm.summary" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
        <NFormItem :label="$t('practice.common.selectFile')" required>
          <NUpload v-model:file-list="fileList" :max="1" :default-upload="false" accept=".doc,.docx,.pdf,.zip,.rar">
            <NButton>{{ $t('practice.common.selectFile') }}</NButton>
          </NUpload>
          <span class="file-hint">{{ $t('practice.common.fileHint') }}</span>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showReportForm = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingReport" @click="handleSubmitReport">{{ $t('practice.common.save') }}</NButton>
        </NSpace>
      </template>
    </NModal>
    </template>
  </div>
</template>

<style scoped src="./InternshipStudentPage.css"></style>

<style>
.practice-form-modal {
  width: 560px;
  max-width: 92vw;
}
</style>
