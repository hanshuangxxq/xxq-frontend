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
  NPopconfirm,
  NSpin,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchLocals, createLocal, updateLocal, deleteLocal } from '../api'
import { fetchTeachers } from '@/modules/curriculum/api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import {
  LOCAL_TYPE_TO_CODE,
  LOCAL_TYPE_REQUIRES_MANAGER,
  type Local,
  type LocalForm,
  type LocalTypeCode,
} from '../types'
import type { Teacher } from '@/modules/curriculum/types'

const { t } = useI18n()
const message = useMessage()
const { canManageLocals } = useRoleCheck()

const loading = ref(false)
const data = ref<Local[]>([])
const { pagination, reset } = useRemotePagination(loadData)

/** 类型下拉选项（value 为 code，请求/筛选时传 name） */
const typeOptions = computed(() => [
  { label: t('locals.typeClassroom'), value: 'CLASSROOM' as LocalTypeCode },
  { label: t('locals.typeLaboratory'), value: 'LABORATORY' as LocalTypeCode },
  { label: t('locals.typeComputerRoom'), value: 'COMPUTER_ROOM' as LocalTypeCode },
  { label: t('locals.typeLectureHall'), value: 'LECTURE_HALL' as LocalTypeCode },
])

/** 列表类型筛选（null = 全部） */
const filterType = ref<LocalTypeCode | null>(null)

/** 管理者下拉编辑回显用（选中教师不在已加载页时兜底显示） */
const managerInitialLabel = ref<string | undefined>(undefined)

const baseColumns: DataTableColumns<Local> = [
  { title: t('locals.building'), key: 'building', width: 200, ellipsis: { tooltip: true } },
  { title: t('locals.classroom'), key: 'classRoom', width: 120 },
  { title: t('locals.max'), key: 'max', width: 80 },
  { title: t('locals.type'), key: 'type', width: 100 },
  { title: t('locals.manager'), key: 'managerName', width: 100 },
]

const columns = computed<DataTableColumns<Local>>(() => {
  if (!canManageLocals.value) return baseColumns
  return [
    ...baseColumns,
    {
      title: t('locals.actions'),
      key: 'actions',
      width: 140,
      render(row) {
        return h(NSpace, null, () => [
          h(NButton, { size: 'small', onClick: () => startEdit(row) }, () => t('locals.edit')),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row.id) },
            {
              default: () => t('locals.deleteConfirm'),
              trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('locals.delete')),
            },
          ),
        ])
      },
    },
  ]
})

async function loadData() {
  loading.value = true
  try {
    const res = await fetchLocals({
      type: filterType.value ?? undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    data.value = res.data.records
    pagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('locals.loadFail'))
  } finally {
    loading.value = false
  }
}

function handleTypeChange() {
  reset()
  loadData()
}

const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)

const emptyForm = (): LocalForm => ({
  building: '',
  classRoom: '',
  max: null,
  type: 'CLASSROOM',
  managerId: null,
})
const form = ref<LocalForm>(emptyForm())

/** 实验室/机房必须指定管理者 */
const managerRequired = computed(() => LOCAL_TYPE_REQUIRES_MANAGER.has(form.value.type))

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  managerInitialLabel.value = undefined
  showForm.value = true
}

function startEdit(row: Local) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = {
    building: row.building,
    classRoom: row.classRoom,
    max: row.max,
    // 响应 type 为中文描述，转回 code 供下拉选择；未知/缺失降级为普通教室
    type: row.type ? (LOCAL_TYPE_TO_CODE[row.type] ?? 'CLASSROOM') : 'CLASSROOM',
    managerId: row.managerId,
  }
  managerInitialLabel.value = row.managerName ?? undefined
  showForm.value = true
}

async function handleSave() {
  if (managerRequired.value && form.value.managerId == null) {
    return message.warning(t('locals.managerRequired'))
  }
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createLocal(form.value)
    } else {
      await updateLocal(editingId.value!, form.value)
    }
    message.success(t('locals.saveSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('locals.saveFail'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deleteLocal(id)
    message.success(t('locals.deleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('locals.deleteFail'))
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="lm-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('locals.title')">
        <template #header-extra>
          <NSpace align="center">
            <NSelect
              v-model:value="filterType"
              :options="typeOptions"
              :placeholder="$t('locals.allTypes')"
              clearable
              class="lm-filter-select"
              @update:value="handleTypeChange"
            />
            <NButton v-if="canManageLocals" type="primary" @click="startCreate">
              {{ $t('locals.add') }}
            </NButton>
          </NSpace>
        </template>
        <NSpin :show="loading">
          <NDataTable
            :columns="columns"
            :data="data"
            :row-key="(r: Local) => r.id"
            :single-line="false"
            :bordered="false"
            remote
            :pagination="pagination"
          >
            <template #empty>{{ $t('locals.empty') }}</template>
          </NDataTable>
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showForm"
      preset="card"
      :title="formMode === 'create' ? $t('locals.createTitle') : $t('locals.editTitle')"
      class="lm-form-modal"
    >
      <NForm :model="form">
        <NFormItem :label="$t('locals.building')">
          <NInput v-model:value="form.building" />
        </NFormItem>
        <NFormItem :label="$t('locals.classroom')">
          <NInput v-model:value="form.classRoom" />
        </NFormItem>
        <NFormItem :label="$t('locals.max')">
          <NInput
            :value="form.max !== null ? String(form.max) : ''"
            @update:value="(v: string) => (form.max = v ? parseInt(v, 10) : null)"
          />
        </NFormItem>
        <NFormItem :label="$t('locals.type')">
          <NSelect v-model:value="form.type" :options="typeOptions" />
        </NFormItem>
        <NFormItem :label="$t('locals.manager')" :required="managerRequired">
          <PagedSelect
            :model-value="form.managerId"
            :fetch-page="(page: number, pageSize: number) => fetchTeachers(page, pageSize)"
            :label-of="(tch: Teacher) => `${tch.name} (${tch.title})`"
            :value-of="(tch: Teacher) => tch.id"
            :initial-label="managerInitialLabel"
            :placeholder="$t('locals.managerPlaceholder')"
            clearable
            @update:model-value="
              (v: string | number | null | Array<string | number>) =>
                (form.managerId = v as number | null)
            "
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">{{ $t('locals.cancel') }}</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            {{ $t('locals.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.lm-page {
  padding: 24px;
}
.lm-filter-select {
  width: 160px;
}
</style>

<style>
.lm-form-modal {
  width: 420px;
  max-width: 85vw;
}
</style>
