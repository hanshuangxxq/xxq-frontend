<script setup lang="ts">
import { ref, computed, h } from 'vue'
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
  NDataTable,
  NResult,
  NTag,
  NSpace,
  useMessage,
  type UploadFileInfo,
  type DataTableColumns,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import { fetchMyTheses, submitThesis, downloadThesis, fetchMyOpeningReport } from '../../api'
import {
  thesisStatusTagType,
  duplicateResultTagType,
  validateUploadFile,
  formatDateTime,
} from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { ThesisResponse, DuplicateCheckResponse, CampaignResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isStudent } = useRoleCheck()

const campaignId = ref<number | null>(null)
const theses = ref<ThesisResponse[]>([])
const loading = ref(false)

/** 门禁预判：开题已通过（F-R-41，后端 409 兜底） */
const gateOpen = ref(false)
const gateChecked = ref(false)

/** 论文窗口是否开放（未配置窗口视为开放，F-R-48） */
const windowOpen = ref(true)

function onCampaign(c: CampaignResponse | null): void {
  const start = c?.thesisStartTime ? new Date(c.thesisStartTime).getTime() : null
  const end = c?.thesisEndTime ? new Date(c.thesisEndTime).getTime() : null
  const nowTs = Date.now()
  windowOpen.value = start == null || end == null || (nowTs >= start && nowTs <= end)
}

const latest = computed<ThesisResponse | null>(
  () => theses.value.find((v) => v.isLatest === 1) ?? null,
)

/** F-R-19：仅最新版状态为 待形式审查/退回/查重不通过 时可重提 */
const canResubmit = computed(() => {
  const l = latest.value
  return !!l && ['待形式审查', '形式审查退回', '查重不通过'].includes(l.status)
})

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

async function loadTheses(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const res = await fetchMyTheses(campaignId.value)
    theses.value = res.data ?? []
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  theses.value = []
  gateChecked.value = false
  gateOpen.value = false
  if (id != null) {
    void loadTheses()
    void checkGate()
  }
}

// ===== 提交/重提弹窗 =====
const showForm = ref(false)
const form = ref({ title: '' })
const fileList = ref<UploadFileInfo[]>([])
const saving = ref(false)

function startSubmit(): void {
  form.value = { title: latest.value?.title ?? '' }
  fileList.value = []
  showForm.value = true
}

async function handleSubmit(): Promise<void> {
  if (campaignId.value == null) return
  if (!form.value.title.trim()) {
    message.warning(t('graduation.student.titleRequired'))
    return
  }
  const raw = fileList.value[0]?.file
  if (!raw) {
    message.warning(t('graduation.common.fileRequired'))
    return
  }
  const err = validateUploadFile(raw)
  if (err === 'type') {
    message.warning(t('graduation.common.fileTypeError'))
    return
  }
  if (err === 'size') {
    message.warning(t('graduation.common.fileTooLarge'))
    return
  }
  saving.value = true
  try {
    await submitThesis({ campaignId: campaignId.value, title: form.value.title.trim() }, raw)
    message.success(t('graduation.common.operationSuccess'))
    showForm.value = false
    await loadTheses()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  } finally {
    saving.value = false
  }
}

async function handleDownload(row: ThesisResponse): Promise<void> {
  try {
    await downloadThesis(row.id)
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  }
}

// ===== 版本列定义 =====
function renderDuplicateHistory(checks: DuplicateCheckResponse[]): ReturnType<typeof h> {
  if (!checks.length) return h('span', { style: 'color:#999;font-size:13px' }, '-')
  const rows = checks.map((c) =>
    h('div', { style: 'margin-bottom:6px' }, [
      h(
        'span',
        null,
        `${t('graduation.student.duplicateRate')}：${c.duplicateRate}% · ${t('graduation.student.duplicatePlatform')}：${c.platform ?? '-'} · ${t('graduation.student.duplicateTime')}：${formatDateTime(c.checkTime)} · `,
      ),
      h(
        NTag,
        { size: 'tiny', type: duplicateResultTagType(c.result), bordered: false },
        () => c.result,
      ),
      h('div', { style: 'color:#999;font-size:12px;margin-top:2px' }, c.comment ?? ''),
    ]),
  )
  return h('div', null, rows)
}

