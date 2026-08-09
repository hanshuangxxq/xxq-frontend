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
  NTag,
  NSpin,
  NPopconfirm,
  NTabs,
  NTabPane,
  NRadioGroup,
  NRadio,
  NDescriptions,
  NDescriptionsItem,
  NResult,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import EmptyState from '@/shared/components/EmptyState.vue'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import {
  fetchAvailableCompetitions,
  registerCompetition,
  fetchMyCompetitionRegistrations,
  revokeCompetitionRegistration,
  fetchMyCompetitionResult,
} from '../api'
import { fetchStudents } from '@/modules/student-management/api'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import {
  auditStatusTagType,
  formatDateTime,
  parseMembers,
  joinMembers,
} from '../utils'
import type { Student } from '@/modules/student-management/types'
import type {
  CompetitionResponse,
  RegistrationResponse,
  CompetitionResultResponse,
} from '../types'

const { t } = useI18n()
const message = useMessage()
const { isStudent } = useRoleCheck()

const activeTab = ref('available')

// ---- 可报名竞赛 ----
const availLoading = ref(false)
const available = ref<CompetitionResponse[]>([])

async function loadAvailable() {
  availLoading.value = true
  try {
    const res = await fetchAvailableCompetitions()
    available.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    availLoading.value = false
  }
}

const showRegister = ref(false)
const registeringComp = ref<CompetitionResponse | null>(null)
const registerForm = ref<{
  teamMode: 'individual' | 'team'
  teamName: string
  members: Array<number>
}>({ teamMode: 'individual', teamName: '', members: [] })
const savingRegister = ref(false)

function startRegister(row: CompetitionResponse) {
  registeringComp.value = row
  registerForm.value = { teamMode: 'individual', teamName: '', members: [] }
  showRegister.value = true
}

async function handleRegister() {
  if (!registeringComp.value) return
  const f = registerForm.value
  const body =
    f.teamMode === 'team'
      ? {
          competitionId: registeringComp.value.id,
          teamName: f.teamName.trim() || undefined,
          members: joinMembers(f.members),
        }
      : { competitionId: registeringComp.value.id }
  savingRegister.value = true
  try {
    await registerCompetition(body)
    message.success(t('practice.common.operationSuccess'))
    showRegister.value = false
    await loadMyRegistrations()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  } finally {
    savingRegister.value = false
  }
}

const availableColumns = computed<DataTableColumns<CompetitionResponse>>(() => [
  { title: t('practice.competition.competitionName'), key: 'name', minWidth: 200, ellipsis: { tooltip: true } },
  { title: t('practice.competition.level'), key: 'level', width: 90, align: 'center' },
  { title: t('practice.common.organizer'), key: 'organizer', width: 130, ellipsis: { tooltip: true }, render: (r) => r.organizer || '-' },
  { title: t('practice.competition.regStartTime'), key: 'regStartTime', width: 150, render: (r) => formatDateTime(r.regStartTime) },
  { title: t('practice.competition.regEndTime'), key: 'regEndTime', width: 150, render: (r) => formatDateTime(r.regEndTime) },
  { title: t('practice.competition.tabCompetitions'), key: 'contestTime', width: 150, render: (r) => formatDateTime(r.contestTime) },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) => h(NButton, { size: 'small', type: 'primary', onClick: () => startRegister(row) }, () => t('practice.competition.register')),
  },
])

// ---- 我的报名 ----
const myRegLoading = ref(false)
const myRegistrations = ref<RegistrationResponse[]>([])

async function loadMyRegistrations() {
  myRegLoading.value = true
  try {
    const res = await fetchMyCompetitionRegistrations()
    myRegistrations.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    myRegLoading.value = false
  }
}

async function handleRevoke(id: number) {
  try {
    await revokeCompetitionRegistration(id)
    message.success(t('practice.common.revokeSuccess'))
    await loadMyRegistrations()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.revokeFail'))
  }
}

const myRegColumns = computed<DataTableColumns<RegistrationResponse>>(() => [
  { title: t('practice.competition.competitionName'), key: 'competitionName', minWidth: 200, ellipsis: { tooltip: true } },
  { title: t('practice.competition.teamName'), key: 'teamName', width: 120, render: (r) => r.teamName || '-' },
  {
    title: t('practice.competition.members'),
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
  { title: t('practice.common.registerTime'), key: 'registerTime', width: 150, render: (r) => formatDateTime(r.registerTime) },
  { title: t('practice.common.reviewComment'), key: 'reviewComment', width: 160, ellipsis: { tooltip: true }, render: (r) => r.reviewComment || '-' },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 110,
    render: (row) =>
      row.status === '待审核'
        ? h(NPopconfirm, { onPositiveClick: () => handleRevoke(row.id) }, {
            default: () => t('practice.competition.revokeConfirm'),
            trigger: () => h(NButton, { size: 'small', type: 'warning' }, () => t('practice.competition.revoke')),
          })
        : '-',
  },
])

