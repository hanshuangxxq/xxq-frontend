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
  NRadioGroup,
  NRadio,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import EmptyState from '@/shared/components/EmptyState.vue'
import {
  fetchTopics,
  createTopic,
  updateTopic,
  updateTopicStatus,
  deleteTopic,
  fetchTopicApplications,
  reviewTopicApplication,
  fetchTheses,
  reviewThesis,
  deleteThesis,
} from '../api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import {
  projectStatusTagType,
  auditStatusTagType,
  thesisStatusTagType,
  formatDateTime,
  downloadPracticeFile,
} from '../utils'
import type {
  TopicResponse,
  TopicStatusCode,
  TopicCreateRequest,
  SelectionResponse,
  ThesisResponse,
  ThesisStatusCode,
} from '../types'

const { t } = useI18n()
const message = useMessage()
const { isTeacher } = useRoleCheck()

const activeTab = ref('topics')

// ---- 选题 ----
const topicLoading = ref(false)
const topics = ref<TopicResponse[]>([])
const { pagination: topicPagination, reset: resetTopic } = useRemotePagination(loadTopics)
const filterStatus = ref<TopicStatusCode | null>(null)

const statusOptions = computed(() => [
  { label: t('practice.graduation.topicStatusDraft'), value: 'DRAFT' as TopicStatusCode },
  { label: t('practice.graduation.topicStatusOpen'), value: 'OPEN' as TopicStatusCode },
  { label: t('practice.graduation.topicStatusClosed'), value: 'CLOSED' as TopicStatusCode },
])

const statusDropdownOptions = computed(() => [
  { label: t('practice.graduation.topicStatusDraft'), key: 'DRAFT' },
  { label: t('practice.graduation.topicStatusOpen'), key: 'OPEN' },
  { label: t('practice.graduation.topicStatusClosed'), key: 'CLOSED' },
])

async function loadTopics() {
  topicLoading.value = true
  try {
    const res = await fetchTopics({
      status: filterStatus.value ?? undefined,
      page: topicPagination.page,
      pageSize: topicPagination.pageSize,
    })
    topics.value = res.data.records
    topicPagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    topicLoading.value = false
  }
}

function handleTopicFilterChange() {
  resetTopic()
  loadTopics()
}

async function handleStatusChange(row: TopicResponse, code: string) {
  try {
    await updateTopicStatus(row.id, code)
    message.success(t('practice.common.operationSuccess'))
    await loadTopics()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  }
}

async function handleDeleteTopic(id: number) {
  try {
    await deleteTopic(id)
    message.success(t('practice.common.deleteSuccess'))
    await loadTopics()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.deleteFail'))
  }
}

// 选题表单
interface TopicForm {
  title: string
  description: string
  requirements: string
  capacity: number | null
}
const showTopicForm = ref(false)
const topicFormMode = ref<'create' | 'edit'>('create')
const editingTopicId = ref<number | null>(null)
const savingTopic = ref(false)

function emptyTopicForm(): TopicForm {
  return { title: '', description: '', requirements: '', capacity: null }
}
const topicForm = ref<TopicForm>(emptyTopicForm())

function startCreateTopic() {
  topicFormMode.value = 'create'
  editingTopicId.value = null
  topicForm.value = emptyTopicForm()
  showTopicForm.value = true
}

function startEditTopic(row: TopicResponse) {
  topicFormMode.value = 'edit'
  editingTopicId.value = row.id
  topicForm.value = {
    title: row.title,
    description: row.description ?? '',
    requirements: row.requirements ?? '',
    capacity: row.capacity,
  }
  showTopicForm.value = true
}

async function handleSaveTopic() {
  const f = topicForm.value
  if (!f.title.trim()) return message.warning(t('practice.graduation.titleRequired'))
  if (f.capacity == null || f.capacity <= 0)
    return message.warning(t('practice.graduation.capacityRequired'))
  const body: TopicCreateRequest = {
    title: f.title.trim(),
    description: f.description || undefined,
    requirements: f.requirements || undefined,
    capacity: f.capacity,
  }
  savingTopic.value = true
  try {
    if (topicFormMode.value === 'create') {
      await createTopic(body)
    } else {
      await updateTopic(editingTopicId.value!, {
        title: body.title,
        description: body.description,
        requirements: body.requirements,
        capacity: body.capacity,
      })
    }
    message.success(t('practice.common.saveSuccess'))
    showTopicForm.value = false
    await loadTopics()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.saveFail'))
  } finally {
    savingTopic.value = false
  }
}

// 申请列表（某选题）
const showApplications = ref(false)
const applicationsTopic = ref<TopicResponse | null>(null)
const applications = ref<SelectionResponse[]>([])
const appLoading = ref(false)
const { pagination: appPagination, reset: resetApp } = useRemotePagination(loadApplications)

