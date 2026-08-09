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
  NDatePicker,
  NRadioGroup,
  NRadio,
  NResult,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import EmptyState from '@/shared/components/EmptyState.vue'
import {
  fetchCompetitions,
  createCompetition,
  updateCompetition,
  updateCompetitionStatus,
  deleteCompetition,
  fetchCompetitionRegistrations,
  reviewCompetitionRegistration,
  fetchCompetitionResults,
  saveCompetitionResult,
  deleteCompetitionResult,
} from '../api'
import { fetchAllPages } from '@/shared/pagination'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import {
  projectStatusTagType,
  auditStatusTagType,
  formatDateTime,
  tsToIso,
  parseMembers,
} from '../utils'
import type {
  CompetitionResponse,
  CompetitionStatusCode,
  CompetitionCreateRequest,
  CompetitionLevelCode,
  RegistrationResponse,
  CompetitionResultResponse,
  AwardCode,
} from '../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const loading = ref(false)
const competitions = ref<CompetitionResponse[]>([])
const { pagination, reset } = useRemotePagination(loadData)
const filterStatus = ref<CompetitionStatusCode | null>(null)

const statusOptions = computed(() => [
  { label: t('practice.competition.statusDraft'), value: 'DRAFT' as CompetitionStatusCode },
  { label: t('practice.competition.statusOpen'), value: 'OPEN' as CompetitionStatusCode },
  { label: t('practice.competition.statusClosed'), value: 'CLOSED' as CompetitionStatusCode },
  { label: t('practice.competition.statusEnded'), value: 'ENDED' as CompetitionStatusCode },
])
const statusDropdown = computed(() => [
  { label: t('practice.competition.statusDraft'), key: 'DRAFT' },
  { label: t('practice.competition.statusOpen'), key: 'OPEN' },
  { label: t('practice.competition.statusClosed'), key: 'CLOSED' },
  { label: t('practice.competition.statusEnded'), key: 'ENDED' },
])
const levelOptions = computed(() => [
  { label: t('practice.competition.levelNational'), value: 'NATIONAL' as CompetitionLevelCode },
  { label: t('practice.competition.levelProvincial'), value: 'PROVINCIAL' as CompetitionLevelCode },
  { label: t('practice.competition.levelSchool'), value: 'SCHOOL' as CompetitionLevelCode },
])
const awardOptions = computed(() => [
  { label: t('practice.competition.awardFirst'), value: 'FIRST' as AwardCode },
  { label: t('practice.competition.awardSecond'), value: 'SECOND' as AwardCode },
  { label: t('practice.competition.awardThird'), value: 'THIRD' as AwardCode },
  { label: t('practice.competition.awardExcellence'), value: 'EXCELLENCE' as AwardCode },
  { label: t('practice.competition.awardParticipation'), value: 'PARTICIPATION' as AwardCode },
])

