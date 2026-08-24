<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
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
  NTag,
  NSpace,
  NDivider,
  NResult,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchCampaigns, createCampaign, updateCampaign, updateCampaignStatus } from '../../api'
import { fetchGrades } from '@/modules/grades/api'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import { campaignStatusTagType, formatDateTime, tsToIso } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type {
  CampaignResponse,
  CampaignStatusCode,
  CampaignCreateRequest,
  CampaignUpdateRequest,
} from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const campaigns = ref<CampaignResponse[]>([])
const loading = ref(false)
const { pagination, reset } = useRemotePagination(loadCampaigns)
const filterStatus = ref<CampaignStatusCode | null>(null)

const gradeOptions = ref<{ label: string; value: number }[]>([])

const statusOptions = computed(() => [
  { label: t('graduation.common.campaignDraft'), value: 'DRAFT' as CampaignStatusCode },
  { label: t('graduation.common.campaignOpen'), value: 'OPEN' as CampaignStatusCode },
  { label: t('graduation.common.campaignClosed'), value: 'CLOSED' as CampaignStatusCode },
])

async function loadCampaigns(): Promise<void> {
  loading.value = true
  try {
    const res = await fetchCampaigns({
      status: filterStatus.value ?? undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    campaigns.value = res.data.records
    pagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function handleFilterChange(): void {
  reset()
  loadCampaigns()
}

/** 中文状态 -> 枚举 code（状态变更下拉过滤用） */
function statusCodeOf(status: string): CampaignStatusCode {
  if (status === '草稿') return 'DRAFT'
  if (status === '进行中') return 'OPEN'
  return 'CLOSED'
}

// ===== 状态变更（F-R-43 二次确认）=====
const showStatusConfirm = ref(false)
const pendingStatus = ref<{
  row: CampaignResponse
  code: CampaignStatusCode
  label: string
} | null>(null)
const changingStatus = ref(false)

function requestStatusChange(row: CampaignResponse, code: string): void {
  const target = statusOptions.value.find((o) => o.value === code)
  if (!target) return
  pendingStatus.value = { row, code: code as CampaignStatusCode, label: target.label }
  showStatusConfirm.value = true
}

async function handleStatusChange(): Promise<void> {
  const p = pendingStatus.value
  if (!p) return
  changingStatus.value = true
  try {
    await updateCampaignStatus(p.row.id, p.code)
    message.success(t('graduation.common.operationSuccess'))
    showStatusConfirm.value = false
    await loadCampaigns()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  } finally {
    changingStatus.value = false
  }
}

// ===== 创建/编辑表单 =====
interface CampaignForm {
  name: string
  gradeIds: number[]
  topicStartTs: number | null
  topicEndTs: number | null
  supervisorCapacity: number | null
  freeSelectCapacity: number | null
  openingStartTs: number | null
  openingEndTs: number | null
  midtermStartTs: number | null
  midtermEndTs: number | null
  thesisStartTs: number | null
  thesisEndTs: number | null
  advisorWeight: number | null
  reviewerWeight: number | null
  defenseWeight: number | null
}

const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)
/** 选题开始后编辑受限（F-R-36） */
const locked = ref(false)
const originalTopicEndTs = ref<number | null>(null)
const originalSupervisor = ref<number | null>(null)
const originalFreeSelect = ref<number | null>(null)
/** F-R-37：表单字段附近提示 */
const nameError = ref('')
const gradeError = ref('')

const form = ref<CampaignForm>(emptyForm())

function emptyForm(): CampaignForm {
  return {
    name: '',
    gradeIds: [],
    topicStartTs: null,
    topicEndTs: null,
    supervisorCapacity: null,
    freeSelectCapacity: null,
    openingStartTs: null,
    openingEndTs: null,
    midtermStartTs: null,
    midtermEndTs: null,
    thesisStartTs: null,
    thesisEndTs: null,
    advisorWeight: 30,
    reviewerWeight: 20,
    defenseWeight: 50,
  }
}

function startCreate(): void {
  formMode.value = 'create'
  editingId.value = null
  locked.value = false
  originalTopicEndTs.value = null
  originalSupervisor.value = null
  originalFreeSelect.value = null
  nameError.value = ''
  gradeError.value = ''
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(row: CampaignResponse): void {
  formMode.value = 'edit'
  editingId.value = row.id
  locked.value = new Date(row.topicStartTime).getTime() <= Date.now()
  originalTopicEndTs.value = new Date(row.topicEndTime).getTime()
  originalSupervisor.value = row.supervisorCapacity
  originalFreeSelect.value = row.freeSelectCapacity
  nameError.value = ''
  gradeError.value = ''
  form.value = {
    name: row.name,
    gradeIds: row.allowedGradeIds,
    topicStartTs: new Date(row.topicStartTime).getTime(),
    topicEndTs: new Date(row.topicEndTime).getTime(),
    supervisorCapacity: row.supervisorCapacity,
    freeSelectCapacity: row.freeSelectCapacity,
    openingStartTs: row.openingStartTime ? new Date(row.openingStartTime).getTime() : null,
    openingEndTs: row.openingEndTime ? new Date(row.openingEndTime).getTime() : null,
    midtermStartTs: row.midtermStartTime ? new Date(row.midtermStartTime).getTime() : null,
    midtermEndTs: row.midtermEndTime ? new Date(row.midtermEndTime).getTime() : null,
    thesisStartTs: row.thesisStartTime ? new Date(row.thesisStartTime).getTime() : null,
    thesisEndTs: row.thesisEndTime ? new Date(row.thesisEndTime).getTime() : null,
    advisorWeight: row.advisorWeight,
    reviewerWeight: row.reviewerWeight,
    defenseWeight: row.defenseWeight,
  }
  showForm.value = true
}

/** F-R-35：前端预校验 */
function validateForm(): string | null {
  const f = form.value
  if (!f.name.trim()) return t('graduation.academic.campaignNameRequired')
  if (!f.gradeIds.length) return t('graduation.academic.gradesRequired')
  if (f.topicStartTs == null || f.topicEndTs == null) return t('graduation.common.required')
  if (f.topicEndTs <= f.topicStartTs) return t('graduation.academic.endAfterStart')
  if (f.supervisorCapacity == null || f.supervisorCapacity <= 0)
    return t('graduation.common.required')
  if (f.freeSelectCapacity == null || f.freeSelectCapacity > f.supervisorCapacity) {
    return t('graduation.academic.freeLeSupervisor')
  }
  if (f.advisorWeight == null || f.reviewerWeight == null || f.defenseWeight == null) {
    return t('graduation.common.required')
  }
  if (f.advisorWeight + f.reviewerWeight + f.defenseWeight !== 100) {
    return t('graduation.academic.weightSum100')
  }
  for (const [s, e] of [
    [f.openingStartTs, f.openingEndTs],
    [f.midtermStartTs, f.midtermEndTs],
    [f.thesisStartTs, f.thesisEndTs],
  ] as const) {
    if (s != null && e != null && e <= s) return t('graduation.academic.endAfterStart')
  }
  return null
}

function bodyOf(): CampaignCreateRequest {
  const f = form.value
  return {
    name: f.name.trim(),
    allowedGradeIds: f.gradeIds,
    topicStartTime: tsToIso(f.topicStartTs!),
    topicEndTime: tsToIso(f.topicEndTs!),
    supervisorCapacity: f.supervisorCapacity!,
    freeSelectCapacity: f.freeSelectCapacity!,
    openingStartTime: f.openingStartTs != null ? tsToIso(f.openingStartTs) : null,
    openingEndTime: f.openingEndTs != null ? tsToIso(f.openingEndTs) : null,
    midtermStartTime: f.midtermStartTs != null ? tsToIso(f.midtermStartTs) : null,
    midtermEndTime: f.midtermEndTs != null ? tsToIso(f.midtermEndTs) : null,
    thesisStartTime: f.thesisStartTs != null ? tsToIso(f.thesisStartTs) : null,
    thesisEndTime: f.thesisEndTs != null ? tsToIso(f.thesisEndTs) : null,
    advisorWeight: f.advisorWeight!,
    reviewerWeight: f.reviewerWeight!,
    defenseWeight: f.defenseWeight!,
  }
}

async function handleSave(): Promise<void> {
  nameError.value = ''
  gradeError.value = ''
  const err = validateForm()
  if (err) {
    message.warning(err)
    return
  }
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createCampaign(bodyOf())
    } else {
      // F-R-36：选题开始后仅传允许改的字段
      const b: CampaignUpdateRequest = { ...bodyOf() }
      if (locked.value) {
        delete b.name
        delete b.allowedGradeIds
        delete b.topicStartTime
      }
      await updateCampaign(editingId.value!, b)
    }
    message.success(t('graduation.common.saveSuccess'))
    showForm.value = false
    await loadCampaigns()
  } catch (e) {
    const msg = (e as Error).message || ''
    message.error(msg || t('graduation.common.saveFail'))
    // F-R-37：409 冲突在对应字段附近提示
    if (msg.includes('同名')) nameError.value = msg
    if (msg.includes('同年级')) gradeError.value = msg
  } finally {
    saving.value = false
  }
}

const columns = computed<DataTableColumns<CampaignResponse>>(() => [
  {
    title: t('graduation.academic.campaignName'),
    key: 'name',
    minWidth: 160,
    ellipsis: { tooltip: true },
  },
  {
    title: t('graduation.academic.allowedGrades'),
    key: 'allowedGradeIds',
    width: 130,
    render: (r) =>
      r.allowedGradeIds.length
        ? t('graduation.academic.gradeCount', { count: r.allowedGradeIds.length })
        : '-',
  },
  {
    title: t('graduation.academic.topicStartTime'),
    key: 'topicStartTime',
    width: 150,
    render: (r) => formatDateTime(r.topicStartTime),
  },
  {
    title: t('graduation.academic.topicEndTime'),
    key: 'topicEndTime',
    width: 150,
    render: (r) => formatDateTime(r.topicEndTime),
  },
  {
    title: t('graduation.academic.supervisorCapacity'),
    key: 'supervisorCapacity',
    width: 90,
    align: 'center',
    render: (r) => `${r.freeSelectCapacity}/${r.supervisorCapacity}`,
  },
  {
    title: t('graduation.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: campaignStatusTagType(r.status), size: 'small', bordered: false },
        () => r.status,
      ),
  },
  {
    title: t('graduation.common.createTime'),
    key: 'createTime',
    width: 150,
    render: (r) => formatDateTime(r.createTime),
  },
  {
    title: t('graduation.common.actions'),
    key: 'actions',
    width: 270,
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'small', onClick: () => startEdit(row) }, () =>
          t('graduation.common.edit'),
        ),
        // 状态变更：每个目标状态一个独立按钮（排除当前状态，F-R-43 二次确认）
        ...statusOptions.value
          .filter((o) => o.value !== statusCodeOf(row.status))
          .map((o) =>
            h(NButton, { size: 'small', onClick: () => requestStatusChange(row, o.value) }, () =>
              t('graduation.common.setStatus', { status: o.label }),
            ),
          ),
      ]),
  },
])

