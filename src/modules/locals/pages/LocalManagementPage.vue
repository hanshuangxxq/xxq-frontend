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
import { fetchLocals, createLocal, updateLocal, deleteLocal } from '../api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { Local, LocalForm } from '../types'

const { t } = useI18n()
const message = useMessage()
const { canManageLocals } = useRoleCheck()

const loading = ref(false)
const data = ref<Local[]>([])

const baseColumns: DataTableColumns<Local> = [
  { title: t('locals.building'), key: 'building', width: 200, ellipsis: { tooltip: true } },
  { title: t('locals.classroom'), key: 'classRoom', width: 120 },
  { title: t('locals.max'), key: 'max', width: 80 },
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
          h(NPopconfirm, { onPositiveClick: () => handleDelete(row.id) }, {
            default: () => t('locals.deleteConfirm'),
            trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('locals.delete')),
          }),
        ])
      },
    },
  ]
})

async function loadData() {
  loading.value = true
  try {
    const res = await fetchLocals()
    data.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('locals.loadFail'))
  } finally {
    loading.value = false
  }
}

const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)

const emptyForm = (): LocalForm => ({ building: '', classRoom: '', max: null })
const form = ref<LocalForm>(emptyForm())

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(row: Local) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = { building: row.building, classRoom: row.classRoom, max: row.max }
  showForm.value = true
}

async function handleSave() {
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

onMounted(loadData)
</script>

<template>
  <div class="lm-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('locals.title')">
        <template v-if="canManageLocals" #header-extra>
          <NButton type="primary" @click="startCreate">{{ $t('locals.add') }}</NButton>
        </template>
        <NSpin :show="loading">
          <NEmpty v-if="!loading && data.length === 0" :description="$t('locals.empty')" />
          <NDataTable
            v-else
            :columns="columns"
            :data="data"
            :row-key="(r: Local) => r.id"
            :single-line="false"
            :bordered="false"
          />
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
</style>

<style>
.lm-form-modal {
  width: 420px;
  max-width: 85vw;
}
</style>
