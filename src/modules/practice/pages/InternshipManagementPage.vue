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
  NDropdown,
  NTabs,
  NTabPane,
  NDatePicker,
  NRadioGroup,
  NRadio,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import EmptyState from '@/shared/components/EmptyState.vue'
import {
  fetchInternships,
  createInternship,
  updateInternship,
  updateInternshipStatus,
  deleteInternship,
  fetchInternshipApplications,
  reviewInternshipApplication,
  fetchInternshipReports,
  reviewInternshipReport,
  deleteInternshipReport,
  fetchTrainings,
  createTraining,
  updateTraining,
  updateTrainingStatus,
  deleteTraining,
  fetchTrainingEnrollments,
} from '../api'
import { fetchTeachers } from '@/modules/curriculum/api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import {
  projectStatusTagType,
  auditStatusTagType,
  reportStatusTagType,
  enrollStatusTagType,
  formatDateTime,
  tsToIso,
  downloadPracticeFile,
} from '../utils'
import type { Teacher } from '@/modules/curriculum/types'
import type {
  InternshipResponse,
  InternshipStatusCode,
  InternshipCreateRequest,
  InternshipApplicationResponse,
  InternshipReportResponse,
  InternshipReportReviewRequest,
  TrainingResponse,
  TrainingStatusCode,
  TrainingCreateRequest,
  TrainingEnrollmentResponse,
  ReportStatusCode,
} from '../types'

const { t } = useI18n()
const message = useMessage()
const { isTeacher, isAcademicAdmin } = useRoleCheck()
const canManage = computed(() => isTeacher.value || isAcademicAdmin.value)

const activeTab = ref('internships')

const projectStatusOptions = computed(() => [
  { label: t('practice.internship.internshipStatusDraft'), value: 'DRAFT' as InternshipStatusCode },
  { label: t('practice.internship.internshipStatusOpen'), value: 'OPEN' as InternshipStatusCode },
  { label: t('practice.internship.internshipStatusClosed'), value: 'CLOSED' as InternshipStatusCode },
])
const projectStatusDropdown = computed(() => [
  { label: t('practice.internship.internshipStatusDraft'), key: 'DRAFT' },
  { label: t('practice.internship.internshipStatusOpen'), key: 'OPEN' },
  { label: t('practice.internship.internshipStatusClosed'), key: 'CLOSED' },
])
const trainingStatusOptions = computed(() => [
  { label: t('practice.internship.trainingStatusDraft'), value: 'DRAFT' as TrainingStatusCode },
  { label: t('practice.internship.trainingStatusOpen'), value: 'OPEN' as TrainingStatusCode },
  { label: t('practice.internship.trainingStatusClosed'), value: 'CLOSED' as TrainingStatusCode },
])
const trainingStatusDropdown = computed(() => [
  { label: t('practice.internship.trainingStatusDraft'), key: 'DRAFT' },
  { label: t('practice.internship.trainingStatusOpen'), key: 'OPEN' },
  { label: t('practice.internship.trainingStatusClosed'), key: 'CLOSED' },
])
const reportStatusOptions = computed(() => [
  { label: t('practice.internship.reportStatusSubmitted'), value: 'SUBMITTED' as ReportStatusCode },
  { label: t('practice.internship.reportStatusReviewed'), value: 'REVIEWED' as ReportStatusCode },
])

// ============ 实习项目 ============
const internshipLoading = ref(false)
const internships = ref<InternshipResponse[]>([])
const { pagination: intPagination, reset: resetInt } = useRemotePagination(loadInternships)
const filterIntStatus = ref<InternshipStatusCode | null>(null)

async function loadInternships() {
  internshipLoading.value = true
  try {
    const res = await fetchInternships({
      status: filterIntStatus.value ?? undefined,
      page: intPagination.page,
      pageSize: intPagination.pageSize,
    })
    internships.value = res.data.records
    intPagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    internshipLoading.value = false
  }
}

