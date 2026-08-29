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
  NSelect,
  NSwitch,
  NPopconfirm,
  NSpin,
  NEmpty,
  NTag,
  NAlert,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  fetchEvaluationTemplates,
  createEvaluationTemplate,
  updateEvaluationTemplate,
  deleteEvaluationTemplate,
  setDefaultEvaluationTemplate,
  updateEvaluationTemplateStatus,
  fetchEvaluationItems,
} from '../api'
import type { EvaluationTemplateDto, EvaluationItemDto, TemplateStatusCode } from '../types'
import { formatDateTime } from '../utils'

const { t } = useI18n()
const message = useMessage()

const loading = ref(false)
const data = ref<EvaluationTemplateDto[]>([])

async function loadData() {
  loading.value = true
  try {
    const res = await fetchEvaluationTemplates()
    data.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('analysis.evLoadFail'))
    data.value = []
  } finally {
    loading.value = false
  }
}

const evaluationTemplateRowKey = (row: EvaluationTemplateDto) => row.id

const columns = computed<DataTableColumns<EvaluationTemplateDto>>(() => [
  { title: t('analysis.evTemplateName'), key: 'name', minWidth: 160, ellipsis: { tooltip: true } },
  {
    title: t('analysis.evTemplateStatus'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: r.status === '启用' ? 'success' : 'warning', size: 'small', bordered: false },
        () => r.status,
      ),
  },
  {
    title: t('analysis.evTemplateDefault'),
    key: 'isDefault',
    width: 80,
    align: 'center',
    render: (r) =>
      r.isDefault === 1
        ? h(NTag, { type: 'info', size: 'small', bordered: false }, () =>
            t('analysis.evTemplateDefaultBadge'),
          )
        : '-',
  },
  {
    title: t('analysis.evTemplateItemCount'),
    key: 'items',
    width: 90,
    align: 'center',
    render: (r) => r.items.length,
  },
  {
    title: t('analysis.evTemplateCreateTime'),
    key: 'createTime',
    width: 160,
    align: 'center',
    render: (r) => formatDateTime(r.createTime),
  },
  {
    title: t('analysis.evTemplateEdit'),
    key: 'actions',
    width: 280,
    align: 'center',
    render(row) {
      const isDefault = row.isDefault === 1
      const isEnabled = row.status === '启用'
      return h(NSpace, { size: 4, wrap: false }, () => [
        h(
          NButton,
          {
            size: 'small',
            disabled: isDefault,
            onClick: () => handleSetDefault(row.id),
          },
          () => t('analysis.evSetDefault'),
        ),
        h(
          NButton,
          {
            size: 'small',
            disabled: isDefault,
            onClick: () => handleToggleStatus(row.id, isEnabled ? 'DISABLED' : 'ENABLED'),
          },
          () => (isEnabled ? t('analysis.evDisable') : t('analysis.evEnable')),
        ),
        h(NButton, { size: 'small', onClick: () => startEdit(row) }, () =>
          t('analysis.evTemplateEdit'),
        ),
        isDefault
          ? h(NButton, { size: 'small', type: 'error', disabled: true }, () =>
              t('analysis.evTemplateDelete'),
            )
          : h(
              NPopconfirm,
              { onPositiveClick: () => handleDelete(row.id) },
              {
                default: () => t('analysis.evTemplateDeleteConfirm'),
                trigger: () =>
                  h(NButton, { size: 'small', type: 'error' }, () =>
                    t('analysis.evTemplateDelete'),
                  ),
              },
            ),
      ])
    },
  },
])

