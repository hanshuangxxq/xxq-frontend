<script setup lang="ts">
/** 评教指标库管理页（教务）：维护评教指标的名称/描述/满分，列表展示被模板引用数 */
import { ref, computed, h } from 'vue'
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
  NPopconfirm,
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
import { useLoading } from '@/shared/composables/useLoading'
import { isReportedError } from '@/shared/api'

const { t } = useI18n()
const message = useMessage()

const { loading, withLoading } = useLoading()
const data = ref<EvaluationItemDto[]>([])

function loadData() {
  return withLoading(async () => {
    try {
      const res = await fetchEvaluationItems()
      data.value = res.data
    } catch (e) {
      if (!isReportedError(e)) message.error((e as Error).message || t('analysis.evLoadFail'))
      data.value = []
    }
  })
}

const evaluationItemRowKey = (row: EvaluationItemDto) => row.id

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
const { loading: saving, withLoading: withSaving } = useLoading()

interface ItemForm {
  name: string
  description: string
  maxScore: number
}

const emptyForm = (): ItemForm => ({
  name: '',
  description: '',
  maxScore: 5,
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
  }
  showForm.value = true
}

/** 保存指标：description 为空串时传 undefined，更新场景下该字段不落库即保持原值 */
function handleSave() {
  const name = form.value.name.trim()
  if (!name) {
    message.warning(t('analysis.evItemNameRequired'))
    return
  }
  return withSaving(async () => {
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
        })
      }
      message.success(t('analysis.evSubmitSuccess'))
      showForm.value = false
      await loadData()
    } catch (e) {
      if (!isReportedError(e)) message.error((e as Error).message || t('analysis.evItemSaveFail'))
    }
  })
}

async function handleDelete(id: number) {
  try {
    await deleteEvaluationItem(id)
    message.success(t('analysis.evItemDeleteSuccess'))
    await loadData()
  } catch (e) {
    if (!isReportedError(e)) message.error((e as Error).message || t('analysis.evItemDeleteFail'))
  }
}

// 首屏加载在 setup 内同步发起(而非等 onMounted):保证首帧渲染时 loading 已为 true,
// 空状态不会在「首帧闪现 → 加载开始消失 → 加载结束复现」之间抖动造成闪屏
void loadData()
</script>

<template>
  <NCard :title="$t('analysis.evItems')">
    <template #header-extra>
      <NButton type="primary" @click="startCreate">{{ $t('analysis.evItemAdd') }}</NButton>
    </template>
    <NEmpty v-if="!loading && data.length === 0" :description="$t('analysis.evItemEmpty')" />
    <NDataTable
      v-else
      :columns="columns"
      :data="data"
      :row-key="evaluationItemRowKey"
      :single-line="false"
      :bordered="false"
      :scroll-x="900"
    />
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

<style>
.eval-item-form-modal {
  width: 520px;
  max-width: 92vw;
}
</style>