function handleIntFilterChange() {
  resetInt()
  loadInternships()
}

async function handleIntStatusChange(row: InternshipResponse, code: string) {
  try {
    await updateInternshipStatus(row.id, code)
    message.success(t('practice.common.operationSuccess'))
    await loadInternships()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  }
}

async function handleDeleteInternship(id: number) {
  try {
    await deleteInternship(id)
    message.success(t('practice.common.deleteSuccess'))
    await loadInternships()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.deleteFail'))
  }
}

// 实习表单
interface IntForm {
  title: string
  company: string
  description: string
  supervisorId: number | null
  startTs: number | null
  endTs: number | null
  capacity: number | null
}
const showIntForm = ref(false)
const intFormMode = ref<'create' | 'edit'>('create')
const editingIntId = ref<number | null>(null)
const savingInt = ref(false)
const intSupervisorLabel = ref<string | undefined>(undefined)
const intForm = ref<IntForm>(emptyIntForm())

function emptyIntForm(): IntForm {
  return { title: '', company: '', description: '', supervisorId: null, startTs: null, endTs: null, capacity: null }
}

function startCreateInt() {
  intFormMode.value = 'create'
  editingIntId.value = null
  intForm.value = emptyIntForm()
  intSupervisorLabel.value = undefined
  showIntForm.value = true
}

function startEditInt(row: InternshipResponse) {
  intFormMode.value = 'edit'
  editingIntId.value = row.id
  intForm.value = {
    title: row.title,
    company: row.company ?? '',
    description: row.description ?? '',
    supervisorId: row.supervisorId || null,
    startTs: row.startTime ? new Date(row.startTime).getTime() : null,
    endTs: row.endTime ? new Date(row.endTime).getTime() : null,
    capacity: row.capacity,
  }
  intSupervisorLabel.value = row.supervisorName ?? undefined
  showIntForm.value = true
}

async function handleSaveInt() {
  const f = intForm.value
  if (!f.title.trim()) return message.warning(t('practice.internship.titleRequired'))
  if (f.capacity == null || f.capacity <= 0)
    return message.warning(t('practice.internship.capacityRequired'))
  const body: InternshipCreateRequest = {
    title: f.title.trim(),
    company: f.company || undefined,
    description: f.description || undefined,
    supervisorId: f.supervisorId,
    startTime: f.startTs != null ? tsToIso(f.startTs) : null,
    endTime: f.endTs != null ? tsToIso(f.endTs) : null,
    capacity: f.capacity,
  }
  savingInt.value = true
  try {
    if (intFormMode.value === 'create') {
      await createInternship(body)
    } else {
      await updateInternship(editingIntId.value!, {
        title: body.title,
        company: body.company,
        description: body.description,
        supervisorId: body.supervisorId,
        startTime: body.startTime,
        endTime: body.endTime,
        capacity: body.capacity,
      })
    }
    message.success(t('practice.common.saveSuccess'))
    showIntForm.value = false
    await loadInternships()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.saveFail'))
  } finally {
    savingInt.value = false
  }
}

// 实习报名列表
const showIntApps = ref(false)
const intAppsOf = ref<InternshipResponse | null>(null)
const intApps = ref<InternshipApplicationResponse[]>([])
const intAppLoading = ref(false)
const { pagination: intAppPagination, reset: resetIntApp } = useRemotePagination(loadIntApps)

async function loadIntApps() {
  if (!intAppsOf.value) return
  intAppLoading.value = true
  try {
    const res = await fetchInternshipApplications(
      intAppsOf.value.id,
      intAppPagination.page,
      intAppPagination.pageSize,
    )
    intApps.value = res.data.records
    intAppPagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    intAppLoading.value = false
  }
}

function openIntApps(row: InternshipResponse) {
  intAppsOf.value = row
  showIntApps.value = true
  resetIntApp()
  loadIntApps()
}

