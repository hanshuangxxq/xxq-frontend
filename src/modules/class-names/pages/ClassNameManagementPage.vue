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
import { fetchClassNames, createClassName, updateClassName, deleteClassName } from '../api'
import { fetchColleges } from '@/modules/college/api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import type { College } from '@/modules/college/types'
import type { ClassName, ClassNameForm } from '../types'

const { t } = useI18n()
const message = useMessage()
const { canManageClassNames } = useRoleCheck()

const loading = ref(false)
const data = ref<ClassName[]>([])
const { pagination } = useRemotePagination(loadData)

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

const classNameRowKey = (row: ClassName) => row.id

const baseColumns = computed<DataTableColumns<ClassName>>(() => [
  { title: t('class-names.className'), key: 'className', width: 180, ellipsis: { tooltip: true } },
  {
    title: t('class-names.college'),
    key: 'collegeId',
    width: 180,
    ellipsis: { tooltip: true },
    render: (r) => collegeNameOf(r.collegeId),
  },
])

const columns = computed<DataTableColumns<ClassName>>(() => {
  if (!canManageClassNames.value) return baseColumns.value
  return [
    ...baseColumns.value,
    {
      title: t('class-names.actions'),
      key: 'actions',
      width: 140,
      render(row) {
        return h(NSpace, null, () => [
          h(NButton, { size: 'small', onClick: () => startEdit(row) }, () => t('class-names.edit')),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row.id) },
            {
              default: () => t('class-names.deleteConfirm'),
              trigger: () =>
                h(NButton, { size: 'small', type: 'error' }, () => t('class-names.delete')),
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
    const res = await fetchClassNames(pagination.page, pagination.pageSize)
    data.value = res.data.records
    pagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('class-names.loadFail'))
  } finally {
    loading.value = false
  }
}

const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)

const emptyForm = (): ClassNameForm => ({ className: '', collegeId: null })
const form = ref<ClassNameForm>(emptyForm())

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(row: ClassName) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = { className: row.className, collegeId: row.collegeId }
  showForm.value = true
}

async function handleSave() {
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createClassName(form.value)
    } else {
      await updateClassName(editingId.value!, form.value)
    }
    message.success(t('class-names.saveSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('class-names.saveFail'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deleteClassName(id)
    message.success(t('class-names.deleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('class-names.deleteFail'))
  }
}

onMounted(() => {
  loadData()
  loadColleges()
})
</script>

<template>
  <div class="cn-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('class-names.title')">
        <template v-if="canManageClassNames" #header-extra>
          <NButton type="primary" @click="startCreate">{{ $t('class-names.add') }}</NButton>
        </template>
        <NSpin :show="loading">
          <NDataTable
            :columns="columns"
            :data="data"
            :row-key="classNameRowKey"
            :single-line="false"
            :bordered="false"
            remote
            :pagination="pagination"
          >
            <template #empty>{{ $t('class-names.empty') }}</template>
          </NDataTable>
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showForm"
      preset="card"
      :title="formMode === 'create' ? $t('class-names.createTitle') : $t('class-names.editTitle')"
      class="cn-form-modal"
    >
      <NForm :model="form">
        <NFormItem :label="$t('class-names.className')">
          <NInput v-model:value="form.className" />
        </NFormItem>
        <NFormItem :label="$t('class-names.college')">
          <NSelect
            v-model:value="form.collegeId"
            :options="collegeOptions"
            clearable
            :placeholder="$t('class-names.college')"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">{{ $t('class-names.cancel') }}</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            {{ $t('class-names.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.cn-page {
  padding: 24px;
}
</style>

<style>
.cn-form-modal {
  width: 420px;
  max-width: 85vw;
}
</style>
