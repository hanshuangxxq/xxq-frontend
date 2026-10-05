<script setup lang="ts">
/**
 * 作业出题:从题库抽题的选择器弹窗。
 *
 * 题库是分页接口,选择状态必须跨页保留 —— 已选项累计在 picked Map(id -> 题目),
 * 翻页/筛选不清空;已在作业里的题(pickedIds)本页行禁选并打标。
 *
 * ★ `allow-checking-not-loaded` 必须开:naive-ui 默认只回传**当前已加载页**的勾选,
 * 翻页后上一页的 key 会从 checked-row-keys 里消失 —— 表格显示成未勾(与 picked 及计数不符),
 * 且回到那一页再点任意一下就会把它们从 picked 里静默删掉。
 */
import { computed, h, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NDataTable,
  NButton,
  NSpace,
  NTag,
  NInput,
  NSelect,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { formatScore } from '@/shared/utils/format'
import { useLoading } from '@/shared/composables/useLoading'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import EmptyState from '@/shared/components/EmptyState.vue'
import { fetchQuestionBank } from '../api'
import { courseTagFields, questionTypeLabelKey, questionTypeTagType } from '../utils'
import CourseTagSelect from './CourseTagSelect.vue'
import type { QuestionType, QuestionView } from '../types'

const props = defineProps<{
  show: boolean
  /** 已进作业题库组的题 id(禁选并打「已选」标) */
  pickedIds: number[]
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  /** 确认时把本次勾选的题(跨页累计)一次性交给父级 */
  confirm: [questions: QuestionView[]]
}>()

const { t } = useI18n()
const message = useMessage()

const rows = ref<QuestionView[]>([])
const { loading, withLoading } = useLoading()
const { pagination, reset } = useRemotePagination(loadData, { pageSize: 10 })

const filterType = ref<QuestionType | null>(null)
/** 课程标签筛选:课程复合键(source:id),null = 不限 */
const filterTag = ref<string | null>(null)
const filterKeyword = ref('')

const typeFilterOptions = computed(() =>
  (['SINGLE_CHOICE', 'MULTI_CHOICE', 'JUDGE', 'FILL_BLANK', 'ESSAY'] as QuestionType[]).map(
    (type) => ({ label: t(questionTypeLabelKey(type)), value: type }),
  ),
)

/** 跨页累计的勾选:id -> 题目(确认时整体交给父级) */
const picked = ref<Map<number, QuestionView>>(new Map())
const checkedKeys = ref<number[]>([])

function loadData(): Promise<void> {
  return withLoading(async () => {
    try {
      const res = await fetchQuestionBank({
        page: pagination.page,
        pageSize: pagination.pageSize,
        type: filterType.value ?? undefined,
        ...courseTagFields(filterTag.value),
        keyword: filterKeyword.value.trim() || undefined,
      })
      rows.value = res.data.records
      pagination.itemCount = res.data.total
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.loadFail'))
      }
      rows.value = []
    }
  })
}

// 打开时重置筛选与勾选,回到第 1 页拉最新数据;关闭时清空,避免下次打开闪出上次的勾选
watch(
  () => props.show,
  (show) => {
    if (!show) {
      rows.value = []
      picked.value = new Map()
      checkedKeys.value = []
      return
    }
    filterType.value = null
    filterTag.value = null
    filterKeyword.value = ''
    reset()
    void loadData()
  },
)

function handleSearch(): void {
  reset()
  void loadData()
}

/** 标签筛选变化:先落值再查询(不能依赖 v-model 与 @update 的执行次序) */
function handleTagChange(value: string | null): void {
  filterTag.value = value
  handleSearch()
}

/** 勾选变化:同步进跨页 Map(取消勾选的 id 从 Map 摘掉);RowKey 含 string,统一转 number */
function handleCheck(keys: (string | number)[]): void {
  const numKeys = keys.map((k) => Number(k))
  checkedKeys.value = numKeys
  const keySet = new Set(numKeys)
  for (const row of rows.value) {
    if (keySet.has(row.id)) picked.value.set(row.id, row)
    else picked.value.delete(row.id)
  }
}

function handleConfirm(): void {
  emit('confirm', [...picked.value.values()])
  emit('update:show', false)
}

const columns = computed<DataTableColumns<QuestionView>>(() => [
  { type: 'selection', disabled: (row) => props.pickedIds.includes(row.id) },
  {
    title: t('coursework.question.type'),
    key: 'type',
    width: 90,
    align: 'center',
    render: (row) =>
      h(
        NTag,
        { type: questionTypeTagType(row.type), size: 'small', bordered: false },
        () => t(questionTypeLabelKey(row.type)),
      ),
  },
  {
    title: t('coursework.question.stem'),
    key: 'stem',
    minWidth: 240,
    ellipsis: { tooltip: true },
  },
  {
    title: t('coursework.question.defaultScore'),
    key: 'defaultScore',
    width: 90,
    align: 'center',
    render: (row) => formatScore(row.defaultScore),
  },
])

const rowKey = (row: QuestionView) => row.id
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="coursework-modal coursework-modal-wide"
    :title="t('coursework.question.pickTitle')"
    @update:show="emit('update:show', $event)"
  >
    <div class="picker-toolbar">
      <NSelect
        v-model:value="filterType"
        :options="typeFilterOptions"
        :placeholder="t('coursework.question.typeFilter')"
        clearable
        class="type-filter"
        @update:value="handleSearch"
      />
      <div class="course-tag-filter">
        <CourseTagSelect
          :model-value="filterTag"
          :placeholder="t('coursework.question.courseTagAll')"
          @update:model-value="handleTagChange"
        />
      </div>
      <NInput
        v-model:value="filterKeyword"
        :placeholder="t('coursework.question.keywordFilter')"
        clearable
        class="keyword-filter"
        @keyup.enter="handleSearch"
      />
      <NButton @click="handleSearch">{{ t('coursework.question.search') }}</NButton>
    </div>
    <EmptyState v-if="!loading && !rows.length" :description="t('coursework.common.empty')" />
    <NDataTable
      v-else-if="rows.length"
      remote
      :columns="columns"
      :data="rows"
      :row-key="rowKey"
      :checked-row-keys="checkedKeys"
      :pagination="pagination"
      :single-line="false"
      :bordered="false"
      :scroll-x="700"
      :allow-checking-not-loaded="true"
      max-height="46vh"
      @update:checked-row-keys="handleCheck"
    />
    <template #footer>
      <NSpace justify="end" align="center">
        <NText depth="3">{{ t('coursework.question.pickedCount', { count: picked.size }) }}</NText>
        <NButton @click="emit('update:show', false)">{{ t('coursework.common.cancel') }}</NButton>
        <NButton type="primary" :disabled="!picked.size" @click="handleConfirm">
          {{ t('coursework.question.pickConfirm') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped src="./QuestionBankTab.css"></style>

<style>
.coursework-modal-wide {
  width: 1080px;
  max-width: 96vw;
}
</style>

<style scoped>
.picker-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
