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
  NDescriptions,
  NDescriptionsItem,
  NResult,
  useMessage,
  type DataTableColumns,
  type UploadFileInfo,
} from 'naive-ui'
import EmptyState from '@/shared/components/EmptyState.vue'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import {
  fetchAvailableTopics,
  applyTopic,
  fetchMyTopicApplications,
  revokeTopicApplication,
  fetchMyThesis,
  submitThesis,
  deleteThesis,
} from '../api'
import {
  auditStatusTagType,
  thesisStatusTagType,
  formatDateTime,
  downloadPracticeFile,
} from '../utils'
import type { TopicResponse, SelectionResponse, ThesisResponse } from '../types'

const { t } = useI18n()
const message = useMessage()
const { isStudent } = useRoleCheck()

const activeTab = ref('available')

// ---- 可选选题 ----
const availableLoading = ref(false)
const available = ref<TopicResponse[]>([])

async function loadAvailable() {
  availableLoading.value = true
  try {
    const res = await fetchAvailableTopics()
    available.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    availableLoading.value = false
  }
}

// 申请
const showApply = ref(false)
const applyingTopic = ref<TopicResponse | null>(null)
const applyForm = ref<{ applyReason: string }>({ applyReason: '' })
const savingApply = ref(false)

function startApply(row: TopicResponse) {
  applyingTopic.value = row
  applyForm.value = { applyReason: '' }
  showApply.value = true
}