// 报名审核
const showReviewIntApp = ref(false)
const reviewingIntApp = ref<InternshipApplicationResponse | null>(null)
const reviewIntAppForm = ref<{ approved: boolean; reviewComment: string }>({ approved: true, reviewComment: '' })
const savingReviewIntApp = ref(false)

function startReviewIntApp(row: InternshipApplicationResponse) {
  reviewingIntApp.value = row
  reviewIntAppForm.value = { approved: true, reviewComment: '' }
  showReviewIntApp.value = true
}

async function handleSaveReviewIntApp() {
  if (!reviewingIntApp.value) return
  savingReviewIntApp.value = true
  try {
    await reviewInternshipApplication(reviewingIntApp.value.id, {
      approved: reviewIntAppForm.value.approved,
      reviewComment: reviewIntAppForm.value.reviewComment || undefined,
    })
    message.success(t('practice.common.operationSuccess'))
    showReviewIntApp.value = false
    await loadIntApps()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  } finally {
    savingReviewIntApp.value = false
  }
}

// ============ 实习报告 ============
const reportLoading = ref(false)
const reports = ref<InternshipReportResponse[]>([])
const { pagination: reportPagination, reset: resetReport } = useRemotePagination(loadReports)
const filterReportStatus = ref<ReportStatusCode | null>(null)
let reportsLoaded = false