async function loadApplications() {
  if (!applicationsTopic.value) return
  appLoading.value = true
  try {
    const res = await fetchTopicApplications(
      applicationsTopic.value.id,
      appPagination.page,
      appPagination.pageSize,
    )
    applications.value = res.data.records
    appPagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    appLoading.value = false
  }
}

function openApplications(row: TopicResponse) {
  applicationsTopic.value = row
  showApplications.value = true
  resetApp()
  loadApplications()
}

// 申请审核
const showReviewApp = ref(false)
const reviewingApp = ref<SelectionResponse | null>(null)
const reviewAppForm = ref<{ approved: boolean; reviewComment: string }>({
  approved: true,
  reviewComment: '',
})
const savingReviewApp = ref(false)

function startReviewApplication(row: SelectionResponse) {
  reviewingApp.value = row
  reviewAppForm.value = { approved: true, reviewComment: '' }
  showReviewApp.value = true
}

async function handleSaveReviewApp() {
  if (!reviewingApp.value) return
  savingReviewApp.value = true
  try {
    await reviewTopicApplication(reviewingApp.value.id, {
      approved: reviewAppForm.value.approved,
      reviewComment: reviewAppForm.value.reviewComment || undefined,
    })
    message.success(t('practice.common.operationSuccess'))
    showReviewApp.value = false
    await loadApplications()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  } finally {
    savingReviewApp.value = false
  }
}

// ---- 论文 ----
const thesisLoading = ref(false)
const theses = ref<ThesisResponse[]>([])
const { pagination: thesisPagination, reset: resetThesis } = useRemotePagination(loadTheses)
const filterThesisStatus = ref<ThesisStatusCode | null>(null)
let thesesLoaded = false

const thesisStatusOptions = computed(() => [
  { label: t('practice.graduation.thesisStatusSubmitted'), value: 'SUBMITTED' as ThesisStatusCode },
  { label: t('practice.graduation.thesisStatusUnderReview'), value: 'UNDER_REVIEW' as ThesisStatusCode },
  { label: t('practice.graduation.thesisStatusPassed'), value: 'PASSED' as ThesisStatusCode },
  { label: t('practice.graduation.thesisStatusFailed'), value: 'FAILED' as ThesisStatusCode },
  { label: t('practice.graduation.thesisStatusRevision'), value: 'REVISION' as ThesisStatusCode },
])

const thesisReviewStatusOptions = computed(() => [
  { label: t('practice.graduation.thesisStatusUnderReview'), value: 'UNDER_REVIEW' as ThesisStatusCode },
  { label: t('practice.graduation.thesisStatusPassed'), value: 'PASSED' as ThesisStatusCode },
  { label: t('practice.graduation.thesisStatusFailed'), value: 'FAILED' as ThesisStatusCode },
  { label: t('practice.graduation.thesisStatusRevision'), value: 'REVISION' as ThesisStatusCode },
])

async function loadTheses() {
  thesisLoading.value = true
  try {
    const res = await fetchTheses({
      status: filterThesisStatus.value ?? undefined,
      page: thesisPagination.page,
      pageSize: thesisPagination.pageSize,
    })
    theses.value = res.data.records
    thesisPagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    thesisLoading.value = false
  }
}

function handleThesisFilterChange() {
  resetThesis()
  loadTheses()
}

function onTabChange(name: string | number) {
  if (name === 'theses' && !thesesLoaded) {
    thesesLoaded = true
    loadTheses()
  }
}

async function handleDownloadThesis(id: number) {
  try {
    await downloadPracticeFile(`/practice/graduation/theses/${id}/download`)
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  }
}

async function handleDeleteThesis(id: number) {
  try {
    await deleteThesis(id)
    message.success(t('practice.common.deleteSuccess'))
    await loadTheses()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.deleteFail'))
  }
}

// 论文评审
const showReviewThesis = ref(false)
const reviewingThesis = ref<ThesisResponse | null>(null)
const reviewThesisForm = ref<{
  status: ThesisStatusCode
  reviewScore: number | null
  reviewComment: string
}>({ status: 'UNDER_REVIEW', reviewScore: null, reviewComment: '' })
const savingReviewThesis = ref(false)

function startReviewThesis(row: ThesisResponse) {
  reviewingThesis.value = row
  reviewThesisForm.value = {
    status: 'UNDER_REVIEW',
    reviewScore: null,
    reviewComment: '',
  }
  showReviewThesis.value = true
}

async function handleSaveReviewThesis() {
  if (!reviewingThesis.value) return
  savingReviewThesis.value = true
  try {
    await reviewThesis(reviewingThesis.value.id, {
      status: reviewThesisForm.value.status,
      reviewScore: reviewThesisForm.value.reviewScore ?? undefined,
      reviewComment: reviewThesisForm.value.reviewComment || undefined,
    })
    message.success(t('practice.common.operationSuccess'))
    showReviewThesis.value = false
    await loadTheses()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.operationFail'))
  } finally {
    savingReviewThesis.value = false
  }
}