async function handleApply() {
  if (!applyingTopic.value) return
  savingApply.value = true
  try {
    await applyTopic({
      topicId: applyingTopic.value.id,
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

const availableColumns = computed<DataTableColumns<TopicResponse>>(() => [
  { title: t('practice.graduation.topicTitle'), key: 'title', minWidth: 200, ellipsis: { tooltip: true } },
  { title: t('practice.graduation.teacher'), key: 'teacherName', width: 120 },
  {
    title: t('practice.common.capacity'),
    key: 'capacity',
    width: 120,
    align: 'center',
    render: (r) => `${r.selectedCount} / ${r.capacity}`,
  },
  { title: t('practice.graduation.requirements'), key: 'requirements', minWidth: 160, ellipsis: { tooltip: true }, render: (r) => r.requirements || '-' },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 110,
    render: (row) =>
      h(
        NButton,
        { size: 'small', type: 'primary', onClick: () => startApply(row) },
        () => t('practice.graduation.apply'),
      ),
  },
])

// ---- 我的申请 ----
const myAppLoading = ref(false)
const myApplications = ref<SelectionResponse[]>([])

async function loadMyApplications() {
  myAppLoading.value = true
  try {
    const res = await fetchMyTopicApplications()
    myApplications.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    myAppLoading.value = false
  }
}

async function handleRevoke(id: number) {
  try {
    await revokeTopicApplication(id)
    message.success(t('practice.common.revokeSuccess'))
    await loadMyApplications()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.revokeFail'))
  }
}

const myAppColumns = computed<DataTableColumns<SelectionResponse>>(() => [
  { title: t('practice.graduation.topicTitle'), key: 'topicTitle', minWidth: 200, ellipsis: { tooltip: true } },
  {
    title: t('practice.common.status'),
    key: 'status',
    width: 100,
    align: 'center',
    render: (r) =>
      h(NTag, { type: auditStatusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  { title: t('practice.graduation.apply'), key: 'applyReason', width: 160, ellipsis: { tooltip: true }, render: (r) => r.applyReason || '-' },
  { title: t('practice.common.applyTime'), key: 'selectTime', width: 150, render: (r) => formatDateTime(r.selectTime) },
  { title: t('practice.common.reviewTime'), key: 'reviewTime', width: 150, render: (r) => formatDateTime(r.reviewTime) },
  { title: t('practice.common.reviewComment'), key: 'reviewComment', width: 160, ellipsis: { tooltip: true }, render: (r) => r.reviewComment || '-' },
  {
    title: t('practice.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      row.status === '待审核'
        ? h(
            NPopconfirm,
            { onPositiveClick: () => handleRevoke(row.id) },
            {
              default: () => t('practice.graduation.revokeConfirm'),
              trigger: () => h(NButton, { size: 'small', type: 'warning' }, () => t('practice.graduation.revoke')),
            },
          )
        : '-',
  },
])

// ---- 我的论文 ----
const myThesis = ref<ThesisResponse | null>(null)
const thesisLoading = ref(false)

/** 本人已通过的申请，用于提交论文时选择 selectionId */
const approvedSelections = computed(() =>
  myApplications.value.filter((a) => a.status === '已通过'),
)

const canSubmitThesis = computed(
  () => myThesis.value == null && approvedSelections.value.length > 0,
)
const canResubmitThesis = computed(() => myThesis.value?.status === '需修改')

async function loadMyThesis() {
  thesisLoading.value = true
  try {
    const res = await fetchMyThesis()
    myThesis.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('practice.common.loadFail'))
  } finally {
    thesisLoading.value = false
  }
}

// 提交/重传论文
const showThesisForm = ref(false)
const thesisForm = ref<{
  selectionId: number | null
  title: string
  abstractText: string
}>({ selectionId: null, title: '', abstractText: '' })
const fileList = ref<UploadFileInfo[]>([])
const savingThesis = ref(false)

const selectionOptions = computed(() =>
  approvedSelections.value.map((s) => ({ label: s.topicTitle, value: s.id })),
)

function startSubmitThesis() {
  thesisForm.value = { selectionId: null, title: '', abstractText: '' }
  fileList.value = []
  showThesisForm.value = true
}

function startResubmitThesis() {
  if (!myThesis.value) return
  thesisForm.value = {
    selectionId: myThesis.value.selectionId,
    title: myThesis.value.title,
    abstractText: myThesis.value.abstractText ?? '',
  }
  fileList.value = []
  showThesisForm.value = true
}

const MAX_SIZE = 20 * 1024 * 1024

async function handleSubmitThesis() {
  const f = thesisForm.value
  if (f.selectionId == null) return message.warning(t('practice.graduation.topicRequired'))
  if (!f.title.trim()) return message.warning(t('practice.graduation.titleRequired'))
  const file = fileList.value[0]?.file
  if (!file) return message.warning(t('practice.common.fileRequired'))
  if (file.size > MAX_SIZE) return message.warning(t('practice.common.fileTooLarge'))
  savingThesis.value = true
  try {
    await submitThesis(
      {
        selectionId: f.selectionId,
        title: f.title.trim(),
        abstractText: f.abstractText || undefined,
      },
      file,
    )
    message.success(t('practice.graduation.submitSuccess'))
    showThesisForm.value = false
    await loadMyThesis()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.saveFail'))
  } finally {
    savingThesis.value = false
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
    await loadMyThesis()
  } catch (e) {
    message.error((e as Error).message || t('practice.common.deleteFail'))
  }
}

onMounted(() => {
  if (!isStudent.value) return
  loadAvailable()
  loadMyApplications()
  loadMyThesis()
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
      <!-- 可选选题 -->
      <NTabPane name="available" :tab="$t('practice.graduation.tabAvailable')">
        <NCard>
          <NSpin :show="availableLoading">
            <NDataTable
              :columns="availableColumns"
              :data="available"
              :row-key="(r: TopicResponse) => r.id"
              :single-line="false"
              :bordered="false"
              :scroll-x="760"
            >
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 我的申请 -->
      <NTabPane name="myApplications" :tab="$t('practice.graduation.tabMyApplications')">
        <NCard>
          <NSpin :show="myAppLoading">
            <NDataTable
              :columns="myAppColumns"
              :data="myApplications"
              :row-key="(r: SelectionResponse) => r.id"
              :single-line="false"
              :bordered="false"
              :scroll-x="1080"
            >
              <template #empty><EmptyState :description="$t('practice.common.empty')" /></template>
            </NDataTable>
          </NSpin>
        </NCard>
      </NTabPane>

      <!-- 我的论文 -->
      <NTabPane name="myThesis" :tab="$t('practice.graduation.tabMyThesis')">
        <NCard :title="$t('practice.graduation.tabMyThesis')">
          <template #header-extra>
            <NSpace>
              <NButton
                v-if="canSubmitThesis"
                type="primary"
                @click="startSubmitThesis"
              >
                {{ $t('practice.graduation.submitThesis') }}
              </NButton>
              <NButton
                v-else-if="canResubmitThesis"
                type="primary"
                @click="startResubmitThesis"
              >
                {{ $t('practice.graduation.resubmitThesis') }}
              </NButton>
            </NSpace>
          </template>
          <NSpin :show="thesisLoading">
            <EmptyState v-if="!myThesis" :description="$t('practice.graduation.myThesisEmpty')" />
            <NDescriptions v-else label-placement="left" bordered :column="2">
              <NDescriptionsItem :label="$t('practice.graduation.thesisTitle')">
                {{ myThesis.title }}
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('practice.common.status')">
                <NTag :type="thesisStatusTagType(myThesis.status)" size="small" :bordered="false">
                  {{ myThesis.status }}
                </NTag>
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('practice.common.abstractText')" :span="2">
                {{ myThesis.abstractText || '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('practice.common.fileOriginal')">
                {{ myThesis.fileOriginal || '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('practice.common.submitTime')">
                {{ formatDateTime(myThesis.submitTime) }}
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('practice.common.reviewScore')">
                {{ myThesis.reviewScore ?? '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('practice.common.reviewTime')">
                {{ formatDateTime(myThesis.reviewTime) }}
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('practice.common.reviewComment')" :span="2">
                {{ myThesis.reviewComment || '-' }}
              </NDescriptionsItem>
            </NDescriptions>
            <NSpace v-if="myThesis" style="margin-top: 16px">
              <NButton @click="handleDownloadThesis(myThesis.id)">
                {{ $t('practice.graduation.downloadThesis') }}
              </NButton>
              <NPopconfirm
                v-if="myThesis.status === '已提交'"
                @positive-click="handleDeleteThesis(myThesis.id)"
              >
                <template #default>{{ $t('practice.common.deleteConfirm') }}</template>
                <template #trigger>
                  <NButton type="error">{{ $t('practice.common.delete') }}</NButton>
                </template>
              </NPopconfirm>
            </NSpace>
          </NSpin>
        </NCard>
      </NTabPane>
    </NTabs>

    <!-- 申请 -->
    <NModal
      v-model:show="showApply"
      preset="card"
      :title="$t('practice.graduation.apply')"
      class="practice-form-modal"
    >
      <NForm :model="applyForm" label-placement="top">
        <NFormItem :label="$t('practice.graduation.apply')">
          <NInput v-model:value="applyForm.applyReason" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showApply = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingApply" @click="handleApply">
            {{ $t('practice.common.confirm') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 提交/重传论文 -->
    <NModal
      v-model:show="showThesisForm"
      preset="card"
      :title="canResubmitThesis ? $t('practice.graduation.resubmitThesis') : $t('practice.graduation.submitThesis')"
      class="practice-form-modal"
    >
      <NForm :model="thesisForm" label-placement="top">
        <NFormItem :label="$t('practice.graduation.topicTitle')" required>
          <NSelect
            v-model:value="thesisForm.selectionId"
            :options="selectionOptions"
            :disabled="canResubmitThesis"
            :placeholder="$t('practice.graduation.topicRequired')"
          />
        </NFormItem>
        <NFormItem :label="$t('practice.graduation.thesisTitle')" required>
          <NInput v-model:value="thesisForm.title" />
        </NFormItem>
        <NFormItem :label="$t('practice.common.abstractText')">
          <NInput v-model:value="thesisForm.abstractText" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
        <NFormItem :label="$t('practice.common.selectFile')" required>
          <NUpload
            v-model:file-list="fileList"
            :max="1"
            :default-upload="false"
            accept=".doc,.docx,.pdf,.zip,.rar"
          >
            <NButton>{{ $t('practice.common.selectFile') }}</NButton>
          </NUpload>
          <span class="file-hint">{{ $t('practice.common.fileHint') }}</span>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showThesisForm = false">{{ $t('practice.common.cancel') }}</NButton>
          <NButton type="primary" :loading="savingThesis" @click="handleSubmitThesis">
            {{ $t('practice.common.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
    </template>
  </div>
</template>

<style scoped src="./GraduationStudentPage.css"></style>