async function loadReports() {
  reportLoading.value = true
  try {
    const res = await fetchInternshipReports({
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
    await downloadPracticeFile(`/practice/internship-reports/${id}/download`)
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  }
}

async function handleDeleteReport(id: number) {
  try {
    await deleteInternshipReport(id)
    message.success(t('practice.common.deleteSuccess'))
    await loadReports()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.deleteFail'))
  }
}

// 报告评审
const showReviewReport = ref(false)
const reviewingReport = ref<InternshipReportResponse | null>(null)
const reviewReportForm = ref<{ score: number | null; feedback: string }>({ score: null, feedback: '' })
const savingReviewReport = ref(false)

function startReviewReport(row: InternshipReportResponse) {
  reviewingReport.value = row
  reviewReportForm.value = { score: null, feedback: '' }
  showReviewReport.value = true
}

async function handleSaveReviewReport() {
  if (!reviewingReport.value) return
  const body: InternshipReportReviewRequest = {
    score: reviewReportForm.value.score ?? undefined,
    feedback: reviewReportForm.value.feedback || undefined,
  }
  savingReviewReport.value = true
  try {
    await reviewInternshipReport(reviewingReport.value.id, body)
    message.success(t('practice.common.operationSuccess'))
    showReviewReport.value = false
    await loadReports()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  } finally {
    savingReviewReport.value = false
  }
}

// ============ 培训课程 ============
const trainingLoading = ref(false)
const trainings = ref<TrainingResponse[]>([])
const { pagination: trainPagination, reset: resetTrain } = useRemotePagination(loadTrainings)
const filterTrainStatus = ref<TrainingStatusCode | null>(null)
let trainingsLoaded = false

async function loadTrainings() {
  trainingLoading.value = true
  try {
    const res = await fetchTrainings({
      status: filterTrainStatus.value ?? undefined,
      page: trainPagination.page,
      pageSize: trainPagination.pageSize,
    })
    trainings.value = res.data.records
    trainPagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    trainingLoading.value = false
  }
}

function handleTrainFilterChange() {
  resetTrain()
  loadTrainings()
}

async function handleTrainStatusChange(row: TrainingResponse, code: string) {
  try {
    await updateTrainingStatus(row.id, code)
    message.success(t('practice.common.operationSuccess'))
    await loadTrainings()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  }
}

async function handleDeleteTraining(id: number) {
  try {
    await deleteTraining(id)
    message.success(t('practice.common.deleteSuccess'))
    await loadTrainings()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.deleteFail'))
  }
}

// 培训表单
interface TrainForm {
  title: string
  description: string
  teacherId: number | null
  startTs: number | null
  endTs: number | null
  capacity: number | null
}
const showTrainForm = ref(false)
const trainFormMode = ref<'create' | 'edit'>('create')
const editingTrainId = ref<number | null>(null)
const savingTrain = ref(false)
const trainTeacherLabel = ref<string | undefined>(undefined)
const trainForm = ref<TrainForm>(emptyTrainForm())

function emptyTrainForm(): TrainForm {
  return { title: '', description: '', teacherId: null, startTs: null, endTs: null, capacity: null }
}

function startCreateTrain() {
  trainFormMode.value = 'create'
  editingTrainId.value = null
  trainForm.value = emptyTrainForm()
  trainTeacherLabel.value = undefined
  showTrainForm.value = true
}

function startEditTrain(row: TrainingResponse) {
  trainFormMode.value = 'edit'
  editingTrainId.value = row.id
  trainForm.value = {
    title: row.title,
    description: row.description ?? '',
    teacherId: row.teacherId || null,
    startTs: row.startTime ? new Date(row.startTime).getTime() : null,
    endTs: row.endTime ? new Date(row.endTime).getTime() : null,
    capacity: row.capacity,
  }
  trainTeacherLabel.value = row.teacherName ?? undefined
  showTrainForm.value = true
}

async function handleSaveTrain() {
  const f = trainForm.value
  if (!f.title.trim()) return message.warning(t('practice.internship.titleRequired'))
  if (f.capacity == null || f.capacity <= 0)
    return message.warning(t('practice.internship.capacityRequired'))
  const body: TrainingCreateRequest = {
    title: f.title.trim(),
    description: f.description || undefined,
    teacherId: f.teacherId,
    startTime: f.startTs != null ? tsToIso(f.startTs) : null,
    endTime: f.endTs != null ? tsToIso(f.endTs) : null,
    capacity: f.capacity,
  }
  savingTrain.value = true
  try {
    if (trainFormMode.value === 'create') {
      await createTraining(body)
    } else {
      await updateTraining(editingTrainId.value!, {
        title: body.title,
        description: body.description,
        teacherId: body.teacherId,
        startTime: body.startTime,
        endTime: body.endTime,
        capacity: body.capacity,
      })
    }
    message.success(t('practice.common.saveSuccess'))
    showTrainForm.value = false
    await loadTrainings()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.saveFail'))
  } finally {
    savingTrain.value = false
  }
}

// 培训报名列表（仅查看）
const showTrainEnrollments = ref(false)
const trainEnrollOf = ref<TrainingResponse | null>(null)
const enrollments = ref<TrainingEnrollmentResponse[]>([])
const enrollLoading = ref(false)
const { pagination: enrollPagination, reset: resetEnroll } = useRemotePagination(loadEnrollments)

async function loadEnrollments() {
  if (!trainEnrollOf.value) return
  enrollLoading.value = true
  try {
    const res = await fetchTrainingEnrollments(
      trainEnrollOf.value.id,
      enrollPagination.page,
      enrollPagination.pageSize,
    )
    enrollments.value = res.data.records
    enrollPagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    enrollLoading.value = false
  }
}

function openTrainEnrollments(row: TrainingResponse) {
  trainEnrollOf.value = row
  showTrainEnrollments.value = true
  resetEnroll()
  loadEnrollments()
}

function onTabChange(name: string | number) {
  if (name === 'reports' && !reportsLoaded) {
    reportsLoaded = true
    loadReports()
  } else if (name === 'trainings' && !trainingsLoaded) {
    trainingsLoaded = true
    loadTrainings()
  }
}

// ============ 列定义 ============
const internshipColumns = computed<DataTableColumns<InternshipResponse>>(() => [
  { title: t('practice.internship.internshipTitle'), key: 'title', minWidth: 180, ellipsis: { tooltip: true } },
  { title: t('practice.common.company'), key: 'company', width: 130, ellipsis: { tooltip: true }, render: (r) => r.company || '-' },
  { title: t('practice.internship.supervisor'), key: 'supervisorName', width: 110, render: (r) => r.supervisorName || '-' },
  {
    title: t('practice.common.capacity'),
    key: 'capacity',
    width: 110,
    align: 'center',
    render: (r) => `${r.selectedCount} / ${r.capacity}`,
  },
  { title: t('practice.common.startTime'), key: 'startTime', width: 150, render: (r) => formatDateTime(r.startTime) },
  { title: t('practice.common.endTime'), key: 'endTime', width: 150, render: (r) => formatDateTime(r.endTime) },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(NTag, { type: projectStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 250,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'small', onClick: () => startEditInt(row) }, () => t('practice.common.edit')),
        h(
          NDropdown,
          { options: projectStatusDropdown.value, onSelect: (key: string) => handleIntStatusChange(row, key) },
          () => h(NButton, { size: 'small' }, () => t('practice.common.status')),
        ),
        h(NButton, { size: 'small', onClick: () => openIntApps(row) }, () => t('practice.internship.viewApplications')),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDeleteInternship(row.id) },
          {
            default: () => t('practice.common.deleteConfirm'),
            trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('practice.common.delete')),
          },
        ),
      ]),
  },
])