onMounted(() => {
  if (!isAcademicAdmin.value) return
  loadCampaigns()
  void fetchGrades().then((res) => {
    gradeOptions.value = (res.data ?? []).map((g) => ({ label: g.name, value: g.id }))
  })
})
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
      <NCard :title="$t('graduation.academic.campaignMgmtTitle')">
        <template #header-extra>
          <NSpace align="center">
            <NSelect
              v-model:value="filterStatus"
              :options="statusOptions"
              :placeholder="$t('graduation.common.status')"
              clearable
              style="width: 140px"
              @update:value="handleFilterChange"
            />
            <NButton type="primary" @click="startCreate">
              {{ $t('graduation.academic.addCampaign') }}
            </NButton>
          </NSpace>
        </template>
        <NSpin :show="loading">
          <NDataTable
            :columns="columns"
            :data="campaigns"
            :row-key="(r: CampaignResponse) => r.id"
            :single-line="false"
            :bordered="false"
            :scroll-x="1200"
            remote
            :pagination="pagination"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>

      <!-- 创建/编辑弹窗 -->
      <NModal
        v-model:show="showForm"
        preset="card"
        :title="
          formMode === 'create'
            ? $t('graduation.academic.addCampaign')
            : $t('graduation.academic.editCampaign')
        "
        class="graduation-campaign-modal"
      >
        <div v-if="locked" class="lock-hint">
          {{ $t('graduation.academic.editLocked') }} · {{ $t('graduation.academic.extendOnly') }}
        </div>
        <NForm label-placement="top">
          <NFormItem :label="$t('graduation.academic.campaignName')" required :feedback="nameError">
            <NInput v-model:value="form.name" :disabled="locked" />
          </NFormItem>
          <NFormItem
            :label="$t('graduation.academic.allowedGrades')"
            required
            :feedback="gradeError"
          >
            <NSelect
              v-model:value="form.gradeIds"
              :options="gradeOptions"
              multiple
              :disabled="locked"
              style="width: 100%"
            />
          </NFormItem>
          <NSpace :size="12" wrap>
            <NFormItem
              :label="$t('graduation.academic.topicStartTime')"
              required
              style="width: 260px"
            >
              <NDatePicker
                v-model:value="form.topicStartTs"
                type="datetime"
                :disabled="locked"
                style="width: 100%"
              />
            </NFormItem>
            <NFormItem
              :label="$t('graduation.academic.topicEndTime')"
              required
              style="width: 260px"
            >
              <NDatePicker
                v-model:value="form.topicEndTs"
                type="datetime"
                :disabled="
                  locked &&
                  originalTopicEndTs != null &&
                  form.topicEndTs != null &&
                  form.topicEndTs < originalTopicEndTs
                "
                style="width: 100%"
              />
            </NFormItem>
          </NSpace>
          <NSpace :size="12" wrap>
            <NFormItem
              :label="$t('graduation.academic.supervisorCapacity')"
              required
              style="width: 200px"
            >
              <NInputNumber
                v-model:value="form.supervisorCapacity"
                :min="locked && originalSupervisor != null ? originalSupervisor : 1"
                style="width: 100%"
              />
            </NFormItem>
            <NFormItem
              :label="$t('graduation.academic.freeSelectCapacity')"
              required
              style="width: 200px"
            >
              <NInputNumber
                v-model:value="form.freeSelectCapacity"
                :min="locked && originalFreeSelect != null ? originalFreeSelect : 0"
                :max="form.supervisorCapacity ?? undefined"
                style="width: 100%"
              />
            </NFormItem>
          </NSpace>
          <NDivider dashed style="margin: 8px 0">
            {{ $t('graduation.academic.openingWindow') }}
          </NDivider>
          <NSpace :size="12" wrap>
            <NFormItem :label="$t('graduation.common.windowFrom')" style="width: 240px">
              <NDatePicker
                v-model:value="form.openingStartTs"
                type="datetime"
                clearable
                style="width: 100%"
              />
            </NFormItem>
            <NFormItem :label="$t('graduation.common.windowTo')" style="width: 240px">
              <NDatePicker
                v-model:value="form.openingEndTs"
                type="datetime"
                clearable
                style="width: 100%"
              />
            </NFormItem>
          </NSpace>
          <NDivider dashed style="margin: 8px 0">
            {{ $t('graduation.academic.midtermWindow') }}
          </NDivider>
          <NSpace :size="12" wrap>
            <NFormItem :label="$t('graduation.common.windowFrom')" style="width: 240px">
              <NDatePicker
                v-model:value="form.midtermStartTs"
                type="datetime"
                clearable
                style="width: 100%"
              />
            </NFormItem>
            <NFormItem :label="$t('graduation.common.windowTo')" style="width: 240px">
              <NDatePicker
                v-model:value="form.midtermEndTs"
                type="datetime"
                clearable
                style="width: 100%"
              />
            </NFormItem>
          </NSpace>
          <NDivider dashed style="margin: 8px 0">
            {{ $t('graduation.academic.thesisWindow') }}
          </NDivider>
          <NSpace :size="12" wrap>
            <NFormItem :label="$t('graduation.common.windowFrom')" style="width: 240px">
              <NDatePicker
                v-model:value="form.thesisStartTs"
                type="datetime"
                clearable
                style="width: 100%"
              />
            </NFormItem>
            <NFormItem :label="$t('graduation.common.windowTo')" style="width: 240px">
              <NDatePicker
                v-model:value="form.thesisEndTs"
                type="datetime"
                clearable
                style="width: 100%"
              />
            </NFormItem>
          </NSpace>
          <NDivider dashed style="margin: 8px 0">
            {{ $t('graduation.common.score') }}（{{ $t('graduation.academic.weightSum100') }}）
          </NDivider>
          <NSpace :size="12" wrap>
            <NFormItem :label="$t('graduation.academic.advisorWeight')" style="width: 160px">
              <NInputNumber
                v-model:value="form.advisorWeight"
                :min="0"
                :max="100"
                style="width: 100%"
              />
            </NFormItem>
            <NFormItem :label="$t('graduation.academic.reviewerWeight')" style="width: 160px">
              <NInputNumber
                v-model:value="form.reviewerWeight"
                :min="0"
                :max="100"
                style="width: 100%"
              />
            </NFormItem>
            <NFormItem :label="$t('graduation.academic.defenseWeight')" style="width: 160px">
              <NInputNumber
                v-model:value="form.defenseWeight"
                :min="0"
                :max="100"
                style="width: 100%"
              />
            </NFormItem>
          </NSpace>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showForm = false">{{ $t('graduation.common.cancel') }}</NButton>
            <NButton type="primary" :loading="saving" @click="handleSave">
              {{ $t('graduation.common.save') }}
            </NButton>
          </NSpace>
        </template>
      </NModal>

      <!-- 状态变更确认弹窗 -->
      <NModal
        v-model:show="showStatusConfirm"
        preset="card"
        :title="$t('graduation.academic.changeStatus')"
        class="graduation-status-modal"
      >
        <span style="font-size: 14px; color: #333">
          {{
            $t('graduation.academic.statusChangeConfirm', {
              status: pendingStatus?.label ?? '',
            })
          }}
        </span>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showStatusConfirm = false">{{
              $t('graduation.common.cancel')
            }}</NButton>
            <NButton type="primary" :loading="changingStatus" @click="handleStatusChange">
              {{ $t('graduation.common.confirm') }}
            </NButton>
          </NSpace>
        </template>
      </NModal>
    </template>
  </div>
</template>

<style scoped src="./CampaignManagementPage.css"></style>

<style>
.graduation-campaign-modal {
  width: 720px;
  max-width: 96vw;
}
.graduation-status-modal {
  width: 420px;
  max-width: 92vw;
}
</style>
