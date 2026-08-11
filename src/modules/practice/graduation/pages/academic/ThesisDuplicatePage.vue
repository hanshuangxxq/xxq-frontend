<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpin,
  NEmpty,
  NButton,
  NDataTable,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
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
import {
  fetchCampaignTheses,
  registerDuplicateCheck,
  downloadThesis,
  exportThesisPackage,
} from '../../api'
import {
  thesisStatusTagType,
  duplicateResultTagType,
  formatDateTime,
  tsToIso,
} from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { ThesisResponse, ThesisStatusCode, DuplicateResultCode } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const campaignId = ref<number | null>(null)
const list = ref<ThesisResponse[]>([])
const loading = ref(false)
const filterStatus = ref<ThesisStatusCode | null>(null)
const exporting = ref(false)

const statusOptions = computed(() => [
  { label: t('graduation.academic.thesisStatusSubmitted'), value: 'SUBMITTED' as ThesisStatusCode },
  { label: t('graduation.academic.thesisStatusApproved'), value: 'APPROVED' as ThesisStatusCode },
  { label: t('graduation.academic.thesisStatusRevision'), value: 'REVISION' as ThesisStatusCode },
  {
    label: t('graduation.academic.thesisStatusPassed'),
    value: 'DUPLICATE_PASSED' as ThesisStatusCode,
  },
  {
    label: t('graduation.academic.thesisStatusFailed'),
    value: 'DUPLICATE_FAILED' as ThesisStatusCode,
  },
])

async function loadList(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const res = await fetchCampaignTheses(campaignId.value, filterStatus.value)
    // 最新版优先
    list.value = (res.data ?? []).sort((a, b) => b.isLatest - a.isLatest || b.version - a.version)
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  list.value = []
  if (id != null) void loadList()
}

/** 仅最新版且状态为 待查重/查重不通过 可登记（F-R-40） */
function canRegister(row: ThesisResponse): boolean {
  return row.isLatest === 1 && ['形式审查通过', '查重不通过'].includes(row.status)
}

// ===== 登记查重弹窗 =====
const showRegister = ref(false)
const registering = ref<ThesisResponse | null>(null)
const registerForm = ref<{
  duplicateRate: number | null
  platform: string
  checkTs: number
  result: DuplicateResultCode | null
  comment: string
}>({ duplicateRate: null, platform: '', checkTs: Date.now(), result: null, comment: '' })
const saving = ref(false)

function startRegister(row: ThesisResponse): void {
  registering.value = row
  registerForm.value = {
    duplicateRate: null,
    platform: '',
    checkTs: Date.now(),
    result: null,
    comment: '',
  }
  showRegister.value = true
}

async function handleRegister(): Promise<void> {
  if (!registering.value) return
  const f = registerForm.value
  if (
    f.duplicateRate == null ||
    !Number.isInteger(f.duplicateRate) ||
    f.duplicateRate < 0 ||
    f.duplicateRate > 100
  ) {
    message.warning(t('graduation.academic.rateRequired'))
    return
  }
  if (!f.result) {
    message.warning(t('graduation.common.required'))
    return
  }
  saving.value = true
  try {
    await registerDuplicateCheck({
      thesisId: registering.value.id,
      duplicateRate: f.duplicateRate,
      platform: f.platform || undefined,
      checkTime: tsToIso(f.checkTs),
      result: f.result,
      comment: f.comment || undefined,
    })
    message.success(t('graduation.common.operationSuccess'))
    showRegister.value = false
    await loadList()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
    await loadList()
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

async function handleExportPackage(): Promise<void> {
  if (campaignId.value == null) return
  exporting.value = true
  try {
    await exportThesisPackage(campaignId.value, filterStatus.value)
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  } finally {
    exporting.value = false
  }
}

const columns = computed<DataTableColumns<ThesisResponse>>(() => [
  {
    type: 'expand',
    width: 40,
    renderExpand: (row) =>
      h('div', { class: 'review-detail' }, [
        h('div', { class: 'detail-label' }, t('graduation.student.duplicateHistory')),
        row.duplicateChecks.length
          ? h(
              'div',
              null,
              row.duplicateChecks.map((c) =>
                h('div', { class: 'duplicate-row' }, [
                  h(NSpace, { size: 8, align: 'center' }, () => [
                    h(
                      'span',
                      null,
                      `${t('graduation.academic.duplicateRate')}：${c.duplicateRate}% · ${t('graduation.academic.platform')}：${c.platform ?? '-'} · ${t('graduation.academic.checkTime')}：${formatDateTime(c.checkTime)} · ${t('graduation.academic.operatorName')}：${c.operatorName}`,
                    ),
                    h(
                      NTag,
                      { size: 'tiny', type: duplicateResultTagType(c.result), bordered: false },
                      () => c.result,
                    ),
                  ]),
                  c.comment ? h('div', { class: 'version-comment' }, c.comment) : null,
                ]),
              ),
            )
          : h('div', { class: 'version-meta' }, '-'),
      ]),
  },
  { title: t('graduation.common.student'), key: 'studentName', width: 100 },
  {
    title: t('graduation.student.thesisTitleField'),
    key: 'title',
    minWidth: 180,
    ellipsis: { tooltip: true },
  },
  {
    title: t('graduation.student.thesisVersion'),
    key: 'version',
    width: 90,
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
    title: t('graduation.common.status'),
    key: 'status',
    width: 120,
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
    title: t('graduation.common.actions'),
    key: 'actions',
    width: 200,
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        canRegister(row)
          ? h(NButton, { size: 'small', type: 'primary', onClick: () => startRegister(row) }, () =>
              t('graduation.academic.registerCheck'),
            )
          : h(NTag, { size: 'small', type: 'default', bordered: false }, () =>
              t('graduation.academic.checkDisabled'),
            ),
        h(NButton, { size: 'small', onClick: () => handleDownload(row) }, () =>
          t('graduation.common.download'),
        ),
      ]),
  },
])
</script>