const intAppColumns = computed<DataTableColumns<InternshipApplicationResponse>>(() => [
  { title: t('practice.common.student'), key: 'studentName', width: 110 },
  { title: t('practice.internship.apply'), key: 'applyReason', minWidth: 150, ellipsis: { tooltip: true }, render: (r) => r.applyReason || '-' },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(NTag, { type: auditStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  { title: t('practice.common.applyTime'), key: 'applyTime', width: 150, render: (r) => formatDateTime(r.applyTime) },
  { title: t('practice.common.reviewComment'), key: 'reviewComment', width: 150, ellipsis: { tooltip: true }, render: (r) => r.reviewComment || '-' },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      row.status === '待审核'
        ? h(NButton, { size: 'small', type: 'primary', onClick: () => startReviewIntApp(row) }, () => t('practice.internship.reviewApply'))
        : '-',
  },
])

const reportColumns = computed<DataTableColumns<InternshipReportResponse>>(() => [
  { title: t('practice.common.student'), key: 'studentName', width: 110 },
  { title: t('practice.internship.internshipTitle'), key: 'internshipTitle', minWidth: 160, ellipsis: { tooltip: true } },
  { title: t('practice.internship.reportTitle'), key: 'title', minWidth: 160, ellipsis: { tooltip: true } },
  { title: t('practice.common.submitTime'), key: 'submitTime', width: 150, render: (r) => formatDateTime(r.submitTime) },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(NTag, { type: reportStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  { title: t('practice.internship.reportScore'), key: 'score', width: 80, align: 'center', render: (r) => r.score ?? '-' },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 240,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'small', type: 'primary', onClick: () => startReviewReport(row) }, () => t('practice.internship.reviewReport')),
        h(NButton, { size: 'small', onClick: () => handleDownloadReport(row.id) }, () => t('practice.internship.downloadReport')),
        h(NPopconfirm, { onPositiveClick: () => handleDeleteReport(row.id) }, {
          default: () => t('practice.common.deleteConfirm'),
          trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('practice.common.delete')),
        }),
      ]),
  },
])