async function loadData() {
  loading.value = true
  try {
    const res = await fetchCompetitions({
      status: filterStatus.value ?? undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    competitions.value = res.data.records
    pagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  reset()
  loadData()
}

async function handleStatusChange(row: CompetitionResponse, code: string) {
  try {
    await updateCompetitionStatus(row.id, code)
    message.success(t('practice.common.operationSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  }
}

async function handleDelete(id: number) {
  try {
    await deleteCompetition(id)
    message.success(t('practice.common.deleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.deleteFail'))
  }
}

// ---- 竞赛表单 ----
interface CompForm {
  name: string
  description: string
  organizer: string
  level: CompetitionLevelCode
  regStartTs: number | null
  regEndTs: number | null
  contestTs: number | null
}
const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)
const form = ref<CompForm>(emptyForm())

function emptyForm(): CompForm {
  return { name: '', description: '', organizer: '', level: 'SCHOOL', regStartTs: null, regEndTs: null, contestTs: null }
}

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(row: CompetitionResponse) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = {
    name: row.name,
    description: row.description ?? '',
    organizer: row.organizer ?? '',
    level: codeFromLevel(row.level),
    regStartTs: row.regStartTime ? new Date(row.regStartTime).getTime() : null,
    regEndTs: row.regEndTime ? new Date(row.regEndTime).getTime() : null,
    contestTs: row.contestTime ? new Date(row.contestTime).getTime() : null,
  }
  showForm.value = true
}

function codeFromLevel(level: string): CompetitionLevelCode {
  if (level === '国家级') return 'NATIONAL'
  if (level === '省级') return 'PROVINCIAL'
  return 'SCHOOL'
}

async function handleSave() {
  const f = form.value
  if (!f.name.trim()) return message.warning(t('practice.competition.nameRequired'))
  const body: CompetitionCreateRequest = {
    name: f.name.trim(),
    description: f.description || undefined,
    organizer: f.organizer || undefined,
    level: f.level,
    regStartTime: f.regStartTs != null ? tsToIso(f.regStartTs) : null,
    regEndTime: f.regEndTs != null ? tsToIso(f.regEndTs) : null,
    contestTime: f.contestTs != null ? tsToIso(f.contestTs) : null,
  }
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createCompetition(body)
    } else {
      await updateCompetition(editingId.value!, {
        name: body.name,
        description: body.description,
        organizer: body.organizer,
        level: body.level,
        regStartTime: body.regStartTime,
        regEndTime: body.regEndTime,
        contestTime: body.contestTime,
      })
    }
    message.success(t('practice.common.saveSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.saveFail'))
  } finally {
    saving.value = false
  }
}

// ---- 报名列表 ----
const showRegistrations = ref(false)
const registrationsOf = ref<CompetitionResponse | null>(null)
const registrations = ref<RegistrationResponse[]>([])
const regLoading = ref(false)
const { pagination: regPagination, reset: resetReg } = useRemotePagination(loadRegistrations)

async function loadRegistrations() {
  if (!registrationsOf.value) return
  regLoading.value = true
  try {
    const res = await fetchCompetitionRegistrations(
      registrationsOf.value.id,
      regPagination.page,
      regPagination.pageSize,
    )
    registrations.value = res.data.records
    regPagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    regLoading.value = false
  }
}

function openRegistrations(row: CompetitionResponse) {
  registrationsOf.value = row
  showRegistrations.value = true
  resetReg()
  loadRegistrations()
}

// 报名审核
const showReviewReg = ref(false)
const reviewingReg = ref<RegistrationResponse | null>(null)
const reviewRegForm = ref<{ approved: boolean; reviewComment: string }>({ approved: true, reviewComment: '' })
const savingReviewReg = ref(false)

function startReviewReg(row: RegistrationResponse) {
  reviewingReg.value = row
  reviewRegForm.value = { approved: true, reviewComment: '' }
  showReviewReg.value = true
}

async function handleSaveReviewReg() {
  if (!reviewingReg.value) return
  savingReviewReg.value = true
  try {
    await reviewCompetitionRegistration(reviewingReg.value.id, {
      approved: reviewRegForm.value.approved,
      reviewComment: reviewRegForm.value.reviewComment || undefined,
    })
    message.success(t('practice.common.operationSuccess'))
    showReviewReg.value = false
    await loadRegistrations()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  } finally {
    savingReviewReg.value = false
  }
}

// ---- 结果录入 ----
const showResults = ref(false)
const resultsOf = ref<CompetitionResponse | null>(null)
const results = ref<CompetitionResultResponse[]>([])
const resultsLoading = ref(false)
/** 该竞赛下已通过报名，用于结果录入选择 registrationId */
const approvedRegistrations = ref<RegistrationResponse[]>([])

const registrationSelectOptions = computed(() => {
  const usedIds = new Set(results.value.map((r) => r.registrationId))
  // 已录入结果的可再次选中（更新），未录入的可新建
  return approvedRegistrations.value.map((r) => ({
    label: `${r.studentName}${r.teamName ? `（${r.teamName}）` : ''}`,
    value: r.id,
  })).filter((o) => !usedIds.has(o.value) || o.value === resultForm.value.registrationId)
})

const resultForm = ref<{ registrationId: number | null; award: AwardCode | null; score: number | null; comment: string }>({
  registrationId: null,
  award: null,
  score: null,
  comment: '',
})
const savingResult = ref(false)

async function openResults(row: CompetitionResponse) {
  resultsOf.value = row
  showResults.value = true
  resultForm.value = { registrationId: null, award: null, score: null, comment: '' }
  resultsLoading.value = true
  try {
    const [resList, resRegs] = await Promise.all([
      fetchCompetitionResults(row.id),
      fetchAllPages((page, pageSize) => fetchCompetitionRegistrations(row.id, page, pageSize)),
    ])
    results.value = resList.data
    approvedRegistrations.value = resRegs.filter((r) => r.status === '已通过')
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    resultsLoading.value = false
  }
}

async function handleSaveResult() {
  if (!resultsOf.value) return
  if (resultForm.value.registrationId == null)
    return message.warning(t('practice.competition.registrationRequired'))
  if (!resultForm.value.award) return message.warning(t('practice.competition.awardRequired'))
  savingResult.value = true
  try {
    await saveCompetitionResult({
      competitionId: resultsOf.value.id,
      registrationId: resultForm.value.registrationId,
      award: resultForm.value.award,
      score: resultForm.value.score ?? undefined,
      comment: resultForm.value.comment || undefined,
    })
    message.success(t('practice.competition.resultSaved'))
    resultForm.value = { registrationId: null, award: null, score: null, comment: '' }
    // 刷新结果列表与下拉
    const resList = await fetchCompetitionResults(resultsOf.value.id)
    results.value = resList.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.saveFail'))
  } finally {
    savingResult.value = false
  }
}

async function handleDeleteResult(id: number) {
  if (!resultsOf.value) return
  try {
    await deleteCompetitionResult(id)
    message.success(t('practice.common.deleteSuccess'))
    const resList = await fetchCompetitionResults(resultsOf.value.id)
    results.value = resList.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.deleteFail'))
  }
}

// ---- 列定义 ----
const columns = computed<DataTableColumns<CompetitionResponse>>(() => [
  { title: t('practice.competition.competitionName'), key: 'name', minWidth: 200, ellipsis: { tooltip: true } },
  { title: t('practice.competition.level'), key: 'level', width: 90, align: 'center' },
  { title: t('practice.common.organizer'), key: 'organizer', width: 130, ellipsis: { tooltip: true }, render: (r) => r.organizer || '-' },
  { title: t('practice.competition.regStartTime'), key: 'regStartTime', width: 150, render: (r) => formatDateTime(r.regStartTime) },
  { title: t('practice.competition.regEndTime'), key: 'regEndTime', width: 150, render: (r) => formatDateTime(r.regEndTime) },
  { title: t('practice.competition.tabCompetitions'), key: 'contestTime', width: 150, render: (r) => formatDateTime(r.contestTime) },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 100,
    align: 'center',
    render: (r) => h(NTag, { type: projectStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 300,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'small', onClick: () => startEdit(row) }, () => t('practice.common.edit')),
        h(NDropdown, { options: statusDropdown.value, onSelect: (key: string) => handleStatusChange(row, key) }, () =>
          h(NButton, { size: 'small' }, () => t('practice.common.status')),
        ),
        h(NButton, { size: 'small', onClick: () => openRegistrations(row) }, () => t('practice.competition.viewRegistrations')),
        h(NButton, { size: 'small', type: 'primary', onClick: () => openResults(row) }, () => t('practice.competition.enterResult')),
        h(NPopconfirm, { onPositiveClick: () => handleDelete(row.id) }, {
          default: () => t('practice.common.deleteConfirm'),
          trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('practice.common.delete')),
        }),
      ]),
  },
])

