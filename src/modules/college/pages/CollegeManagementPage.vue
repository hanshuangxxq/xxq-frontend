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
import { fetchColleges, createCollege, updateCollege, deleteCollege } from '../api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { College, CollegeCreateRequest } from '../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

/** ISO 时间 -> 展示 yyyy-MM-dd HH:mm */
function formatDateTime(s: string | null | undefined): string {
  if (!s) return '-'
  return s.slice(0, 16).replace('T', ' ')
}

const loading = ref(false)
const data = ref<College[]>([])

const baseColumns = computed<DataTableColumns<College>>(() => [
  {
    title: t('college.collegeName'),
    key: 'collegeName',
    minWidth: 180,
    ellipsis: { tooltip: true },
  },
  {
    title: t('college.collegeCode'),
    key: 'collegeCode',
    width: 140,
    render: (r) => r.collegeCode || '-',
  },
  {
    title: t('college.collegeNo'),
    key: 'collegeNo',
    width: 140,
    render: (r) => r.collegeNo || '-',
  },
  {
    title: t('college.createTime'),
    key: 'createTime',
    width: 160,
    render: (r) => formatDateTime(r.createTime),
  },
])

const columns = computed<DataTableColumns<College>>(() => {
  if (!isAcademicAdmin.value) return baseColumns.value
  return [
    ...baseColumns.value,
    {
      title: t('college.actions'),
      key: 'actions',
      width: 140,
      render(row) {
        return h(NSpace, null, () => [
          h(NButton, { size: 'small', onClick: () => startEdit(row) }, () => t('college.edit')),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row.id) },
            {
              default: () => t('college.deleteConfirm'),
              trigger: () =>
                h(NButton, { size: 'small', type: 'error' }, () => t('college.delete')),
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
    const res = await fetchColleges()
    data.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('college.loadFail'))
  } finally {
    loading.value = false
  }
}

const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)

interface CollegeForm {
  collegeName: string
  collegeCode: string
  collegeNo: string
}
const emptyForm = (): CollegeForm => ({ collegeName: '', collegeCode: '', collegeNo: '' })
const form = ref<CollegeForm>(emptyForm())

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(row: College) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = {
    collegeName: row.collegeName,
    collegeCode: row.collegeCode ?? '',
    collegeNo: row.collegeNo ?? '',
  }
  showForm.value = true
}

async function handleSave() {
  const f = form.value
  if (!f.collegeName.trim()) return message.warning(t('college.nameRequired'))
  const body: CollegeCreateRequest = {
    collegeName: f.collegeName.trim(),
    collegeCode: f.collegeCode.trim() || undefined,
    collegeNo: f.collegeNo.trim() || undefined,
  }
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createCollege(body)
    } else {
      await updateCollege(editingId.value!, body)
    }
    message.success(t('college.saveSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('college.saveFail'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deleteCollege(id)
    message.success(t('college.deleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('college.deleteFail'))
  }
}

onMounted(loadData)
</script>

<template>
  <div class="college-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('college.title')">
        <template v-if="isAcademicAdmin" #header-extra>
          <NButton type="primary" @click="startCreate">{{ $t('college.add') }}</NButton>
        </template>
        <NSpin :show="loading">
          <NEmpty v-if="!loading && data.length === 0" :description="$t('college.empty')" />
          <NDataTable
            v-else
            :columns="columns"
            :data="data"
            :row-key="(r: College) => r.id"
            :single-line="false"
            :bordered="false"
          />
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showForm"
      preset="card"
      :title="formMode === 'create' ? $t('college.addTitle') : $t('college.editTitle')"
      class="college-form-modal"
    >
      <NForm :model="form" label-placement="top">
        <NFormItem :label="$t('college.collegeName')" required>
          <NInput v-model:value="form.collegeName" />
        </NFormItem>
        <NFormItem :label="$t('college.collegeCode')">
          <NInput v-model:value="form.collegeCode" />
        </NFormItem>
        <NFormItem :label="$t('college.collegeNo')">
          <NInput v-model:value="form.collegeNo" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">{{ $t('college.cancel') }}</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            {{ $t('college.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./CollegeManagementPage.css"></style>

<style>
.college-form-modal {
  width: 420px;
  max-width: 85vw;
}
</style>
