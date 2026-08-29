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
  NRadioGroup,
  NRadio,
  NResult,
  useMessage,
  type DataTableColumns,
  type UploadFileInfo,
} from 'naive-ui'
import EmptyState from '@/shared/components/EmptyState.vue'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import {
  fetchAvailableSocialPractices,
  applySocialPractice,
  fetchMySocialPracticeApplications,
  revokeSocialPracticeApplication,
  fetchMySocialPracticeReports,
  submitSocialPracticeReport,
  deleteSocialPracticeReport,
} from '../api'
import { fetchStudents } from '@/modules/student-management/api'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import {
  auditStatusTagType,
  reportStatusTagType,
  formatDateTime,
  parseMembers,
  joinMembers,
  downloadPracticeFile,
} from '../utils'
import type { Student } from '@/modules/student-management/types'
import type {
  SocialPracticeResponse,
  SocialPracticeApplicationResponse,
  SocialPracticeReportResponse,
} from '../types'

const { t } = useI18n()
const message = useMessage()
const { isStudent } = useRoleCheck()

const activeTab = ref('available')
const MAX_SIZE = 20 * 1024 * 1024

// ---- 可申报项目 ----
const availLoading = ref(false)
const available = ref<SocialPracticeResponse[]>([])

async function loadAvailable() {
  availLoading.value = true
  try {
    const res = await fetchAvailableSocialPractices()
    available.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    availLoading.value = false
  }
}

const showApply = ref(false)
const applyingItem = ref<SocialPracticeResponse | null>(null)
const applyForm = ref<{
  teamMode: 'individual' | 'team'
  teamName: string
  members: Array<number>
  applyReason: string
}>({ teamMode: 'individual', teamName: '', members: [], applyReason: '' })
const savingApply = ref(false)

const fetchStudentsPage = (page: number, pageSize: number) => fetchStudents({ page, pageSize })
const studentLabelOf = (s: Student) => s.name
const studentValueOf = (s: Student) => s.userId

function startApply(row: SocialPracticeResponse) {
  applyingItem.value = row
  applyForm.value = { teamMode: 'individual', teamName: '', members: [], applyReason: '' }
  showApply.value = true
}

async function handleApply() {
  if (!applyingItem.value) return
  const f = applyForm.value
  const body =
    f.teamMode === 'team'
      ? {
          practiceId: applyingItem.value.id,
          teamName: f.teamName.trim() || undefined,
          members: joinMembers(f.members),
          applyReason: f.applyReason || undefined,
        }
      : {
          practiceId: applyingItem.value.id,
          applyReason: f.applyReason || undefined,
        }
  savingApply.value = true
  try {
    await applySocialPractice(body)
    message.success(t('practice.common.operationSuccess'))
    showApply.value = false
    await loadMyApplications()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  } finally {
    savingApply.value = false
  }
}

const socialPracticeRowKey = (row: SocialPracticeResponse) => row.id

const availableColumns = computed<DataTableColumns<SocialPracticeResponse>>(() => [
  { title: t('practice.socialPractice.practiceTitle'), key: 'title', minWidth: 180, ellipsis: { tooltip: true } },
  { title: t('practice.common.organizer'), key: 'organizer', width: 130, ellipsis: { tooltip: true }, render: (r) => r.organizer || '-' },
  { title: t('practice.common.capacity'), key: 'capacity', width: 110, align: 'center', render: (r) => `${r.selectedCount} / ${r.capacity}` },
  { title: t('practice.common.startTime'), key: 'startTime', width: 150, render: (r) => formatDateTime(r.startTime) },
  { title: t('practice.common.endTime'), key: 'endTime', width: 150, render: (r) => formatDateTime(r.endTime) },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) => h(NButton, { size: 'small', type: 'primary', onClick: () => startApply(row) }, () => t('practice.socialPractice.apply')),
  },
])

// ---- 我的申报 ----
const myAppLoading = ref(false)
const myApplications = ref<SocialPracticeApplicationResponse[]>([])

async function loadMyApplications() {
  myAppLoading.value = true
  try {
    const res = await fetchMySocialPracticeApplications()
    myApplications.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    myAppLoading.value = false
  }
}

async function handleRevoke(id: number) {
  try {
    await revokeSocialPracticeApplication(id)
    message.success(t('practice.common.revokeSuccess'))
    await loadMyApplications()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.revokeFail'))
  }
}