const thesisRowKey = (row: ThesisResponse) => row.id

const thesisColumns = computed<DataTableColumns<ThesisResponse>>(() => [
  {
    type: 'expand',
    width: 40,
    renderExpand: (row) =>
      h('div', { class: 'duplicate-box' }, [
        h('span', { class: 'flow-title' }, t('graduation.student.duplicateHistory')),
        h('div', { style: 'margin-top: 6px' }, renderDuplicateHistory(row.duplicateChecks)),
      ]),
  },
  {
    title: t('graduation.student.thesisVersion'),
    key: 'version',
    width: 100,
    align: 'center',
    render: (r) =>
      h(NSpace, { size: 6, align: 'center', justify: 'center' }, () => [
        h('span', null, `v${r.version}`),
        r.isLatest === 1
          ? h(NTag, { size: 'tiny', type: 'success', bordered: false }, () =>
              t('graduation.student.thesisLatest'),
            )
          : null,
      ]),
  },
  {
    title: t('graduation.student.thesisTitleField'),
    key: 'title',
    minWidth: 200,
    ellipsis: { tooltip: true },
  },
  {
    title: t('graduation.common.attachment'),
    key: 'fileOriginal',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: (r) => r.fileOriginal,
  },
  {
    title: t('graduation.common.status'),
    key: 'status',
    width: 130,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: thesisStatusTagType(r.status), size: 'small', bordered: false },
        () => r.status,
      ),
  },
  {
    title: t('graduation.common.submitTime'),
    key: 'submitTime',
    width: 150,
    render: (r) => formatDateTime(r.submitTime),
  },
  {
    title: t('graduation.common.reviewComment'),
    key: 'reviewComment',
    minWidth: 160,
    ellipsis: { tooltip: true },
    render: (r) => r.reviewComment ?? '-',
  },
  {
    title: t('graduation.common.actions'),
    key: 'actions',
    width: 100,
    render: (r) =>
      h(NButton, { size: 'small', onClick: () => handleDownload(r) }, () =>
        t('graduation.common.download'),
      ),
  },
])
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
          window-key="thesis"
          @update:campaign-id="onCampaignChange"
          @update:campaign="onCampaign"
        />
      </NCard>

      <NCard :title="$t('graduation.student.thesisTitle')" class="content-card">
        <template #header-extra>
          <NButton v-if="canResubmit" type="primary" :disabled="!windowOpen" @click="startSubmit">
            {{ $t('graduation.student.resubmitThesis') }}
          </NButton>
          <NButton
            v-else-if="gateChecked && gateOpen && !theses.length"
            type="primary"
            :disabled="!windowOpen"
            @click="startSubmit"
          >
            {{ $t('graduation.student.submitThesis') }}
          </NButton>
          <span
            v-if="!windowOpen && (canResubmit || (gateChecked && gateOpen && !theses.length))"
            class="window-hint"
          >
            {{ $t('graduation.common.windowOutside') }}
          </span>
        </template>
        <NSpin :show="loading">
          <template v-if="!theses.length && campaignId != null && !loading">
            <template v-if="!gateChecked || !gateOpen">
              <NEmpty :description="$t('graduation.student.emptyThesis')" />
              <div class="gate-hint" style="margin-top: 12px">
                {{ $t('graduation.student.thesisGateHint') }}
              </div>
            </template>
            <NEmpty v-else :description="$t('graduation.student.emptyThesis')" />
          </template>
          <NDataTable
            v-else
            :columns="thesisColumns"
            :data="theses"
            :row-key="thesisRowKey"
            :single-line="false"
            :bordered="false"
            :scroll-x="1080"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>

      <!-- 提交/重提弹窗 -->
      <NModal
        v-model:show="showForm"
        preset="card"
        :title="$t('graduation.student.resubmitThesis')"
        class="graduation-form-modal"
      >
        <NForm label-placement="top">
          <NFormItem :label="$t('graduation.student.thesisTitleField')" required>
            <NInput v-model:value="form.title" />
          </NFormItem>
          <NFormItem :label="$t('graduation.common.attachment')" required>
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

<style scoped src="./MyThesisPage.css"></style>

<style>
.graduation-form-modal {
  width: 620px;
  max-width: 92vw;
}
</style>
