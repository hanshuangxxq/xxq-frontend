<script setup lang="ts">
/**
 * 教师个人题库:分页列表 + 题型/关键词筛选 + 录入/编辑/软删。
 *
 * 契约要点:
 * - 题库是教师个人维度(不挂 teachInfoId),越权访问他人题目一律 404;
 * - **软删安全**:已被作业引用的题可删 —— 作业里存的是题目快照,删题库不影响已发布作业;
 * - 列表是分页接口,走 useRemotePagination;筛选变化回到第 1 页重新拉。
 */
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NDataTable,
  NButton,
  NSpace,
  NTag,
  NText,
  NInput,
  NSelect,
  NPopconfirm,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { formatDateTime, formatScore } from '@/shared/utils/format'
import { useLoading } from '@/shared/composables/useLoading'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import EmptyState from '@/shared/components/EmptyState.vue'
import { createBankQuestion, deleteBankQuestion, fetchQuestionBank, updateBankQuestion } from '../api'
import { DEFAULT_PAGE_SIZE } from '../constants'
import { questionFormFromBank, toQuestionSaveRequest } from '../questionForm'
import { courseTagFields, questionTypeLabelKey, questionTypeTagType } from '../utils'
import CourseTagSelect from './CourseTagSelect.vue'
import QuestionFormModal from './QuestionFormModal.vue'
import type { QuestionFormValue } from '../questionForm'
import type { QuestionType, QuestionView } from '../types'

const { t } = useI18n()
const message = useMessage()

const rows = ref<QuestionView[]>([])
const { loading, withLoading } = useLoading()
const { pagination, reset } = useRemotePagination(loadData, { pageSize: DEFAULT_PAGE_SIZE })

const filterType = ref<QuestionType | null>(null)
/** 课程标签筛选:课程复合键(source:id),null = 不限 */
const filterTag = ref<string | null>(null)
const filterKeyword = ref('')

const showForm = ref(false)
const editing = ref<QuestionFormValue | null>(null)
const editingId = ref<number | null>(null)
/** 正在删除的题 id,只给该行按钮转圈 */
const deletingId = ref<number | null>(null)

const typeFilterOptions = computed(() =>
  (['SINGLE_CHOICE', 'MULTI_CHOICE', 'JUDGE', 'FILL_BLANK', 'ESSAY'] as QuestionType[]).map(
    (type) => ({ label: t(questionTypeLabelKey(type)), value: type }),
  ),
)

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

// 首载在 setup 内同步发起,保证首帧 loading 已为 true(空状态不会先闪出来)
void loadData()

function handleSearch(): void {
  reset()
  void loadData()
}

/** 标签筛选变化:先落值再查询(不能依赖 v-model 与 @update 的执行次序) */
function handleTagChange(value: string | null): void {
  filterTag.value = value
  handleSearch()
}

function openCreate(): void {
  editing.value = null
  editingId.value = null
  showForm.value = true
}

function openEdit(row: QuestionView): void {
  editing.value = questionFormFromBank(row)
  editingId.value = row.id
  showForm.value = true
}

function handleSubmit(value: QuestionFormValue): void {
  void withLoading(async () => {
    try {
      const payload = toQuestionSaveRequest(value)
      if (editingId.value != null) {
        await updateBankQuestion(editingId.value, payload)
      } else {
        await createBankQuestion(payload)
      }
      message.success(t('coursework.common.operationSuccess'))
      await loadData()
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.operationFail'))
      }
    }
  })
}

function handleDelete(row: QuestionView): void {
  void withLoading(async () => {
    deletingId.value = row.id
    try {
      await deleteBankQuestion(row.id)
      message.success(t('coursework.common.deleteSuccess'))
      await loadData()
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.deleteFail'))
      }
    } finally {
      deletingId.value = null
    }
  })
}

const columns = computed<DataTableColumns<QuestionView>>(() => [
  {
    title: t('coursework.question.type'),
    key: 'type',
    width: 100,
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
    minWidth: 260,
    ellipsis: { tooltip: true },
  },
  {
    title: t('coursework.question.defaultScore'),
    key: 'defaultScore',
    width: 90,
    align: 'center',
    render: (row) => formatScore(row.defaultScore),
  },
  {
    title: t('coursework.common.createTime'),
    key: 'createTime',
    width: 150,
    render: (row) => formatDateTime(row.createTime),
  },
  {
    title: t('coursework.common.actions'),
    key: 'actions',
    width: 150,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8, wrap: false }, () => [
        h(NButton, { size: 'small', onClick: () => openEdit(row) }, () => t('coursework.common.edit')),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            // 明确告知快照语义:删题库不动已发布作业,降低删除的心理门槛
            default: () => t('coursework.question.deleteConfirm'),
            trigger: () =>
              h(
                NButton,
                { size: 'small', type: 'error', loading: deletingId.value === row.id },
                () => t('coursework.common.delete'),
              ),
          },
        ),
      ]),
  },
])

const rowKey = (row: QuestionView) => row.id
</script>

<template>
  <div class="tab-body">
    <div class="tab-toolbar">
      <NSpace align="center" :size="8">
        <NText depth="3" class="tab-hint">{{ t('coursework.question.tab') }}</NText>
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
      </NSpace>
      <NButton type="primary" @click="openCreate">{{ t('coursework.question.addTitle') }}</NButton>
    </div>
    <EmptyState v-if="!loading && !rows.length" :description="t('coursework.common.empty')" />
    <NDataTable
      v-else-if="rows.length"
      remote
      :columns="columns"
      :data="rows"
      :row-key="rowKey"
      :pagination="pagination"
      :single-line="false"
      :bordered="false"
      :scroll-x="900"
    />

    <QuestionFormModal
      v-model:show="showForm"
      mode="bank"
      :initial="editing"
      @submit="handleSubmit"
    />
  </div>
</template>

<style scoped src="./TabShared.css"></style>
<style scoped src="./QuestionBankTab.css"></style>
