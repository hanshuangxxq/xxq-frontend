<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpin,
  NEmpty,
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NDatePicker,
  NRadioGroup,
  NRadio,
  NResult,
  NTag,
  NSpace,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import { fetchMyAssignments, fetchGuidanceLogs, createGuidanceLog } from '../../api'
import { tsToIso, formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { AssignmentResponse, GuidanceLogResponse, GuidanceFormCode } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isTeacher } = useRoleCheck()

const campaignId = ref<number | null>(null)
const students = ref<AssignmentResponse[]>([])
const studentId = ref<number | null>(null)
const logs = ref<GuidanceLogResponse[]>([])
const loading = ref(false)

async function loadStudents(): Promise<void> {
  if (campaignId.value == null) return
  try {
    const res = await fetchMyAssignments(campaignId.value)
    students.value = res.data ?? []
    if (!studentId.value && students.value.length) {
      studentId.value = students.value[0]!.studentId
    }
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  }
}

async function loadLogs(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const res = await fetchGuidanceLogs(campaignId.value, studentId.value)
    logs.value = res.data ?? []
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  students.value = []
  studentId.value = null
  logs.value = []
  if (id != null) {
    void loadStudents()
    void loadLogs()
  }
}

function onStudentChange(id: number | null): void {
  studentId.value = id
  void loadLogs()
}

// ===== 记录表单 =====
const logForm = ref<{ logTs: number | null; form: GuidanceFormCode | null; summary: string }>({
  logTs: null,
  form: null,
  summary: '',
})
const saving = ref(false)

const studentOptions = computed(() =>
  students.value.map((s) => ({
    label: `${s.studentName}（${s.studentNo}）`,
    value: s.studentId,
  })),
)

const formOptions = [
  { label: t('graduation.teacher.formOnline'), value: 'ONLINE' as GuidanceFormCode },
  { label: t('graduation.teacher.formOffline'), value: 'OFFLINE' as GuidanceFormCode },
  { label: t('graduation.teacher.formPhone'), value: 'PHONE' as GuidanceFormCode },
]

async function handleAddLog(): Promise<void> {
  if (campaignId.value == null || studentId.value == null) {
    message.warning(t('graduation.teacher.studentRequired'))
    return
  }
  const f = logForm.value
  if (f.logTs == null) {
    message.warning(t('graduation.teacher.logTime'))
    return
  }
  if (!f.form) {
    message.warning(t('graduation.teacher.logForm'))
    return
  }
  if (!f.summary.trim()) {
    message.warning(t('graduation.teacher.summaryRequired'))
    return
  }
  saving.value = true
  try {
    await createGuidanceLog({
      campaignId: campaignId.value,
      studentId: studentId.value,
      logTime: tsToIso(f.logTs),
      form: f.form,
      summary: f.summary.trim(),
    })
    message.success(t('graduation.common.operationSuccess'))
    logForm.value = { logTs: null, form: null, summary: '' }
    await loadLogs()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  } finally {
    saving.value = false
  }
}

const logColumns = computed<DataTableColumns<GuidanceLogResponse>>(() => [
  { title: t('graduation.common.student'), key: 'studentName', width: 100 },
  {
    title: t('graduation.teacher.logTime'),
    key: 'logTime',
    width: 150,
    render: (r) => formatDateTime(r.logTime),
  },
  {
    title: t('graduation.teacher.logForm'),
    key: 'form',
    width: 80,
    align: 'center',
    render: (r) => h(NTag, { size: 'small', bordered: false }, () => r.form),
  },
  {
    title: t('graduation.teacher.logSummary'),
    key: 'summary',
    minWidth: 240,
    ellipsis: { tooltip: true },
  },
  {
    title: t('graduation.common.createTime'),
    key: 'createTime',
    width: 150,
    render: (r) => formatDateTime(r.createTime),
  },
])
</script>

<template>
  <div class="graduation-page">
    <NResult
      v-if="!isTeacher"
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

      <NCard :title="$t('graduation.teacher.addLog')" class="content-card">
        <NForm label-placement="left" :label-width="90">
          <NFormItem :label="$t('graduation.common.student')" required>
            <NSelect
              v-model:value="studentId"
              :options="studentOptions"
              :placeholder="$t('graduation.teacher.studentRequired')"
              style="width: 260px"
              @update:value="onStudentChange"
            />
          </NFormItem>
          <NSpace :size="16" wrap>
            <NFormItem :label="$t('graduation.teacher.logTime')" required>
              <NDatePicker v-model:value="logForm.logTs" type="datetime" style="width: 220px" />
            </NFormItem>
            <NFormItem :label="$t('graduation.teacher.logForm')" required>
              <NRadioGroup v-model:value="logForm.form">
                <NRadio v-for="opt in formOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </NRadio>
              </NRadioGroup>
            </NFormItem>
          </NSpace>
          <NFormItem :label="$t('graduation.teacher.logSummary')" required>
            <NInput
              v-model:value="logForm.summary"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 6 }"
              style="width: 100%"
            />
          </NFormItem>
          <NFormItem>
            <NButton type="primary" :loading="saving" @click="handleAddLog">
              {{ $t('graduation.teacher.addLog') }}
            </NButton>
          </NFormItem>
        </NForm>
      </NCard>

      <NCard
        :title="$t('graduation.teacher.logHistory')"
        class="content-card"
        style="margin-top: 16px"
      >
        <NSpin :show="loading">
          <NEmpty v-if="!loading && !logs.length" :description="$t('graduation.common.empty')" />
          <NDataTable
            v-else
            :columns="logColumns"
            :data="logs"
            :row-key="(r: GuidanceLogResponse) => r.id"
            :single-line="false"
            :bordered="false"
            :scroll-x="720"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./GuidanceLogPage.css"></style>