// ---- 列定义 ----
const topicColumns = computed<DataTableColumns<TopicResponse>>(() => [
  { title: t('practice.graduation.topicTitle'), key: 'title', minWidth: 200, ellipsis: { tooltip: true } },
  { title: t('practice.graduation.teacher'), key: 'teacherName', width: 120 },
  {
    title: t('practice.common.capacity'),
    key: 'capacity',
    width: 120,
    align: 'center',
    render: (r) => `${r.selectedCount} / ${r.capacity}`,
  },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(NTag, { type: projectStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  {
    title: t('practice.common.createTime'),
    key: 'createTime',
    width: 160,
    render: (r) => formatDateTime(r.createTime),
  },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 230,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'small', onClick: () => startEditTopic(row) }, () => t('practice.common.edit')),
        h(
          NDropdown,
          {
            options: statusDropdownOptions.value,
            onSelect: (key: string) => handleStatusChange(row, key),
          },
          () =>
            h(
              NButton,
              { size: 'small' },
              () => t('practice.common.status'),
            ),
        ),
        h(
          NButton,
          { size: 'small', onClick: () => openApplications(row) },
          () => t('practice.graduation.viewApplications'),
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDeleteTopic(row.id) },
          {
            default: () => t('practice.common.deleteConfirm'),
            trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('practice.common.delete')),
          },
        ),
      ]),
  },
])

const applicationColumns = computed<DataTableColumns<SelectionResponse>>(() => [
  { title: t('practice.common.student'), key: 'studentName', width: 120 },
  { title: t('practice.graduation.apply'), key: 'applyReason', minWidth: 160, ellipsis: { tooltip: true }, render: (r) => r.applyReason || '-' },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(NTag, { type: auditStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  { title: t('practice.common.applyTime'), key: 'selectTime', width: 150, render: (r) => formatDateTime(r.selectTime) },
  { title: t('practice.common.reviewComment'), key: 'reviewComment', width: 160, ellipsis: { tooltip: true }, render: (r) => r.reviewComment || '-' },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      row.status === '待审核'
        ? h(
            NButton,
            { size: 'small', type: 'primary', onClick: () => startReviewApplication(row) },
            () => t('practice.graduation.reviewApply'),
          )
        : '-',
  },
])

const thesisColumns = computed<DataTableColumns<ThesisResponse>>(() => [
  { title: t('practice.common.student'), key: 'studentName', width: 110 },
  { title: t('practice.graduation.thesisTitle'), key: 'title', minWidth: 180, ellipsis: { tooltip: true } },
  { title: t('practice.common.submitTime'), key: 'submitTime', width: 150, render: (r) => formatDateTime(r.submitTime) },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 100,
    align: 'center',
    render: (r) =>
      h(NTag, { type: thesisStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  { title: t('practice.common.score'), key: 'reviewScore', width: 80, align: 'center', render: (r) => r.reviewScore ?? '-' },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 250,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          { size: 'small', type: 'primary', onClick: () => startReviewThesis(row) },
          () => t('practice.graduation.reviewThesis'),
        ),
        h(
          NButton,
          { size: 'small', onClick: () => handleDownloadThesis(row.id) },
          () => t('practice.graduation.downloadThesis'),
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDeleteThesis(row.id) },
          {
            default: () => t('practice.common.deleteConfirm'),
            trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('practice.common.delete')),
          },
        ),
      ]),
  },
])

onMounted(() => {
  loadTopics()
})
</script>