<template>
  <div class="graduation-page">
    <NResult
      v-if="!isAcademicAdmin"
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

      <NCard :title="$t('graduation.academic.thesisMgmtTitle')" class="content-card">
        <template #header-extra>
          <NSpace align="center" :size="12">
            <NSelect
              v-model:value="filterStatus"
              :options="statusOptions"
              :placeholder="$t('graduation.academic.thesisStatusFilter')"
              clearable
              style="width: 150px"
              @update:value="loadList"
            />
            <NButton :loading="exporting" @click="handleExportPackage">
              {{ $t('graduation.academic.exportPackage') }}
            </NButton>
          </NSpace>
        </template>
        <div class="flow-hint">{{ $t('graduation.academic.exportPackageFlow') }}</div>
        <NSpin :show="loading">
          <NEmpty v-if="!loading && !list.length" :description="$t('graduation.common.empty')" />
          <NDataTable
            v-else
            :columns="columns"
            :data="list"
            :row-key="(r: ThesisResponse) => r.id"
            :single-line="false"
            :bordered="false"
            :scroll-x="920"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>

      <!-- 登记查重弹窗 -->
      <NModal
        v-model:show="showRegister"
        preset="card"
        :title="`${$t('graduation.academic.registerCheckTitle')} - ${registering?.studentName ?? ''} (v${registering?.version ?? ''})`"
        class="graduation-form-modal"
      >
        <NForm label-placement="top">
          <NSpace :size="12" wrap>
            <NFormItem
              :label="$t('graduation.academic.duplicateRate')"
              required
              style="width: 180px"
            >
              <NInputNumber
                v-model:value="registerForm.duplicateRate"
                :min="0"
                :max="100"
                :precision="0"
                style="width: 100%"
              />
            </NFormItem>
            <NFormItem :label="$t('graduation.academic.platform')" style="width: 240px">
              <NInput v-model:value="registerForm.platform" />
            </NFormItem>
          </NSpace>
          <NSpace :size="12" wrap>
            <NFormItem :label="$t('graduation.academic.checkTime')" required style="width: 240px">
              <NDatePicker
                v-model:value="registerForm.checkTs"
                type="datetime"
                style="width: 100%"
              />
            </NFormItem>
            <NFormItem :label="$t('graduation.academic.result')" required>
              <NRadioGroup v-model:value="registerForm.result">
                <NRadio value="PASS">{{ $t('graduation.academic.resultPass') }}</NRadio>
                <NRadio value="FAIL">{{ $t('graduation.academic.resultFail') }}</NRadio>
              </NRadioGroup>
            </NFormItem>
          </NSpace>
          <NFormItem :label="$t('graduation.academic.checkComment')">
            <NInput
              v-model:value="registerForm.comment"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showRegister = false">{{ $t('graduation.common.cancel') }}</NButton>
            <NButton type="primary" :loading="saving" @click="handleRegister">
              {{ $t('graduation.common.confirm') }}
            </NButton>
          </NSpace>
        </template>
      </NModal>
    </template>
  </div>
</template>

<style scoped src="./ThesisDuplicatePage.css"></style>

<style>
.graduation-form-modal {
  width: 640px;
  max-width: 94vw;
}
</style>
