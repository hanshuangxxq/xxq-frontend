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
  NInputNumber,
  NSwitch,
  NPopconfirm,
  NSpin,
  NEmpty,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  fetchEvaluationItems,
  createEvaluationItem,
  updateEvaluationItem,
  deleteEvaluationItem,
} from '../api'
import type { EvaluationItemDto } from '../types'
import { formatDateTime } from '../utils'

const { t } = useI18n()
const message = useMessage()

const loading = ref(false)
const data = ref<EvaluationItemDto[]>([])

async function loadData() {
  loading.value = true
  try {
    const res = await fetchEvaluationItems()
    data.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('analysis.evLoadFail'))
    data.value = []
  } finally {
    loading.value = false
  }
}

const columns = computed<DataTableColumns<EvaluationItemDto>>(() => [
  { title: t('analysis.evItemName'), key: 'name', minWidth: 140, ellipsis: { tooltip: true } },
  {
    title: t('analysis.evItemDesc'),
    key: 'description',
    minWidth: 200,
    ellipsis: { tooltip: true },
    render: (r) => r.description || '-',
  },
  { title: t('analysis.evItemMaxScore'), key: 'maxScore', width: 90, align: 'center' },
  { title: t('analysis.evItemUsedCount'), key: 'usedCount', width: 90, align: 'center' },
  {
    title: t('analysis.evItemCreateTime'),
    key: 'createTime',
    width: 160,
    align: 'center',
    render: (r) => formatDateTime(r.createTime),
  },
  {
    title: t('analysis.evTemplateDelete'),
    key: 'actions',
    width: 150,
    align: 'center',
    render(row) {
      return h(NSpace, { justify: 'center' }, () => [
        h(NButton, { size: 'small', onClick: () => startEdit(row) }, () =>
          t('analysis.evItemEdit'),
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row.id) },
          {
            default: () => t('analysis.evItemDeleteConfirm'),
            trigger: () =>
              h(NButton, { size: 'small', type: 'error' }, () => t('analysis.evItemDelete')),
          },
        ),
      ])
    },
  },
])

// ---- 表单 ----
const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)

interface ItemForm {
  name: string
  description: string
  maxScore: number
  updateTemplates: boolean
}

const emptyForm = (): ItemForm => ({
  name: '',
  description: '',
  maxScore: 5,
  updateTemplates: false,
})
const form = ref<ItemForm>(emptyForm())

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(row: EvaluationItemDto) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = {
    name: row.name,
    description: row.description ?? '',
    maxScore: row.maxScore,
    updateTemplates: false,
  }
  showForm.value = true
}

async function handleSave() {
  const name = form.value.name.trim()
  if (!name) {
    message.warning(t('analysis.evItemNameRequired'))
    return
  }
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createEvaluationItem({
        name,
        description: form.value.description.trim() || undefined,
        maxScore: form.value.maxScore,
      })
    } else {
      await updateEvaluationItem(editingId.value!, {
        name,
        description: form.value.description.trim() || undefined,
        maxScore: form.value.maxScore,
        updateTemplates: form.value.updateTemplates,
      })
    }
    message.success(t('analysis.evSubmitSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('analysis.evItemSaveFail'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deleteEvaluationItem(id)
    message.success(t('analysis.evItemDeleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('analysis.evItemDeleteFail'))
  }
}

onMounted(loadData)
</script>

<template>
  <NCard :title="$t('analysis.evItems')">
    <template #header-extra>
      <NButton type="primary" @click="startCreate">{{ $t('analysis.evItemAdd') }}</NButton>
    </template>
    <NSpin :show="loading">
      <NEmpty v-if="!loading && data.length === 0" :description="$t('analysis.evItemEmpty')" />
      <NDataTable
        v-else
        :columns="columns"
        :data="data"
        :row-key="(r: EvaluationItemDto) => r.id"
        :single-line="false"
        :bordered="false"
        :scroll-x="900"
      />
    </NSpin>
  </NCard>

  <NModal
    v-model:show="showForm"
    preset="card"
    :title="formMode === 'create' ? $t('analysis.evItemAddTitle') : $t('analysis.evItemEditTitle')"
    class="eval-item-form-modal"
  >
    <NForm :model="form" label-placement="top">
      <NFormItem :label="$t('analysis.evItemName')" required>
        <NInput v-model:value="form.name" :placeholder="$t('analysis.evItemName')" />
      </NFormItem>
      <NFormItem :label="$t('analysis.evItemDesc')">
        <NInput
          v-model:value="form.description"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="$t('analysis.evItemDesc')"
        />
      </NFormItem>
      <NFormItem :label="$t('analysis.evItemMaxScore')">
        <NInputNumber v-model:value="form.maxScore" :min="1" :max="100" style="width: 160px" />
      </NFormItem>
      <NFormItem v-if="formMode === 'edit'" :label="$t('analysis.evUpdateTemplates')">
        <NSpace vertical :size="4">
          <NSwitch v-model:value="form.updateTemplates" />
          <span class="form-hint">{{ $t('analysis.evUpdateTemplatesHint') }}</span>
        </NSpace>
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="showForm = false">{{ $t('analysis.evCancel') }}</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">
          {{ $t('analysis.evSave') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped src="./EvaluationItemsManager.css"></style>

<style>
.eval-item-form-modal {
  width: 520px;
  max-width: 92vw;
}
</style>