const registrationColumns = computed<DataTableColumns<RegistrationResponse>>(() => [
  { title: t('practice.common.student'), key: 'studentName', width: 110 },
  { title: t('practice.competition.teamName'), key: 'teamName', width: 120, render: (r) => r.teamName || '-' },
  {
    title: t('practice.competition.members'),
    key: 'members',
    width: 100,
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
    render: (r) => h(NTag, { type: auditStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  { title: t('practice.common.registerTime'), key: 'registerTime', width: 150, render: (r) => formatDateTime(r.registerTime) },
  { title: t('practice.common.reviewComment'), key: 'reviewComment', width: 150, ellipsis: { tooltip: true }, render: (r) => r.reviewComment || '-' },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      row.status === '待审核'
        ? h(NButton, { size: 'small', type: 'primary', onClick: () => startReviewReg(row) }, () => t('practice.competition.reviewRegistration'))
        : '-',
  },
])

const resultColumns = computed<DataTableColumns<CompetitionResultResponse>>(() => [
  { title: t('practice.common.student'), key: 'studentName', width: 120 },
  { title: t('practice.competition.award'), key: 'award', width: 100, align: 'center' },
  { title: t('practice.common.score'), key: 'score', width: 80, align: 'center', render: (r) => r.score ?? '-' },
  { title: t('practice.common.comment'), key: 'comment', minWidth: 150, ellipsis: { tooltip: true }, render: (r) => r.comment || '-' },
  { title: t('practice.competition.awardTime'), key: 'awardTime', width: 150, render: (r) => formatDateTime(r.awardTime) },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 100,
    align: 'center',
    render: (row) =>
      h(
        NPopconfirm,
        { onPositiveClick: () => handleDeleteResult(row.id) },
        {
          default: () => t('practice.common.deleteConfirm'),
          trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('practice.common.delete')),
        },
      ),
  },
])

