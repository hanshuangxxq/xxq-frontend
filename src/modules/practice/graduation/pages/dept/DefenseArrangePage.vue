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
  NSelect,
  NDatePicker,
  NResult,
  NSpace,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import { fetchDefenseList, arrangeDefense, fetchDashboard } from '../../api'
import { fetchTeachers } from '@/modules/curriculum/api'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import { tsToIso, formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { DefenseResponse, DashboardRow } from '../../types'
import type { Teacher } from '@/modules/curriculum/types'

const { t } = useI18n()
const message = useMessage()
const { isDepartment } = useRoleCheck()

const campaignId = ref<number | null>(null)
const list = ref<DefenseResponse[]>([])
const studentRows = ref<DashboardRow[]>([])
const loading = ref(false)

async function loadData(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const [dRes, rowsRes] = await Promise.all([
      fetchDefenseList(campaignId.value),
      fetchDashboard(campaignId.value, { page: 1, pageSize: 100 }),
    ])
    list.value = dRes.data ?? []
    studentRows.value = rowsRes.data.records
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  list.value = []
  studentRows.value = []
  if (id != null) void loadData()
}

const studentOptions = computed(() =>
  studentRows.value.map((r) => ({
    label: `${r.studentNo} ${r.studentName}`,
    value: r.studentId,
  })),
)

// ===== 安排/修改弹窗（F-R-31：同一学生重复提交即更新 upsert）=====
const showForm = ref(false)
const editMode = ref(false)
const form = ref<{
  studentId: number | null
  groupName: string
  defenseTs: number | null
  location: string
  reviewerId: number | null
  reviewerLabel: string | undefined
  panelIds: Array<string | number>
  panelLabel: string | undefined
}>({
  studentId: null,
  groupName: '',
  defenseTs: null,
  location: '',
  reviewerId: null,
  reviewerLabel: undefined,
  panelIds: [],
  panelLabel: undefined,
})
const saving = ref(false)

function startArrange(): void {
  editMode.value = false
  form.value = {
    studentId: null,
    groupName: '',
    defenseTs: null,
    location: '',
    reviewerId: null,
    reviewerLabel: undefined,
    panelIds: [],
    panelLabel: undefined,
  }
  showForm.value = true
}

/** 修改安排：进入时回填已有数据（F-R-31） */
function startEdit(row: DefenseResponse): void {
  editMode.value = true
  form.value = {
    studentId: row.studentId,
    groupName: row.groupName ?? '',
    defenseTs: row.defenseTime ? new Date(row.defenseTime).getTime() : null,
    location: row.location ?? '',
    reviewerId: row.reviewerId,
    reviewerLabel: row.reviewerName ?? undefined,
    panelIds: row.defenseTeacherIds,
    panelLabel: undefined,
  }
  showForm.value = true
}

async function handleSave(): Promise<void> {
  if (campaignId.value == null) return
  if (form.value.studentId == null) {
    message.warning(t('graduation.dept.chooseStudent'))
    return
  }
  saving.value = true
  try {
    await arrangeDefense({
      campaignId: campaignId.value,
      studentId: form.value.studentId,
      groupName: form.value.groupName || undefined,
      defenseTime: form.value.defenseTs != null ? tsToIso(form.value.defenseTs) : undefined,
      location: form.value.location || undefined,
      reviewerId: form.value.reviewerId,
      defenseTeacherIds: form.value.panelIds.map(Number).filter((n) => n > 0),
    })
    message.success(t('graduation.dept.arrangeSaved'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
    // F-R-32：409 未查重通过等冲突后刷新
    await loadData()
  } finally {
    saving.value = false
  }
}

const columns = computed<DataTableColumns<DefenseResponse>>(() => [
  { title: t('graduation.common.studentNo'), key: 'studentNo', width: 120 },
  { title: t('graduation.common.student'), key: 'studentName', width: 100 },
  {
    title: t('graduation.student.defenseGroup'),
    key: 'groupName',
    minWidth: 110,
    render: (r) => r.groupName ?? '-',
  },
  {
    title: t('graduation.student.defenseTime'),
    key: 'defenseTime',
    width: 150,
    render: (r) => formatDateTime(r.defenseTime),
  },
  {
    title: t('graduation.dept.location'),
    key: 'location',
    minWidth: 120,
    render: (r) => r.location ?? '-',
  },
  {
    title: t('graduation.dept.reviewer'),
    key: 'reviewerName',
    width: 100,
    render: (r) => r.reviewerName ?? '-',
  },
  {
    title: t('graduation.dept.defenseTeacherGroup'),
    key: 'defenseTeacherNames',
    minWidth: 200,
    render: (r) =>
      h(NSpace, { size: 4, wrap: true }, () =>
        (r.defenseTeacherNames.length ? r.defenseTeacherNames : ['-']).map((n) =>
          h(NTag, { size: 'small', bordered: false }, () => n),
        ),
      ),
  },
  {
    title: t('graduation.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      h(NButton, { size: 'small', onClick: () => startEdit(row) }, () =>
        t('graduation.dept.modifyArrange'),
      ),
  },
])
</script>

<template>
  <div class="graduation-page">
    <NResult
      v-if="!isDepartment"
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

      <NCard :title="$t('graduation.dept.defenseList')" class="content-card">
        <template #header-extra>
          <NButton type="primary" @click="startArrange">
            {{ $t('graduation.dept.arrange') }}
          </NButton>
        </template>
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && !list.length"
            :description="$t('graduation.dept.defenseEmpty')"
          />
          <NDataTable
            v-else
            :columns="columns"
            :data="list"
            :row-key="(r: DefenseResponse) => r.id"
            :single-line="false"
            :bordered="false"
            :scroll-x="1080"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>

      <!-- 安排/修改弹窗 -->
      <NModal
        v-model:show="showForm"
        preset="card"
        :title="editMode ? $t('graduation.dept.modifyArrange') : $t('graduation.dept.arrange')"
        class="graduation-form-modal"
      >
        <NForm label-placement="top">
          <NFormItem :label="$t('graduation.common.student')" required>
            <NSelect
              v-model:value="form.studentId"
              :options="studentOptions"
              :disabled="editMode"
              :placeholder="$t('graduation.dept.chooseStudent')"
            />
          </NFormItem>
          <NSpace :size="12" wrap>
            <NFormItem :label="$t('graduation.dept.groupName')" style="width: 220px">
              <NInput v-model:value="form.groupName" />
            </NFormItem>
            <NFormItem :label="$t('graduation.dept.defenseTimeField')" style="width: 240px">
              <NDatePicker v-model:value="form.defenseTs" type="datetime" style="width: 100%" />
            </NFormItem>
            <NFormItem :label="$t('graduation.dept.location')" style="width: 220px">
              <NInput v-model:value="form.location" />
            </NFormItem>
          </NSpace>
          <NSpace :size="12" wrap>
            <NFormItem :label="$t('graduation.dept.reviewer')" style="width: 300px">
              <PagedSelect
                :model-value="form.reviewerId"
                :fetch-page="(page: number, pageSize: number) => fetchTeachers(page, pageSize)"
                :label-of="(tch: Teacher) => `${tch.name}（${tch.department || '-'}）`"
                :value-of="(tch: Teacher) => tch.userId"
                :initial-label="form.reviewerLabel"
                clearable
                filterable
                @update:model-value="
                  (v: string | number | null | Array<string | number>) =>
                    (form.reviewerId = v as number | null)
                "
              />
            </NFormItem>
            <NFormItem :label="$t('graduation.dept.defenseTeacherGroup')" style="width: 420px">
              <PagedSelect
                :model-value="form.panelIds"
                :fetch-page="(page: number, pageSize: number) => fetchTeachers(page, pageSize)"
                :label-of="(tch: Teacher) => tch.name"
                :value-of="(tch: Teacher) => tch.userId"
                :initial-label="form.panelLabel"
                multiple
                filterable
                @update:model-value="
                  (v: string | number | null | Array<string | number>) =>
                    (form.panelIds = (v as Array<string | number>) ?? [])
                "
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
    </template>
  </div>
</template>

<style scoped src="./DefenseArrangePage.css"></style>

<style>
.graduation-form-modal {
  width: 680px;
  max-width: 96vw;
}
</style>
