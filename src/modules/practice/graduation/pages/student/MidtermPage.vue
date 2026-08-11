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
import { fetchMyMidterm, submitMidterm, downloadMidterm, fetchMyOpeningReport } from '../../api'
import {
  midtermConclusionTagType,
  validateUploadFile,
  formatDateTime,
} from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { MidtermResponse, CampaignResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isStudent } = useRoleCheck()

const campaignId = ref<number | null>(null)
const midterm = ref<MidtermResponse | null>(null)
const loading = ref(false)

/** 门禁预判：开题报告已通过（F-R-41，后端 409 兜底） */
const gateOpen = ref(false)
const gateChecked = ref(false)

/** 中期窗口是否开放（未配置窗口视为开放，F-R-48） */
const windowOpen = ref(true)

function onCampaign(c: CampaignResponse | null): void {
  const start = c?.midtermStartTime ? new Date(c.midtermStartTime).getTime() : null
  const end = c?.midtermEndTime ? new Date(c.midtermEndTime).getTime() : null
  const nowTs = Date.now()
  windowOpen.value = start == null || end == null || (nowTs >= start && nowTs <= end)
}

async function checkGate(): Promise<void> {
  if (campaignId.value == null) return
  try {
    const res = await fetchMyOpeningReport(campaignId.value)
    gateOpen.value = res.data?.status === '已通过'
  } catch {
    gateOpen.value = false
  } finally {
    gateChecked.value = true
  }
}

async function loadMidterm(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const res = await fetchMyMidterm(campaignId.value)
    midterm.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  midterm.value = null
  gateChecked.value = false
  gateOpen.value = false
  if (id != null) {
    void loadMidterm()
    void checkGate()
  }
}

// ===== 提交/重提表单 =====
const showForm = ref(false)
const form = ref({ content: '' })
const fileList = ref<UploadFileInfo[]>([])
const saving = ref(false)

function startSubmit(): void {
  form.value = { content: midterm.value?.content ?? '' }
  fileList.value = []
  showForm.value = true
}

async function handleSubmit(): Promise<void> {
  if (campaignId.value == null) return
  if (!form.value.content.trim()) {
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
    await submitMidterm({ campaignId: campaignId.value, content: form.value.content.trim() }, raw)
    message.success(t('graduation.common.operationSuccess'))
    showForm.value = false
    await loadMidterm()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  } finally {
    saving.value = false
  }
}

async function handleDownload(): Promise<void> {
  if (!midterm.value) return
  try {
    await downloadMidterm(midterm.value.id)
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
          window-key="midterm"
          @update:campaign-id="onCampaignChange"
          @update:campaign="onCampaign"
        />
      </NCard>

      <NCard :title="$t('graduation.student.midtermTitle')" class="content-card">
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && campaignId != null && !midterm"
            :description="$t('graduation.common.notSubmitted')"
          />
          <template v-if="midterm">
            <div class="report-head">
              <NSpace align="center" :size="12">
                <NTag
                  :type="midterm.status === '已评审' ? 'success' : 'warning'"
                  size="small"
                  :bordered="false"
                >
                  {{ midterm.status }}
                </NTag>
                <NTag
                  v-if="midterm.conclusion"
                  :type="midtermConclusionTagType(midterm.conclusion)"
                  size="small"
                  :bordered="false"
                >
                  {{ $t('graduation.student.midtermConclusion') }}：{{ midterm.conclusion }}
                </NTag>
              </NSpace>
              <span class="report-meta"
                >{{ $t('graduation.common.submitTime') }}：{{
                  formatDateTime(midterm.submitTime)
                }}</span
              >
            </div>
            <div class="report-content">{{ midterm.content }}</div>
            <div v-if="midterm.fileOriginal" class="report-attachment">
              {{ $t('graduation.common.attachment') }}：{{ midterm.fileOriginal }}
              <NButton size="small" quaternary @click="handleDownload">
                {{ $t('graduation.common.download') }}
              </NButton>
            </div>
            <div v-if="midterm.reviewComment" class="review-note">
              <b>{{ $t('graduation.common.reviewComment') }}：</b>{{ midterm.reviewComment }}
            </div>
            <div v-if="midterm.reviewTime" class="report-meta" style="margin-top: 8px">
              {{ $t('graduation.common.reviewTime') }}：{{ formatDateTime(midterm.reviewTime) }}
            </div>
            <div class="report-actions">
              <NButton
                v-if="midterm.status === '已提交'"
                type="primary"
                :disabled="!windowOpen"
                @click="startSubmit"
              >
                {{ $t('graduation.student.resubmitMidterm') }}
              </NButton>
              <span v-if="!windowOpen" class="window-hint">
                {{ $t('graduation.common.windowOutside') }}
              </span>
              <span v-if="midterm.status === '已评审'" class="readonly-hint">
                {{ $t('graduation.student.midtermReviewedReadonly') }}
              </span>
            </div>
          </template>
          <div v-if="!loading && !midterm && campaignId != null" class="report-actions">
            <template v-if="gateChecked">
              <NButton v-if="gateOpen && windowOpen" type="primary" @click="startSubmit">
                {{ $t('graduation.student.submitMidterm') }}
              </NButton>
              <div v-else class="gate-hint">
                {{
                  !gateOpen
                    ? $t('graduation.student.midtermGateHint')
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
        :title="$t('graduation.student.submitMidterm')"
        class="graduation-form-modal"
      >
        <NForm label-placement="top">
          <NFormItem :label="$t('graduation.student.midtermContent')" required>
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

<style scoped src="./MidtermPage.css"></style>

<style>
.graduation-form-modal {
  width: 620px;
  max-width: 92vw;
}
</style>