const socialPracticeApplicationRowKey = (row: SocialPracticeApplicationResponse) => row.id

const myAppColumns = computed<DataTableColumns<SocialPracticeApplicationResponse>>(() => [
  { title: t('practice.socialPractice.practiceTitle'), key: 'practiceTitle', minWidth: 180, ellipsis: { tooltip: true } },
  { title: t('practice.socialPractice.teamName'), key: 'teamName', width: 120, render: (r) => r.teamName || '-' },
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
    width: 100,
    align: 'center',
    render: (r) => h(NTag, { type: auditStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  { title: t('practice.socialPractice.applyReason'), key: 'applyReason', width: 150, ellipsis: { tooltip: true }, render: (r) => r.applyReason || '-' },
  { title: t('practice.common.applyTime'), key: 'applyTime', width: 150, render: (r) => formatDateTime(r.applyTime) },
  { title: t('practice.common.reviewTime'), key: 'reviewTime', width: 150, render: (r) => formatDateTime(r.reviewTime) },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      row.status === '待审核'
        ? h(NPopconfirm, { onPositiveClick: () => handleRevoke(row.id) }, {
            default: () => t('practice.socialPractice.revokeConfirm'),
            trigger: () => h(NButton, { size: 'small', type: 'warning' }, () => t('practice.socialPractice.revoke')),
          })
        : '-',
  },
])

// ---- 我的报告 ----
const reportLoading = ref(false)
const myReports = ref<SocialPracticeReportResponse[]>([])

async function loadMyReports() {
  reportLoading.value = true
  try {
    const res = await fetchMySocialPracticeReports()
    myReports.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    reportLoading.value = false
  }
}

const approvedPractices = computed(() => myApplications.value.filter((a) => a.status === '已通过'))
const practiceOptions = computed(() => approvedPractices.value.map((a) => ({ label: a.practiceTitle, value: a.practiceId })))

const showReportForm = ref(false)
const reportFormMode = ref<'create' | 'edit'>('create')
const reportForm = ref<{ practiceId: number | null; title: string; summary: string }>({ practiceId: null, title: '', summary: '' })
const fileList = ref<UploadFileInfo[]>([])
const savingReport = ref(false)

function startSubmitReport() {
  reportFormMode.value = 'create'
  reportForm.value = { practiceId: null, title: '', summary: '' }
  fileList.value = []
  showReportForm.value = true
}

function startResubmitReport(row: SocialPracticeReportResponse) {
  reportFormMode.value = 'edit'
  reportForm.value = { practiceId: row.practiceId, title: row.title, summary: row.summary ?? '' }
  fileList.value = []
  showReportForm.value = true
}

async function handleSubmitReport() {
  const f = reportForm.value
  if (f.practiceId == null) return message.warning(t('practice.socialPractice.practiceRequired'))
  if (!f.title.trim()) return message.warning(t('practice.socialPractice.titleRequired'))
  const file = fileList.value[0]?.file
  if (!file) return message.warning(t('practice.common.fileRequired'))
  if (file.size > MAX_SIZE) return message.warning(t('practice.common.fileTooLarge'))
  savingReport.value = true
  try {
    await submitSocialPracticeReport(
      { practiceId: f.practiceId, title: f.title.trim(), summary: f.summary || undefined },
      file,
    )
    message.success(t('practice.socialPractice.submitSuccess'))
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
    await downloadPracticeFile(`/practice/social-practice-reports/${id}/download`)
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  }
}

async function handleDeleteReport(id: number) {
  try {
    await deleteSocialPracticeReport(id)
    message.success(t('practice.common.deleteSuccess'))
    await loadMyReports()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.deleteFail'))
  }
}

const socialPracticeReportRowKey = (row: SocialPracticeReportResponse) => row.id

const reportColumns = computed<DataTableColumns<SocialPracticeReportResponse>>(() => [
  { title: t('practice.socialPractice.practiceTitle'), key: 'practiceTitle', minWidth: 160, ellipsis: { tooltip: true } },
  { title: t('practice.socialPractice.reportTitle'), key: 'title', minWidth: 160, ellipsis: { tooltip: true } },
  { title: t('practice.common.submitTime'), key: 'submitTime', width: 150, render: (r) => formatDateTime(r.submitTime) },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) => h(NTag, { type: reportStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  { title: t('practice.socialPractice.reportScore'), key: 'score', width: 80, align: 'center', render: (r) => r.score ?? '-' },
  { title: t('practice.common.feedback'), key: 'feedback', width: 160, ellipsis: { tooltip: true }, render: (r) => r.feedback || '-' },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 260,
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        row.status === '已提交'
          ? h(NButton, { size: 'small', type: 'primary', onClick: () => startResubmitReport(row) }, () => t('practice.socialPractice.resubmitReport'))
          : null,
        h(NButton, { size: 'small', onClick: () => handleDownloadReport(row.id) }, () => t('practice.socialPractice.downloadReport')),
        row.status === '已提交'
          ? h(NPopconfirm, { onPositiveClick: () => handleDeleteReport(row.id) }, {
              default: () => t('practice.common.deleteConfirm'),
              trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('practice.common.delete')),
            })
          : null,
      ]),
  },
])

