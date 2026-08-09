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
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchClassNames, createClassName, updateClassName, deleteClassName } from '../api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import type { ClassName, ClassNameForm } from '../types'

const { t } = useI18n()
const message = useMessage()
const { canManageClassNames } = useRoleCheck()

const loading = ref(false)
const data = ref<ClassName[]>([])
const { pagination } = useRemotePagination(loadData)

const baseColumns: DataTableColumns<ClassName> = [
  { title: t('class-names.className'), key: 'className', width: 180, ellipsis: { tooltip: true } },
  { title: t('class-names.college'), key: 'college', width: 180, ellipsis: { tooltip: true } },
]

const columns = computed<DataTableColumns<ClassName>>(() => {
  if (!canManageClassNames.value) return baseColumns
  return [
    ...baseColumns,
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

const emptyForm = (): ClassNameForm => ({ className: '', college: '' })
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
  form.value = { className: row.className, college: row.college }
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

onMounted(loadData)
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
            :row-key="(r: ClassName) => r.id"
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
          <NInput v-model:value="form.college" />
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
