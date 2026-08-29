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
  NEmpty,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchMajors, createMajor, updateMajor, deleteMajor } from '../api'
import { fetchColleges } from '@/modules/college/api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { College } from '@/modules/college/types'
import type { Major, MajorForm } from '../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const loading = ref(false)
const data = ref<Major[]>([])

const colleges = ref<College[]>([])

const collegeOptions = computed(() =>
  colleges.value.map((c) => ({ label: c.collegeName, value: c.id })),
)

function collegeNameOf(id: number | null): string {
  if (id == null) return '-'
  return colleges.value.find((c) => c.id === id)?.collegeName ?? '-'
}

async function loadColleges() {
  try {
    const res = await fetchColleges()
    colleges.value = res.data
  } catch {
    colleges.value = []
  }
}

const majorRowKey = (row: Major) => row.id

const baseColumns = computed<DataTableColumns<Major>>(() => [
  { title: t('majors.majorName'), key: 'majorName', width: 300, ellipsis: { tooltip: true } },
  {
    title: t('majors.college'),
    key: 'collegeId',
    width: 200,
    ellipsis: { tooltip: true },
    render: (r) => collegeNameOf(r.collegeId),
  },
])

const columns = computed<DataTableColumns<Major>>(() => {
  if (!isAcademicAdmin.value) return baseColumns.value
  return [
    ...baseColumns.value,
    {
      title: t('majors.actions'),
      key: 'actions',
      width: 140,
      render(row) {
        return h(NSpace, null, () => [
          h(NButton, { size: 'small', onClick: () => startEdit(row) }, () => t('majors.edit')),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row.id) },
            {
              default: () => t('majors.deleteConfirm'),
              trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('majors.delete')),
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
    const res = await fetchMajors()
    data.value = res.data.sort((a, b) =>
      a.majorName.localeCompare(b.majorName, 'zh-CN', { numeric: true }),
    )
  } catch (e) {
    message.error((e as Error).message || t('majors.loadFail'))
  } finally {
    loading.value = false
  }
}

const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)

const emptyForm = (): MajorForm => ({ majorName: '', collegeId: null })
const form = ref<MajorForm>(emptyForm())

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(row: Major) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = { majorName: row.majorName, collegeId: row.collegeId }
  showForm.value = true
}

async function handleSave() {
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createMajor(form.value)
    } else {
      await updateMajor(editingId.value!, form.value)
    }
    message.success(t('majors.saveSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('majors.saveFail'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deleteMajor(id)
    message.success(t('majors.deleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('majors.deleteFail'))
  }
}

onMounted(() => {
  loadData()
  loadColleges()
})
</script>

<template>
  <div class="major-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('majors.title')">
        <template v-if="isAcademicAdmin" #header-extra>
          <NButton type="primary" @click="startCreate">{{ $t('majors.add') }}</NButton>
        </template>
        <NSpin :show="loading">
          <NEmpty v-if="!loading && data.length === 0" :description="$t('majors.empty')" />
          <NDataTable
            v-else
            :columns="columns"
            :data="data"
            :row-key="majorRowKey"
            :single-line="false"
            :bordered="false"
          />
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showForm"
      preset="card"
      :title="formMode === 'create' ? $t('majors.addTitle') : $t('majors.editTitle')"
      class="major-form-modal"
    >
      <NForm :model="form">
        <NFormItem :label="$t('majors.majorName')">
          <NInput v-model:value="form.majorName" />
        </NFormItem>
        <NFormItem :label="$t('majors.college')">
          <NSelect
            v-model:value="form.collegeId"
            :options="collegeOptions"
            clearable
            :placeholder="$t('majors.college')"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">{{ $t('majors.cancel') }}</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            {{ $t('majors.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./MajorManagementPage.css"></style>

<style>
.major-form-modal {
  width: 420px;
  max-width: 85vw;
}
</style>