onMounted(() => {
  if (!isStudent.value) return
  loadAvailable()
  loadMyApplications()
  loadMyReports()
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
      <!-- 可申报项目 -->
      <NTabPane name="available" :tab="$t('practice.socialPractice.tabAvailable')">
        <NCard>
          <NSpin :show="availLoading">
            <NDataTable :columns="availableColumns" :data="available" :row-key="socialPracticeRowKey" :single-line="false" :bordered="false" :scroll-x="880">
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 我的申报 -->
      <NTabPane name="myApplications" :tab="$t('practice.socialPractice.tabMyApplications')">
        <NCard>
          <NSpin :show="myAppLoading">
            <NDataTable :columns="myAppColumns" :data="myApplications" :row-key="socialPracticeApplicationRowKey" :single-line="false" :bordered="false" :scroll-x="1120">
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 我的报告 -->
      <NTabPane name="myReports" :tab="$t('practice.socialPractice.tabMyReports')">
        <NCard :title="$t('practice.socialPractice.tabMyReports')">
          <template #header-extra>
            <NButton v-if="approvedPractices.length > 0" type="primary" @click="startSubmitReport">
              {{ $t('practice.socialPractice.submitReport') }}
            </NButton>
          </template>
          <NSpin :show="reportLoading">
            <EmptyState v-if="!reportLoading && myReports.length === 0" :description="$t('practice.common.empty')" />
            <NDataTable v-else :columns="reportColumns" :data="myReports" :row-key="socialPracticeReportRowKey" :single-line="false" :bordered="false" :scroll-x="1000">
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>
    </NTabs>

    <!-- 申报 -->
    <NModal v-model:show="showApply" preset="card" :title="$t('practice.socialPractice.apply')" class="practice-form-modal">
      <NForm :model="applyForm" label-placement="top">
        <NFormItem :label="$t('practice.competition.teamMode')" required>
          <NRadioGroup v-model:value="applyForm.teamMode">
            <NRadio value="individual">{{ $t('practice.competition.individual') }}</NRadio>
            <NRadio value="team">{{ $t('practice.competition.team') }}</NRadio>
          </NRadioGroup>
        </NFormItem>
        <template v-if="applyForm.teamMode === 'team'">
          <NFormItem :label="$t('practice.socialPractice.teamName')">
            <NInput v-model:value="applyForm.teamName" />
          </NFormItem>
          <NFormItem :label="$t('practice.socialPractice.members')">
            <PagedSelect
              v-model="applyForm.members"
              :fetch-page="fetchStudentsPage"
              :label-of="studentLabelOf"
              :value-of="studentValueOf"
              multiple
              filterable
              :placeholder="$t('practice.common.membersPlaceholder')"
            />
          </NFormItem>
        </template>
        <NFormItem :label="$t('practice.socialPractice.applyReason')">
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
      :title="reportFormMode === 'edit' ? $t('practice.socialPractice.resubmitReport') : $t('practice.socialPractice.submitReport')"
      class="practice-form-modal"
    >
      <NForm :model="reportForm" label-placement="top">
        <NFormItem :label="$t('practice.socialPractice.practiceTitle')" required>
          <NSelect
            v-model:value="reportForm.practiceId"
            :options="practiceOptions"
            :disabled="reportFormMode === 'edit'"
            :placeholder="$t('practice.socialPractice.practiceRequired')"
          />
        </NFormItem>
        <NFormItem :label="$t('practice.socialPractice.reportTitle')" required>
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

<style scoped src="./SocialPracticeStudentPage.css"></style>

<style>
.practice-form-modal {
  width: 560px;
  max-width: 92vw;
}
</style>