const trainingColumns = computed<DataTableColumns<TrainingResponse>>(() => [
  { title: t('practice.internship.trainingTitle'), key: 'title', minWidth: 180, ellipsis: { tooltip: true } },
  { title: t('practice.common.teacher'), key: 'teacherName', width: 110, render: (r) => r.teacherName || '-' },
  {
    title: t('practice.common.enrolledCount'),
    key: 'capacity',
    width: 110,
    align: 'center',
    render: (r) => `${r.enrolledCount} / ${r.capacity}`,
  },
  { title: t('practice.common.startTime'), key: 'startTime', width: 150, render: (r) => formatDateTime(r.startTime) },
  { title: t('practice.common.endTime'), key: 'endTime', width: 150, render: (r) => formatDateTime(r.endTime) },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(NTag, { type: projectStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 250,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'small', onClick: () => startEditTrain(row) }, () => t('practice.common.edit')),
        h(
          NDropdown,
          { options: trainingStatusDropdown.value, onSelect: (key: string) => handleTrainStatusChange(row, key) },
          () => h(NButton, { size: 'small' }, () => t('practice.common.status')),
        ),
        h(NButton, { size: 'small', onClick: () => openTrainEnrollments(row) }, () => t('practice.internship.viewEnrollments')),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDeleteTraining(row.id) },
          {
            default: () => t('practice.common.deleteConfirm'),
            trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('practice.common.delete')),
          },
        ),
      ]),
  },
])