async function handleSetDefault(id: number) {
  try {
    await setDefaultEvaluationTemplate(id)
    message.success(t('analysis.evSetDefaultSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('analysis.evStatusUpdateFail'))
  }
}

async function handleToggleStatus(id: number, status: TemplateStatusCode) {
  try {
    await updateEvaluationTemplateStatus(id, status)
    message.success(t('analysis.evStatusUpdateSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('analysis.evStatusUpdateFail'))
  }
}

async function handleDelete(id: number) {
  try {
    await deleteEvaluationTemplate(id)
    message.success(t('analysis.evTemplateDeleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('analysis.evTemplateDeleteFail'))
  }
}

// ---- 表单 ----
const allItems = ref<EvaluationItemDto[]>([])
const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)

interface TemplateItemRow {
  itemId: number
  itemName: string
  maxScore: number
  sortOrder: number
  required: boolean
}

interface TemplateForm {
  name: string
  description: string
  items: TemplateItemRow[]
}

const emptyForm = (): TemplateForm => ({ name: '', description: '', items: [] })
const form = ref<TemplateForm>(emptyForm())

// 添加指标下拉的当前值
const addItemValue = ref<number | null>(null)

const availableItemOptions = computed(() =>
  allItems.value
    .filter((it) => !form.value.items.some((s) => s.itemId === it.id))
    .map((it) => ({
      label: `${it.name}（${t('analysis.evItemMaxScore')} ${it.maxScore}）`,
      value: it.id,
    })),
)

const noMoreItems = computed(
  () => availableItemOptions.value.length === 0 || allItems.value.length === 0,
)

function handleAddItem(itemId: number | null) {
  if (itemId == null) return
  const it = allItems.value.find((i) => i.id === itemId)
  if (!it) return
  const nextSort = form.value.items.length + 1
  form.value.items.push({
    itemId: it.id,
    itemName: it.name,
    maxScore: it.maxScore,
    sortOrder: nextSort,
    required: true,
  })
  addItemValue.value = null
}

function removeItem(idx: number) {
  form.value.items.splice(idx, 1)
  // 重新编号
  form.value.items.forEach((it, i) => (it.sortOrder = i + 1))
}

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  addItemValue.value = null
  showForm.value = true
}

function startEdit(row: EvaluationTemplateDto) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = {
    name: row.name,
    description: row.description ?? '',
    items: [...row.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((it) => ({
        itemId: it.itemId,
        itemName: it.itemName,
        maxScore: it.maxScore,
        sortOrder: it.sortOrder,
        required: it.required === 1,
      })),
  }
  addItemValue.value = null
  showForm.value = true
}

async function handleSave() {
  const name = form.value.name.trim()
  if (!name) {
    message.warning(t('analysis.evTemplateNameRequired'))
    return
  }
  if (form.value.items.length === 0) {
    message.warning(t('analysis.evTemplateNoItems'))
    return
  }
  saving.value = true
  try {
    const items = form.value.items.map((it) => ({
      itemId: it.itemId,
      sortOrder: it.sortOrder,
      required: it.required ? 1 : 0,
    }))
    if (formMode.value === 'create') {
      await createEvaluationTemplate({
        name,
        description: form.value.description.trim() || undefined,
        items,
      })
    } else {
      await updateEvaluationTemplate(editingId.value!, {
        name,
        description: form.value.description.trim() || undefined,
        items,
      })
    }
    message.success(t('analysis.evSubmitSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('analysis.evTemplateSaveFail'))
  } finally {
    saving.value = false
  }
}

async function loadItems() {
  try {
    const res = await fetchEvaluationItems()
    allItems.value = res.data
  } catch {
    // 非阻塞
  }
}

onMounted(() => {
  loadData()
  loadItems()
})
</script>

<template>
  <NCard :title="$t('analysis.evTemplates')">
    <template #header-extra>
      <NButton type="primary" @click="startCreate">{{ $t('analysis.evTemplateAdd') }}</NButton>
    </template>
    <NSpin :show="loading">
      <NEmpty v-if="!loading && data.length === 0" :description="$t('analysis.evTemplateEmpty')" />
      <NDataTable
        v-else
        :columns="columns"
        :data="data"
        :row-key="evaluationTemplateRowKey"
        :single-line="false"
        :bordered="false"
        :scroll-x="1000"
      />
    </NSpin>
  </NCard>

  <NModal
    v-model:show="showForm"
    preset="card"
    :title="
      formMode === 'create' ? $t('analysis.evTemplateAddTitle') : $t('analysis.evTemplateEditTitle')
    "
    class="eval-template-form-modal"
  >
    <NForm :model="form" label-placement="top">
      <NFormItem :label="$t('analysis.evTemplateName')" required>
        <NInput v-model:value="form.name" :placeholder="$t('analysis.evTemplateName')" />
      </NFormItem>
      <NFormItem :label="$t('analysis.evTemplateDesc')">
        <NInput
          v-model:value="form.description"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="$t('analysis.evTemplateDesc')"
        />
      </NFormItem>

      <NFormItem :label="$t('analysis.evTemplateItems')">
        <NSpace vertical :size="8" style="width: 100%">
          <NAlert type="info" :show-icon="true" class="tpl-items-hint">
            {{ $t('analysis.evTemplateItemsHint') }}
          </NAlert>

          <div class="tpl-item-add">
            <NSelect
              v-model:value="addItemValue"
              :options="availableItemOptions"
              :placeholder="$t('analysis.evTemplateAddItem')"
              :disabled="noMoreItems"
              filterable
              style="flex: 1"
              @update:value="handleAddItem"
            />
          </div>

          <NEmpty
            v-if="form.items.length === 0"
            size="small"
            :description="$t('analysis.evTemplateNoItems')"
          />
          <div v-else class="tpl-item-list">
            <div v-for="(it, idx) in form.items" :key="it.itemId" class="tpl-item-row">
              <span class="tpl-item-name">{{ it.itemName }}</span>
              <span class="tpl-item-max"
                >{{ $t('analysis.evItemMaxScore') }}：{{ it.maxScore }}</span
              >
              <div class="tpl-item-sort">
                <span class="tpl-item-label">{{ $t('analysis.evTemplateItemSort') }}</span>
                <NInputNumber
                  v-model:value="it.sortOrder"
                  :min="1"
                  size="small"
                  style="width: 90px"
                />
              </div>
              <div class="tpl-item-required">
                <span class="tpl-item-label">{{ $t('analysis.evTemplateItemRequired') }}</span>
                <NSwitch v-model:value="it.required" size="small" />
              </div>
              <NButton size="small" type="error" quaternary @click="removeItem(idx)">
                {{ $t('analysis.evTemplateDelete') }}
              </NButton>
            </div>
          </div>
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

<style scoped src="./EvaluationTemplatesManager.css"></style>

<style>
.eval-template-form-modal {
  width: 680px;
  max-width: 94vw;
}
</style>