onMounted(() => {
  if (!isAcademicAdmin.value) return
  loadData()
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
    <NCard :title="$t('practice.competition.mgTitle')">
      <template #header-extra>
        <NSpace align="center">
          <NSelect
            v-model:value="filterStatus"
            :options="statusOptions"
            :placeholder="$t('practice.common.allStatus')"
            clearable
            style="width: 150px"
            @update:value="handleFilterChange"
          />
          <NButton type="primary" @click="loadData">{{ $t('practice.common.query') }}</NButton>
          <NButton @click="handleFilterChange">{{ $t('practice.common.reset') }}</NButton>
          <NButton type="primary" @click="startCreate">{{ $t('practice.competition.addCompetition') }}</NButton>
        </NSpace>
      </template>
      <NSpin :show="loading">
        <NDataTable
          :columns="columns"
          :data="competitions"
          :row-key="(r: CompetitionResponse) => r.id"
          :single-line="false"
          :bordered="false"
          :scroll-x="1280"
          remote
          :pagination="pagination"
        >
          <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
        </NDataTable>
      </NSpin>
    </NCard>

    <!-- 竞赛表单 -->
    <NModal
      v-model:show="showForm"
      preset="card"
      :title="formMode === 'create' ? $t('practice.competition.addCompetition') : $t('practice.competition.editCompetition')"
      class="practice-form-modal"
    >
      <NForm :model="form" label-placement="top">
        <NFormItem :label="$t('practice.competition.competitionName')" required>
          <NInput v-model:value="form.name" />
        </NFormItem>
        <NSpace :size="12" wrap>
          <NFormItem :label="$t('practice.common.organizer')" style="width: 240px">
            <NInput v-model:value="form.organizer" />
          </NFormItem>
          <NFormItem :label="$t('practice.competition.level')" style="width: 200px">
            <NSelect v-model:value="form.level" :options="levelOptions" />
          </NFormItem>
        </NSpace>
        <NSpace :size="12" wrap>
          <NFormItem :label="$t('practice.competition.regStartTime')" style="width: 240px">
            <NDatePicker v-model:value="form.regStartTs" type="datetime" clearable style="width: 100%" />
          </NFormItem>
          <NFormItem :label="$t('practice.competition.regEndTime')" style="width: 240px">
            <NDatePicker v-model:value="form.regEndTs" type="datetime" clearable style="width: 100%" />
          </NFormItem>
          <NFormItem :label="$t('practice.competition.tabCompetitions')" style="width: 240px">
            <NDatePicker v-model:value="form.contestTs" type="datetime" clearable style="width: 100%" />
          </NFormItem>
        </NSpace>
        <NFormItem :label="$t('practice.common.description')">
          <NInput v-model:value="form.description" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">{{ $t('practice.common.save') }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 报名列表 -->
    <NModal
      v-model:show="showRegistrations"
      preset="card"
      :title="$t('practice.competition.registrationsOf', { name: registrationsOf?.name ?? '' })"
      class="practice-app-modal"
    >
      <NSpin :show="regLoading">
        <NDataTable
          :columns="registrationColumns"
          :data="registrations"
          :row-key="(r: RegistrationResponse) => r.id"
          :single-line="false"
          :bordered="false"
          :scroll-x="900"
          remote
          :pagination="regPagination"
        >
          <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
        </NDataTable>
      </NSpin>
    </NModal>

    <!-- 报名审核 -->
    <NModal v-model:show="showReviewReg" preset="card" :title="$t('practice.competition.reviewRegistration')" class="practice-form-modal">
      <NForm :model="reviewRegForm" label-placement="top">
        <NFormItem :label="$t('practice.competition.approve')" required>
          <NRadioGroup v-model:value="reviewRegForm.approved">
            <NRadio :value="true">{{ $t('practice.competition.approve') }}</NRadio>
            <NRadio :value="false">{{ $t('practice.competition.reject') }}</NRadio>
          </NRadioGroup>
        </NFormItem>
        <NFormItem :label="$t('practice.common.reviewComment')">
          <NInput v-model:value="reviewRegForm.reviewComment" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showReviewReg = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingReviewReg" @click="handleSaveReviewReg">{{ $t('practice.common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 结果录入 -->
    <NModal
      v-model:show="showResults"
      preset="card"
      :title="$t('practice.competition.resultsOf', { name: resultsOf?.name ?? '' })"
      class="practice-result-modal"
    >
      <NSpin :show="resultsLoading">
        <EmptyState v-if="!resultsLoading && results.length === 0" :description="$t('practice.common.empty')" />
        <NDataTable v-else :columns="resultColumns" :data="results" :row-key="(r: CompetitionResultResponse) => r.id" :single-line="false" :bordered="false" />
      </NSpin>
      <div class="result-form-title">{{ $t('practice.competition.enterResult') }}</div>
      <NForm :model="resultForm" label-placement="top">
        <NSpace :size="12" wrap>
          <NFormItem :label="$t('practice.competition.registration')" required style="width: 260px">
            <NSelect
              v-model:value="resultForm.registrationId"
              :options="registrationSelectOptions"
              :placeholder="$t('practice.competition.registrationRequired')"
              filterable
            />
          </NFormItem>
          <NFormItem :label="$t('practice.competition.award')" required style="width: 160px">
            <NSelect v-model:value="resultForm.award" :options="awardOptions" />
          </NFormItem>
          <NFormItem :label="$t('practice.common.score')" style="width: 140px">
            <NInputNumber v-model:value="resultForm.score" :min="0" style="width: 100%" />
          </NFormItem>
        </NSpace>
        <NFormItem :label="$t('practice.common.comment')">
          <NInput v-model:value="resultForm.comment" type="textarea" :autosize="{ minRows: 2, maxRows: 3 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showResults = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingResult" @click="handleSaveResult">{{ $t('practice.common.save') }}</NButton>
        </NSpace>
      </template>
    </NModal>
    </template>
  </div>
</template>

<style scoped src="./CompetitionManagementPage.css"></style>

<style>
.practice-form-modal {
  width: 640px;
  max-width: 92vw;
}
.practice-app-modal {
  width: 960px;
  max-width: 96vw;
}
.practice-result-modal {
  width: 720px;
  max-width: 96vw;
}
</style>
