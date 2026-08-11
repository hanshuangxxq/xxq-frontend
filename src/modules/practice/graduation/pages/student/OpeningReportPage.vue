<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpin,
  NEmpty,
  NButton,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NUpload,
  NResult,
  NTag,
  NSpace,
  useMessage,
  type UploadFileInfo,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import {
  fetchMyOpeningReport,
  submitOpeningReport,
  downloadOpeningReport,
  fetchMyProposals,
  fetchMyAssignments,
} from '../../api'
import { openingStatusTagType, validateUploadFile, formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { OpeningReportResponse, CampaignResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isStudent } = useRoleCheck()

const campaignId = ref<number | null>(null)
const report = ref<OpeningReportResponse | null>(null)
const loading = ref(false)

/** 门禁预判：选题审批完毕 + 已有指导教师（F-R-17 / F-R-41，后端 409 兜底） */
const gateOpen = ref(false)
const gateChecked = ref(false)

/** 开题窗口是否开放（未配置窗口视为开放，F-R-48） */
const windowOpen = ref(true)

function onCampaign(c: CampaignResponse | null): void {
  const start = c?.openingStartTime ? new Date(c.openingStartTime).getTime() : null
  const end = c?.openingEndTime ? new Date(c.openingEndTime).getTime() : null
  const nowTs = Date.now()
  windowOpen.value = start == null || end == null || (nowTs >= start && nowTs <= end)
}

async function checkGate(): Promise<void> {
  if (campaignId.value == null) return
  try {
    const [pRes, aRes] = await Promise.all([
      fetchMyProposals(),
      fetchMyAssignments(campaignId.value),
    ])
    const myProposal = pRes.data?.find((p) => p.campaignId === campaignId.value)
    const hasApproved = myProposal?.status === '审批完毕'
    gateOpen.value = hasApproved && (aRes.data?.length ?? 0) > 0
  } catch {
    gateOpen.value = false
  } finally {
    gateChecked.value = true
  }
}

async function loadReport(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const res = await fetchMyOpeningReport(campaignId.value)
    report.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  report.value = null
  gateChecked.value = false
  gateOpen.value = false
  if (id != null) {
    void loadReport()
    void checkGate()
  }
}

// ===== 提交/重提表单 =====
const showForm = ref(false)
const form = ref({ title: '', content: '' })
const fileList = ref<UploadFileInfo[]>([])
const saving = ref(false)

function startSubmit(): void {
  form.value = {
    title: report.value?.title ?? '',
    content: report.value?.content ?? '',
  }
  fileList.value = []
  showForm.value = true
}

async function handleSubmit(): Promise<void> {
  if (campaignId.value == null) return
  const f = form.value
  if (!f.title.trim()) {
    message.warning(t('graduation.student.titleRequired'))
    return
  }
  if (!f.content.trim()) {
    message.warning(t('graduation.common.contentRequired'))
    return
  }
  const raw = fileList.value[0]?.file ?? null
  if (raw) {
    const err = validateUploadFile(raw)
    if (err === 'type') {
      message.warning(t('graduation.common.fileTypeError'))
      return
    }
    if (err === 'size') {
      message.warning(t('graduation.common.fileTooLarge'))
      return
    }
  }
  saving.value = true
  try {
    await submitOpeningReport(
      { campaignId: campaignId.value, title: f.title.trim(), content: f.content.trim() },
      raw,
    )
    message.success(t('graduation.common.operationSuccess'))
    showForm.value = false
    await loadReport()
    await checkGate()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  } finally {
    saving.value = false
  }
}

async function handleDownload(): Promise<void> {
  if (!report.value) return
  try {
    await downloadOpeningReport(report.value.id)
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  }
}
</script>

<template>
  <div class="graduation-page">
    <NResult
      v-if="!isStudent"
      status="403"
      :title="$t('graduation.common.noPermission')"
      :description="$t('graduation.common.noPermissionDesc')"
    />
    <template v-else>
      <NCard class="context-card">
        <CampaignContextSelector
          v-model:campaign-id="campaignId"
          window-key="opening"
          @update:campaign-id="onCampaignChange"
          @update:campaign="onCampaign"
        />
      </NCard>

      <NCard :title="$t('graduation.student.openingTitle')" class="content-card">
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && campaignId != null && !report"
            :description="$t('graduation.common.notSubmitted')"
          />
          <template v-if="report">
            <div class="report-head">
              <NSpace align="center" :size="12">
                <b class="report-title">{{ report.title }}</b>
                <NTag :type="openingStatusTagType(report.status)" size="small" :bordered="false">
                  {{ report.status }}
                </NTag>
              </NSpace>
              <span class="report-meta"
                >{{ $t('graduation.common.submitTime') }}：{{
                  formatDateTime(report.submitTime)
                }}</span
              >
            </div>
            <div class="report-content">{{ report.content }}</div>
            <div v-if="report.fileOriginal" class="report-attachment">
              {{ $t('graduation.common.attachment') }}：{{ report.fileOriginal }}
              <NButton size="small" quaternary @click="handleDownload">
                {{ $t('graduation.common.download') }}
              </NButton>
            </div>
            <div v-if="report.status === '需修改' && report.reviewComment" class="revision-hint">
              <b
                >{{ $t('graduation.student.openingReviewTeacher') }}：{{
                  report.reviewTeacherName ?? '-'
                }}</b
              >
              <div>{{ $t('graduation.common.reviewComment') }}：{{ report.reviewComment }}</div>
            </div>
            <div v-if="report.reviewTime" class="report-meta" style="margin-top: 8px">
              {{ $t('graduation.common.reviewTime') }}：{{ formatDateTime(report.reviewTime) }}
            </div>
            <div class="report-actions">
              <NButton
                v-if="report.status === '已提交' || report.status === '需修改'"
                type="primary"
                :disabled="!windowOpen"
                @click="startSubmit"
              >
                {{ $t('graduation.student.resubmitOpening') }}
              </NButton>
              <span v-if="!windowOpen" class="window-hint">
                {{ $t('graduation.common.windowOutside') }}
              </span>
              <span v-if="report.status === '已通过'" class="readonly-hint">
                {{ $t('graduation.student.openingApprovedReadonly') }}
              </span>
            </div>
          </template>
          <div v-if="!loading && !report && campaignId != null" class="report-actions">
            <template v-if="gateChecked">
              <NButton v-if="gateOpen && windowOpen" type="primary" @click="startSubmit">
                {{ $t('graduation.student.submitOpening') }}
              </NButton>
              <div v-else class="gate-hint">
                {{
                  !gateOpen
                    ? $t('graduation.student.openingGateHint')
                    : $t('graduation.common.windowOutside')
                }}
              </div>
            </template>
          </div>
        </NSpin>
      </NCard>

      <!-- 提交/重提弹窗 -->
      <NModal
        v-model:show="showForm"
        preset="card"
        :title="$t('graduation.student.submitOpening')"
        class="graduation-form-modal"
      >
        <NForm label-placement="top">
          <NFormItem :label="$t('graduation.student.openingTitleField')" required>
            <NInput v-model:value="form.title" />
          </NFormItem>
          <NFormItem :label="$t('graduation.student.openingContent')" required>
            <NInput
              v-model:value="form.content"
              type="textarea"
              :autosize="{ minRows: 8, maxRows: 16 }"
            />
          </NFormItem>
          <NFormItem :label="$t('graduation.common.attachment')">
            <NUpload
              v-model:file-list="fileList"
              accept=".doc,.docx,.pdf,.zip,.rar"
              :max="1"
              :default-upload="false"
            >
              <NButton>{{ $t('graduation.common.selectFile') }}</NButton>
            </NUpload>
            <span class="file-hint">{{ $t('graduation.common.fileHint') }}</span>
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showForm = false">{{ $t('graduation.common.cancel') }}</NButton>
            <NButton type="primary" :loading="saving" @click="handleSubmit">
              {{ $t('graduation.common.submit') }}
            </NButton>
          </NSpace>
        </template>
      </NModal>
    </template>
  </div>
</template>

<style scoped src="./OpeningReportPage.css"></style>

<style>
.graduation-form-modal {
  width: 620px;
  max-width: 92vw;
}
</style>