// ---- 我的结果 ----
const showResult = ref(false)
const viewingReg = ref<RegistrationResponse | null>(null)
const myResult = ref<CompetitionResultResponse | null>(null)
const resultLoading = ref(false)

async function openMyResult(row: RegistrationResponse) {
  viewingReg.value = row
  myResult.value = null
  showResult.value = true
  resultLoading.value = true
  try {
    const res = await fetchMyCompetitionResult(row.competitionId)
    myResult.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    resultLoading.value = false
  }
}

const myResultColumns = computed<DataTableColumns<RegistrationResponse>>(() => [
  { title: t('practice.competition.competitionName'), key: 'competitionName', minWidth: 200, ellipsis: { tooltip: true } },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 100,
    align: 'center',
    render: (r) => h(NTag, { type: auditStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 120,
    render: (row) => h(NButton, { size: 'small', onClick: () => openMyResult(row) }, () => t('practice.competition.viewResult')),
  },
])

onMounted(() => {
  if (!isStudent.value) return
  loadAvailable()
  loadMyRegistrations()
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
      <!-- 可报名竞赛 -->
      <NTabPane name="available" :tab="$t('practice.competition.tabAvailable')">
        <NCard>
          <NSpin :show="availLoading">
            <NDataTable :columns="availableColumns" :data="available" :row-key="(r: CompetitionResponse) => r.id" :single-line="false" :bordered="false" :scroll-x="1000">
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 我的报名 -->
      <NTabPane name="myRegistrations" :tab="$t('practice.competition.tabMyRegistrations')">
        <NCard>
          <NSpin :show="myRegLoading">
            <NDataTable :columns="myRegColumns" :data="myRegistrations" :row-key="(r: RegistrationResponse) => r.id" :single-line="false" :bordered="false" :scroll-x="980">
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 我的结果 -->
      <NTabPane name="myResults" :tab="$t('practice.competition.tabMyResults')">
        <NCard>
          <NSpin :show="myRegLoading">
            <NDataTable :columns="myResultColumns" :data="myRegistrations" :row-key="(r: RegistrationResponse) => r.id" :single-line="false" :bordered="false">
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>
    </NTabs>

    <!-- 报名 -->
    <NModal v-model:show="showRegister" preset="card" :title="$t('practice.competition.register')" class="practice-form-modal">
      <NForm :model="registerForm" label-placement="top">
        <NFormItem :label="$t('practice.competition.teamMode')" required>
          <NRadioGroup v-model:value="registerForm.teamMode">
            <NRadio value="individual">{{ $t('practice.competition.individual') }}</NRadio>
            <NRadio value="team">{{ $t('practice.competition.team') }}</NRadio>
          </NRadioGroup>
        </NFormItem>
        <template v-if="registerForm.teamMode === 'team'">
          <NFormItem :label="$t('practice.competition.teamName')">
            <NInput v-model:value="registerForm.teamName" />
          </NFormItem>
          <NFormItem :label="$t('practice.competition.members')">
            <PagedSelect
              v-model="registerForm.members"
              :fetch-page="(page: number, pageSize: number) => fetchStudents({ page, pageSize })"
              :label-of="(s: Student) => s.name"
              :value-of="(s: Student) => s.userId"
              multiple
              filterable
              :placeholder="$t('practice.common.membersPlaceholder')"
            />
          </NFormItem>
        </template>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showRegister = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingRegister" @click="handleRegister">{{ $t('practice.common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 我的结果 -->
    <NModal v-model:show="showResult" preset="card" :title="$t('practice.competition.viewResult')" class="practice-form-modal">
      <NSpin :show="resultLoading">
        <EmptyState v-if="!resultLoading && !myResult" :description="$t('practice.competition.myResultEmpty')" />
        <NDescriptions v-else label-placement="left" bordered :column="1">
          <NDescriptionsItem :label="$t('practice.competition.competitionName')">
            {{ myResult?.competitionName }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('practice.competition.award')">
            <NTag v-if="myResult" type="success" size="small" :bordered="false">{{ myResult.award }}</NTag>
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('practice.common.score')">
            {{ myResult?.score ?? '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('practice.common.comment')">
            {{ myResult?.comment || '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('practice.competition.awardTime')">
            {{ formatDateTime(myResult?.awardTime) }}
          </NDescriptionsItem>
        </NDescriptions>
      </NSpin>
    </NModal>
    </template>
  </div>
</template>

<style scoped src="./CompetitionStudentPage.css"></style>

<style>
.practice-form-modal {
  width: 560px;
  max-width: 92vw;
}
</style>
