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
  NPopconfirm,
  NSpin,
  NEmpty,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchGrades, createGrade, updateGrade, deleteGrade } from '../api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { Grade, GradeForm } from '../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const loading = ref(false)
const data = ref<Grade[]>([])

function formatDateTime(s: string | null | undefined): string {
  return s ? s.replace('T', ' ') : '-'
}

const gradeRowKey = (row: Grade) => row.id

const baseColumns: DataTableColumns<Grade> = [
  { title: t('grades.name'), key: 'name', width: 140 },
  {
    title: t('grades.description'),
    key: 'description',
    ellipsis: { tooltip: true },
    render: (row) => row.description || '-',
  },
  {
    title: t('grades.createTime'),
    key: 'createTime',
    width: 160,
    render: (row) => formatDateTime(row.createTime),
  },
  {
    title: t('grades.updateTime'),
    key: 'updateTime',
    width: 160,
    render: (row) => formatDateTime(row.updateTime),
  },
]

const columns = computed<DataTableColumns<Grade>>(() => {
  if (!isAcademicAdmin.value) return baseColumns
  return [
    ...baseColumns,
    {
      title: t('grades.actions'),
      key: 'actions',
      width: 140,
      render(row) {
        return h(NSpace, null, () => [
          h(NButton, { size: 'small', onClick: () => startEdit(row) }, () => t('grades.edit')),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row.id) },
            {
              default: () => t('grades.deleteConfirm'),
              trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('grades.delete')),
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
    const res = await fetchGrades()
    data.value = res.data.sort((a, b) =>
      a.name.localeCompare(b.name, 'zh-CN', { numeric: true }),
    )
  } catch (e) {
    message.error((e as Error).message || t('grades.loadFail'))
  } finally {
    loading.value = false
  }
}

const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)

const emptyForm = (): GradeForm => ({ name: '', description: '' })
const form = ref<GradeForm>(emptyForm())

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(row: Grade) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = { name: row.name, description: row.description ?? '' }
  showForm.value = true
}

async function handleSave() {
  if (!form.value.name) {
    message.warning(t('grades.nameRequired'))
    return
  }
  saving.value = true
  try {
    const payload: GradeForm = {
      name: form.value.name,
      description: form.value.description || undefined,
    }
    if (formMode.value === 'create') {
      await createGrade(payload)
    } else {
      await updateGrade(editingId.value!, payload)
    }
    message.success(t('grades.saveSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('grades.saveFail'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deleteGrade(id)
    message.success(t('grades.deleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('grades.deleteFail'))
  }
}

onMounted(loadData)
</script>

<template>
  <div class="grade-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('grades.title')">
        <template v-if="isAcademicAdmin" #header-extra>
          <NButton type="primary" @click="startCreate">{{ $t('grades.add') }}</NButton>
        </template>
        <NSpin :show="loading">
          <NEmpty v-if="!loading && data.length === 0" :description="$t('grades.empty')" />
          <NDataTable
            v-else
            :columns="columns"
            :data="data"
            :row-key="gradeRowKey"
            :single-line="false"
            :bordered="false"
          />
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showForm"
      preset="card"
      :title="formMode === 'create' ? $t('grades.addTitle') : $t('grades.editTitle')"
      class="grade-form-modal"
    >
      <NForm :model="form">
        <NFormItem :label="$t('grades.name')" required>
          <NInput v-model:value="form.name" :placeholder="$t('grades.namePlaceholder')" />
        </NFormItem>
        <NFormItem :label="$t('grades.description')">
          <NInput
            v-model:value="form.description"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :placeholder="$t('grades.descriptionPlaceholder')"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">{{ $t('grades.cancel') }}</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            {{ $t('grades.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./GradeManagementPage.css"></style>

<style>
.grade-form-modal {
  width: 420px;
  max-width: 85vw;
}
</style>