const enrollmentColumns = computed<DataTableColumns<TrainingEnrollmentResponse>>(() => [
  { title: t('practice.common.student'), key: 'studentName', width: 140 },
  { title: t('practice.common.enrollTime'), key: 'enrollTime', width: 180, render: (r) => formatDateTime(r.enrollTime) },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 120,
    align: 'center',
    render: (r) =>
      h(NTag, { type: enrollStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
])

onMounted(() => {
  loadInternships()
})
</script>

<template>
  <div class="practice-page">
    <NTabs v-model:value="activeTab" type="line" animated @update:value="onTabChange">
      <!-- 实习项目 -->
      <NTabPane name="internships" :tab="$t('practice.internship.tabInternships')">
        <NCard :title="$t('practice.internship.tabInternships')">
          <template #header-extra>
            <NSpace align="center">
              <NSelect
                v-model:value="filterIntStatus"
                :options="projectStatusOptions"
                :placeholder="$t('practice.common.allStatus')"
                clearable
                style="width: 150px"
                @update:value="handleIntFilterChange"
              />
              <NButton type="primary" @click="loadInternships">{{ $t('practice.common.query') }}</NButton>
              <NButton @click="handleIntFilterChange">{{ $t('practice.common.reset') }}</NButton>
              <NButton v-if="canManage" type="primary" @click="startCreateInt">
                {{ $t('practice.internship.addInternship') }}
              </NButton>
            </NSpace>
          </template>
          <NSpin :show="internshipLoading">
            <NDataTable
              :columns="internshipColumns"
              :data="internships"
              :row-key="(r: InternshipResponse) => r.id"
              :single-line="false"
              :bordered="false"
              :scroll-x="1180"
              remote
              :pagination="intPagination"
            >
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 实习报告 -->
      <NTabPane name="reports" :tab="$t('practice.internship.tabReports')">
        <NCard :title="$t('practice.internship.tabReports')">
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
              <NButton type="primary" @click="loadReports">{{ $t('practice.common.query') }}</NButton>
              <NButton @click="handleReportFilterChange">{{ $t('practice.common.reset') }}</NButton>
            </NSpace>
          </template>
          <NSpin :show="reportLoading">
            <NDataTable
              :columns="reportColumns"
              :data="reports"
              :row-key="(r: InternshipReportResponse) => r.id"
              :single-line="false"
              :bordered="false"
              :scroll-x="980"
              remote
              :pagination="reportPagination"
            >
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 培训课程 -->
      <NTabPane name="trainings" :tab="$t('practice.internship.tabTrainings')">
        <NCard :title="$t('practice.internship.tabTrainings')">
          <template #header-extra>
            <NSpace align="center">
              <NSelect
                v-model:value="filterTrainStatus"
                :options="trainingStatusOptions"
                :placeholder="$t('practice.common.allStatus')"
                clearable
                style="width: 150px"
                @update:value="handleTrainFilterChange"
              />
              <NButton type="primary" @click="loadTrainings">{{ $t('practice.common.query') }}</NButton>
              <NButton @click="handleTrainFilterChange">{{ $t('practice.common.reset') }}</NButton>
              <NButton v-if="canManage" type="primary" @click="startCreateTrain">
                {{ $t('practice.internship.addTraining') }}
              </NButton>
            </NSpace>
          </template>
          <NSpin :show="trainingLoading">
            <NDataTable
              :columns="trainingColumns"
              :data="trainings"
              :row-key="(r: TrainingResponse) => r.id"
              :single-line="false"
              :bordered="false"
              :scroll-x="1180"
              remote
              :pagination="trainPagination"
            >
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>
    </NTabs>

    <!-- 实习表单 -->
    <NModal
      v-model:show="showIntForm"
      preset="card"
      :title="intFormMode === 'create' ? $t('practice.internship.addInternship') : $t('practice.internship.editInternship')"
      class="practice-form-modal"
    >
      <NForm :model="intForm" label-placement="top">
        <NFormItem :label="$t('practice.internship.internshipTitle')" required>
          <NInput v-model:value="intForm.title" />
        </NFormItem>
        <NSpace :size="12" wrap>
          <NFormItem :label="$t('practice.common.company')" style="width: 240px">
            <NInput v-model:value="intForm.company" />
          </NFormItem>
          <NFormItem :label="$t('practice.internship.supervisor')" style="width: 240px">
            <PagedSelect
              :model-value="intForm.supervisorId"
              :fetch-page="(page: number, pageSize: number) => fetchTeachers(page, pageSize)"
              :label-of="(tch: Teacher) => `${tch.name} (${tch.title})`"
              :value-of="(tch: Teacher) => tch.id"
              :initial-label="intSupervisorLabel"
              clearable
              filterable
              @update:model-value="(v: string | number | null | Array<string | number>) => (intForm.supervisorId = v as number | null)"
            />
          </NFormItem>
          <NFormItem :label="$t('practice.common.capacity')" required style="width: 160px">
            <NInputNumber v-model:value="intForm.capacity" :min="1" style="width: 100%" />
          </NFormItem>
        </NSpace>
        <NSpace :size="12" wrap>
          <NFormItem :label="$t('practice.common.startTime')" style="width: 240px">
            <NDatePicker v-model:value="intForm.startTs" type="datetime" clearable style="width: 100%" />
          </NFormItem>
          <NFormItem :label="$t('practice.common.endTime')" style="width: 240px">
            <NDatePicker v-model:value="intForm.endTs" type="datetime" clearable style="width: 100%" />
          </NFormItem>
        </NSpace>
        <NFormItem :label="$t('practice.common.description')">
          <NInput v-model:value="intForm.description" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showIntForm = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingInt" @click="handleSaveInt">{{ $t('practice.common.save') }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 实习报名列表 -->
    <NModal
      v-model:show="showIntApps"
      preset="card"
      :title="$t('practice.internship.applicationsOf', { title: intAppsOf?.title ?? '' })"
      class="practice-app-modal"
    >
      <NSpin :show="intAppLoading">
        <NDataTable
          :columns="intAppColumns"
          :data="intApps"
          :row-key="(r: InternshipApplicationResponse) => r.id"
          :single-line="false"
          :bordered="false"
          :scroll-x="760"
          remote
          :pagination="intAppPagination"
        >
          <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
        </NDataTable>
      </NSpin>
    </NModal>

    <!-- 报名审核 -->
    <NModal
      v-model:show="showReviewIntApp"
      preset="card"
      :title="$t('practice.internship.reviewApply')"
      class="practice-form-modal"
    >
      <NForm :model="reviewIntAppForm" label-placement="top">
        <NFormItem :label="$t('practice.internship.approve')" required>
          <NRadioGroup v-model:value="reviewIntAppForm.approved">
            <NRadio :value="true">{{ $t('practice.internship.approve') }}</NRadio>
            <NRadio :value="false">{{ $t('practice.internship.reject') }}</NRadio>
          </NRadioGroup>
        </NFormItem>
        <NFormItem :label="$t('practice.common.reviewComment')">
          <NInput v-model:value="reviewIntAppForm.reviewComment" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showReviewIntApp = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingReviewIntApp" @click="handleSaveReviewIntApp">{{ $t('practice.common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 报告评审 -->
    <NModal
      v-model:show="showReviewReport"
      preset="card"
      :title="$t('practice.internship.reviewReport')"
      class="practice-form-modal"
    >
      <NForm :model="reviewReportForm" label-placement="top">
        <NFormItem :label="$t('practice.internship.reportScore')">
          <NInputNumber v-model:value="reviewReportForm.score" :min="0" :max="100" style="width: 100%" />
        </NFormItem>
        <NFormItem :label="$t('practice.common.feedback')">
          <NInput v-model:value="reviewReportForm.feedback" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showReviewReport = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingReviewReport" @click="handleSaveReviewReport">{{ $t('practice.common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 培训表单 -->
    <NModal
      v-model:show="showTrainForm"
      preset="card"
      :title="trainFormMode === 'create' ? $t('practice.internship.addTraining') : $t('practice.internship.editTraining')"
      class="practice-form-modal"
    >
      <NForm :model="trainForm" label-placement="top">
        <NFormItem :label="$t('practice.internship.trainingTitle')" required>
          <NInput v-model:value="trainForm.title" />
        </NFormItem>
        <NSpace :size="12" wrap>
          <NFormItem :label="$t('practice.common.teacher')" style="width: 240px">
            <PagedSelect
              :model-value="trainForm.teacherId"
              :fetch-page="(page: number, pageSize: number) => fetchTeachers(page, pageSize)"
              :label-of="(tch: Teacher) => `${tch.name} (${tch.title})`"
              :value-of="(tch: Teacher) => tch.id"
              :initial-label="trainTeacherLabel"
              clearable
              filterable
              @update:model-value="(v: string | number | null | Array<string | number>) => (trainForm.teacherId = v as number | null)"
            />
          </NFormItem>
          <NFormItem :label="$t('practice.common.capacity')" required style="width: 160px">
            <NInputNumber v-model:value="trainForm.capacity" :min="1" style="width: 100%" />
          </NFormItem>
        </NSpace>
        <NSpace :size="12" wrap>
          <NFormItem :label="$t('practice.common.startTime')" style="width: 240px">
            <NDatePicker v-model:value="trainForm.startTs" type="datetime" clearable style="width: 100%" />
          </NFormItem>
          <NFormItem :label="$t('practice.common.endTime')" style="width: 240px">
            <NDatePicker v-model:value="trainForm.endTs" type="datetime" clearable style="width: 100%" />
          </NFormItem>
        </NSpace>
        <NFormItem :label="$t('practice.common.description')">
          <NInput v-model:value="trainForm.description" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showTrainForm = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingTrain" @click="handleSaveTrain">{{ $t('practice.common.save') }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 培训报名列表 -->
    <NModal
      v-model:show="showTrainEnrollments"
      preset="card"
      :title="$t('practice.internship.enrollmentsOf', { title: trainEnrollOf?.title ?? '' })"
      class="practice-app-modal"
    >
      <NSpin :show="enrollLoading">
        <NDataTable
          :columns="enrollmentColumns"
          :data="enrollments"
          :row-key="(r: TrainingEnrollmentResponse) => r.id"
          :single-line="false"
          :bordered="false"
          remote
          :pagination="enrollPagination"
        >
          <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
        </NDataTable>
      </NSpin>
    </NModal>
  </div>
</template>

<style scoped src="./InternshipManagementPage.css"></style>

<style>
.practice-form-modal {
  width: 620px;
  max-width: 92vw;
}
.practice-app-modal {
  width: 820px;
  max-width: 96vw;
}
</style>
