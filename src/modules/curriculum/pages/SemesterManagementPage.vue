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
  NDatePicker,
  NSelect,
  NPopconfirm,
  NSpin,
  NEmpty,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchAllSemesters, createSemester, updateSemester, deleteSemester } from '../api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import { useLocaleStore } from '@/stores/useLocaleStore'
import type { Semester, SemesterForm } from '../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()
const localeStore = useLocaleStore()
const dateLocale = computed(() => localeStore.naiveConfig().dateLocale)

const loading = ref(false)
const data = ref<Semester[]>([])

const statusOptions = computed(() => [
  { label: t('semester.CURRENT'), value: 'CURRENT' as const },
  { label: t('semester.HISTORICAL'), value: 'HISTORICAL' as const },
  { label: t('semester.FUTURE'), value: 'FUTURE' as const },
])

const statusTagType: Record<string, 'success' | 'default' | 'info'> = {
  CURRENT: 'success',
  HISTORICAL: 'default',
  FUTURE: 'info',
}

const columns: DataTableColumns<Semester> = [
  { title: t('semester.name'), key: 'name', width: 260, ellipsis: { tooltip: true } },
  {
    title: t('semester.startWeek'),
    key: 'startWeek',
    width: 70,
    align: 'center',
  },
  {
    title: t('semester.endWeek'),
    key: 'endWeek',
    width: 70,
    align: 'center',
  },
  {
    title: t('semester.startDate'),
    key: 'startDate',
    width: 110,
    align: 'center',
  },
  {
    title: t('semester.endDate'),
    key: 'endDate',
    width: 110,
    align: 'center',
  },
  {
    title: t('semester.status'),
    key: 'status',
    width: 100,
    align: 'center',
    render(row) {
      return h(NTag, { type: statusTagType[row.status] ?? 'default', bordered: false }, () =>
        t(`semester.${row.status}`),
      )
    },
  },
]

const actionColumns = computed<DataTableColumns<Semester>>(() => {
  if (!isAcademicAdmin.value) return []
  return [
    {
      title: t('semester.actions'),
      key: 'actions',
      width: 140,
      align: 'center',
      render(row) {
        return h(NSpace, null, () => [
          h(NButton, { size: 'small', onClick: () => startEdit(row) }, () => t('semester.edit')),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row.id) },
            {
              default: () => t('semester.deleteConfirm'),
              trigger: () =>
                h(NButton, { size: 'small', type: 'error' }, () => t('semester.delete')),
            },
          ),
        ])
      },
    },
  ]
})

const allColumns = computed(() => [...columns, ...actionColumns.value])

async function loadData() {
  loading.value = true
  try {
    const res = await fetchAllSemesters()
    data.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('semester.loadFail'))
  } finally {
    loading.value = false
  }
}

const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)

const emptyForm = (): SemesterForm => ({
  name: '',
  startWeek: undefined,
  endWeek: undefined,
  startDate: undefined,
  endDate: undefined,
  status: 'FUTURE',
})
const form = ref<SemesterForm>(emptyForm())
const originalForm = ref<SemesterForm>(emptyForm())

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  originalForm.value = emptyForm()
  showForm.value = true
}

function startEdit(row: Semester) {
  formMode.value = 'edit'
  editingId.value = row.id
  originalForm.value = {
    name: row.name,
    startWeek: row.startWeek,
    endWeek: row.endWeek,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
  }
  form.value = {
    name: '',
    startWeek: undefined,
    endWeek: undefined,
    startDate: undefined,
    endDate: undefined,
    status: row.status,
  }
  showForm.value = true
}

async function handleSave() {
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createSemester(form.value)
    } else {
      const payload: SemesterForm = {
        name: form.value.name || originalForm.value.name,
        startWeek:
          form.value.startWeek !== undefined
            ? form.value.startWeek
            : originalForm.value.startWeek,
        endWeek:
          form.value.endWeek !== undefined ? form.value.endWeek : originalForm.value.endWeek,
        startDate: form.value.startDate ?? originalForm.value.startDate,
        endDate: form.value.endDate ?? originalForm.value.endDate,
        status: form.value.status,
      }
      await updateSemester(editingId.value!, payload)
    }
    message.success(t('semester.saveSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('semester.saveFail'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deleteSemester(id)
    message.success(t('semester.deleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('semester.deleteFail'))
  }
}

function handleReset() {
  form.value = {
    name: '',
    startWeek: undefined,
    endWeek: undefined,
    startDate: undefined,
    endDate: undefined,
    status: originalForm.value.status,
  }
}

onMounted(loadData)
</script>

<template>
  <div class="semester-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('semester.title')">
        <template v-if="isAcademicAdmin" #header-extra>
          <NButton type="primary" @click="startCreate">{{ $t('semester.add') }}</NButton>
        </template>
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && data.length === 0"
            :description="$t('semester.empty')"
          />
          <NDataTable
            v-else
            :columns="allColumns"
            :data="data"
            :row-key="(r: Semester) => r.id"
            :single-line="false"
            :bordered="false"
          />
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showForm"
      preset="card"
      :title="formMode === 'create' ? $t('semester.addTitle') : $t('semester.editTitle')"
      class="semester-form-modal"
    >
      <NForm :model="form">
        <NFormItem :label="$t('semester.name')">
          <NInput
            v-model:value="form.name"
            :placeholder="formMode === 'edit' ? originalForm.name : $t('semester.namePlaceholder')"
          />
        </NFormItem>
        <NFormItem :label="$t('semester.startWeek')">
          <NInput
            :value="form.startWeek !== undefined ? String(form.startWeek) : ''"
            :placeholder="
              formMode === 'edit'
                ? String(originalForm.startWeek ?? '')
                : $t('semester.startWeekPlaceholder')
            "
            @update:value="(v: string) => (form.startWeek = v ? parseInt(v, 10) : undefined)"
          />
        </NFormItem>
        <NFormItem :label="$t('semester.endWeek')">
          <NInput
            :value="form.endWeek !== undefined ? String(form.endWeek) : ''"
            :placeholder="
              formMode === 'edit'
                ? String(originalForm.endWeek ?? '')
                : $t('semester.endWeekPlaceholder')
            "
            @update:value="(v: string) => (form.endWeek = v ? parseInt(v, 10) : undefined)"
          />
        </NFormItem>
        <NFormItem :label="$t('semester.startDate')">
          <NDatePicker
            v-model:formatted-value="form.startDate"
            type="date"
            value-format="yyyy-MM-dd"
            :locale="dateLocale"
            :placeholder="
              formMode === 'edit' ? originalForm.startDate : $t('semester.startDatePlaceholder')
            "
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem :label="$t('semester.endDate')">
          <NDatePicker
            v-model:formatted-value="form.endDate"
            type="date"
            value-format="yyyy-MM-dd"
            :locale="dateLocale"
            :placeholder="
              formMode === 'edit' ? originalForm.endDate : $t('semester.endDatePlaceholder')
            "
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem :label="$t('semester.status')">
          <NSelect v-model:value="form.status" :options="statusOptions" />
        </NFormItem>
        <div class="semester-form-hint">{{ $t('semester.hint') }}</div>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">{{ $t('semester.cancel') }}</NButton>
          <NButton v-if="formMode === 'edit'" quaternary type="info" @click="handleReset">
            {{ $t('semester.reset') }}
          </NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            {{ $t('semester.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./SemesterManagementPage.css"></style>

<style>
.semester-form-modal {
  width: 480px;
  max-width: 85vw;
}
</style>