<template>
  <div class="practice-page">
    <NTabs v-model:value="activeTab" type="line" animated @update:value="onTabChange">
      <!-- 选题管理 -->
      <NTabPane name="topics" :tab="$t('practice.graduation.tabTopics')">
        <NCard :title="$t('practice.graduation.tabTopics')">
          <template #header-extra>
            <NSpace align="center">
              <NSelect
                v-model:value="filterStatus"
                :options="statusOptions"
                :placeholder="$t('practice.common.allStatus')"
                clearable
                style="width: 160px"
                @update:value="handleTopicFilterChange"
              />
              <NButton type="primary" @click="loadTopics">{{ $t('practice.common.query') }}</NButton>
              <NButton @click="handleTopicFilterChange">{{ $t('practice.common.reset') }}</NButton>
              <NButton v-if="isTeacher" type="primary" @click="startCreateTopic">
                {{ $t('practice.graduation.addTopic') }}
              </NButton>
            </NSpace>
          </template>
          <NSpin :show="topicLoading">
            <NDataTable
              :columns="topicColumns"
              :data="topics"
              :row-key="(r: TopicResponse) => r.id"
              :single-line="false"
              :bordered="false"
              :scroll-x="980"
              remote
              :pagination="topicPagination"
            >
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 论文评审 -->
      <NTabPane name="theses" :tab="$t('practice.graduation.tabTheses')">
        <NCard :title="$t('practice.graduation.tabTheses')">
          <template #header-extra>
            <NSpace align="center">
              <NSelect
                v-model:value="filterThesisStatus"
                :options="thesisStatusOptions"
                :placeholder="$t('practice.common.allStatus')"
                clearable
                style="width: 160px"
                @update:value="handleThesisFilterChange"
              />
              <NButton type="primary" @click="loadTheses">{{ $t('practice.common.query') }}</NButton>
              <NButton @click="handleThesisFilterChange">{{ $t('practice.common.reset') }}</NButton>
            </NSpace>
          </template>
          <NSpin :show="thesisLoading">
            <NDataTable
              :columns="thesisColumns"
              :data="theses"
              :row-key="(r: ThesisResponse) => r.id"
              :single-line="false"
              :bordered="false"
              :scroll-x="920"
              remote
              :pagination="thesisPagination"
            >
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>
    </NTabs>

    <!-- 选题表单 -->
    <NModal
      v-model:show="showTopicForm"
      preset="card"
      :title="topicFormMode === 'create' ? $t('practice.graduation.addTopic') : $t('practice.graduation.editTopic')"
      class="practice-form-modal"
    >
      <NForm :model="topicForm" label-placement="top">
        <NFormItem :label="$t('practice.graduation.topicTitle')" required>
          <NInput v-model:value="topicForm.title" />
        </NFormItem>
        <NFormItem :label="$t('practice.graduation.capacity')" required>
          <NInputNumber v-model:value="topicForm.capacity" :min="1" style="width: 100%" />
        </NFormItem>
        <NFormItem :label="$t('practice.graduation.requirements')">
          <NInput v-model:value="topicForm.requirements" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
        <NFormItem :label="$t('practice.common.description')">
          <NInput v-model:value="topicForm.description" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showTopicForm = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingTopic" @click="handleSaveTopic">
            {{ $t('practice.common.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 某选题的申请列表 -->
    <NModal
      v-model:show="showApplications"
      preset="card"
      :title="$t('practice.graduation.applicationsOf', { title: applicationsTopic?.title ?? '' })"
      class="practice-app-modal"
    >
      <NSpin :show="appLoading">
        <NDataTable
          :columns="applicationColumns"
          :data="applications"
          :row-key="(r: SelectionResponse) => r.id"
          :single-line="false"
          :bordered="false"
          :scroll-x="760"
          remote
          :pagination="appPagination"
        >
          <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
        </NDataTable>
      </NSpin>
    </NModal>

    <!-- 申请审核 -->
    <NModal
      v-model:show="showReviewApp"
      preset="card"
      :title="$t('practice.graduation.reviewApply')"
      class="practice-form-modal"
    >
      <NForm :model="reviewAppForm" label-placement="top">
        <NFormItem :label="$t('practice.graduation.approve')" required>
          <NRadioGroup v-model:value="reviewAppForm.approved">
            <NRadio :value="true">{{ $t('practice.graduation.approve') }}</NRadio>
            <NRadio :value="false">{{ $t('practice.graduation.reject') }}</NRadio>
          </NRadioGroup>
        </NFormItem>
        <NFormItem :label="$t('practice.common.reviewComment')">
          <NInput v-model:value="reviewAppForm.reviewComment" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showReviewApp = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingReviewApp" @click="handleSaveReviewApp">
            {{ $t('practice.common.confirm') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 论文评审 -->
    <NModal
      v-model:show="showReviewThesis"
      preset="card"
      :title="$t('practice.graduation.reviewThesis')"
      class="practice-form-modal"
    >
      <NForm :model="reviewThesisForm" label-placement="top">
        <NFormItem :label="$t('practice.common.status')" required>
          <NSelect v-model:value="reviewThesisForm.status" :options="thesisReviewStatusOptions" />
        </NFormItem>
        <NFormItem :label="$t('practice.common.reviewScore')">
          <NInputNumber v-model:value="reviewThesisForm.reviewScore" :min="0" :max="100" style="width: 100%" />
        </NFormItem>
        <NFormItem :label="$t('practice.common.reviewComment')">
          <NInput v-model:value="reviewThesisForm.reviewComment" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showReviewThesis = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingReviewThesis" @click="handleSaveReviewThesis">
            {{ $t('practice.common.confirm') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./GraduationManagementPage.css"></style>

<style>
.practice-form-modal {
  width: 560px;
  max-width: 92vw;
}
.practice-app-modal {
  width: 820px;
  max-width: 96vw;
}
</style>
