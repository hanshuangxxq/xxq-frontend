<script setup lang="ts">
/**
 * 教师：作业管理（列表 + 新建/编辑/发布/关闭/删除 + 进入提交名单批改）。
 *
 * 契约要点:
 * - 作业列表是本模块**唯一分页**的接口，走 useRemotePagination；
 * - 写操作返回的 submittedCount/gradedCount 恒为 null，所以每次写完都**重新拉列表**，
 *   不要拿写操作的返回值去更新行（否则「已交/已批」会变成 '-'）；
 * - 删除仅草稿可用、编辑/替换附件对已关闭作业会 409，故按状态控制按钮可用性。
 */
import { computed, h, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NDataTable,
  NButton,
  NSpace,
  NTag,
  NPopconfirm,
  NText,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { formatDateTime, formatScore } from '@/shared/utils/format'
import { useLoading } from '@/shared/composables/useLoading'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import EmptyState from '@/shared/components/EmptyState.vue'
import {
  closeAssignment,
  deleteAssignment,
  fetchAssignments,
  publishAssignment,
} from '../api'
import { DEFAULT_PAGE_SIZE } from '../constants'
import { assignmentStatusTagType } from '../utils'
import AssignmentFormModal from './AssignmentFormModal.vue'
import CloneAssignmentModal from './CloneAssignmentModal.vue'
import SubmissionListModal from './SubmissionListModal.vue'
import type { AssignmentView } from '../types'
import { useCourseAnchor } from '../useCourseAnchor'

const props = defineProps<{ courseId: number | null }>()

/** 请求一律用锚点 id(文档 §1.6):服务端回带的 teachInfoId 才回写进 anchorId */
const { anchorId, adopt } = useCourseAnchor(() => props.courseId)

const { t } = useI18n()
const message = useMessage()

const rows = ref<AssignmentView[]>([])
const { loading, withLoading } = useLoading()
const { pagination, reset } = useRemotePagination(loadData, { pageSize: DEFAULT_PAGE_SIZE })

const showForm = ref(false)
const editing = ref<AssignmentView | null>(null)
const showSubmissions = ref(false)
const submissionsTarget = ref<AssignmentView | null>(null)
const showClone = ref(false)
const cloneSource = ref<AssignmentView | null>(null)
/** 正在执行发布/关闭/删除的行 id，用于只给该行按钮转圈 */
const actingId = ref<number | null>(null)

function loadData(): Promise<void> {
  const id = anchorId.value
  if (id == null) {
    rows.value = []
    return Promise.resolve()
  }
  return withLoading(async () => {
    try {
      const res = await fetchAssignments(id, pagination.page, pagination.pageSize)
      rows.value = res.data.records
      pagination.itemCount = res.data.total
      // 列表回带的是锚点行 id,采纳后后续写操作(建/改/克隆)都用它
      adopt(res.data.records[0]?.teachInfoId)
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.loadFail'))
      }
      rows.value = []
    }
  })
}

// 换课时重置到第一页并重新拉;首载在 setup 内同步发起(watch immediate),保证首帧 loading 已为 true
watch(
  () => props.courseId,
  () => {
    reset()
    void loadData()
  },
  { immediate: true },
)

function openCreate() {
  editing.value = null
  showForm.value = true
}

function openEdit(row: AssignmentView): void {
  editing.value = row
  showForm.value = true
}

function openSubmissions(row: AssignmentView): void {
  submissionsTarget.value = row
  showSubmissions.value = true
}

function openClone(row: AssignmentView): void {
  cloneSource.value = row
  showClone.value = true
}

function handlePublish(row: AssignmentView) {
  return withLoading(async () => {
    actingId.value = row.id
    try {
      await publishAssignment(row.id)
      message.success(t('coursework.assignment.publishSuccess'))
      await loadData()
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.operationFail'))
      }
    } finally {
      actingId.value = null
    }
  })
}

function handleClose(row: AssignmentView) {
  return withLoading(async () => {
    actingId.value = row.id
    try {
      await closeAssignment(row.id)
      message.success(t('coursework.assignment.closeSuccess'))
      await loadData()
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.operationFail'))
      }
    } finally {
      actingId.value = null
    }
  })
}

function handleDelete(row: AssignmentView) {
  return withLoading(async () => {
    actingId.value = row.id
    try {
      await deleteAssignment(row.id)
      message.success(t('coursework.common.deleteSuccess'))
      await loadData()
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.deleteFail'))
      }
    } finally {
      actingId.value = null
    }
  })
}

const columns = computed<DataTableColumns<AssignmentView>>(() => [
  {
    title: t('coursework.assignment.title'),
    key: 'title',
    minWidth: 180,
    ellipsis: { tooltip: true },
  },
  {
    title: t('coursework.assignment.status'),
    key: 'status',
    width: 100,
    align: 'center',
    render: (row) =>
      h(
        NTag,
        { type: assignmentStatusTagType(row.status), size: 'small', bordered: false },
        () => row.status,
      ),
  },
  {
    title: t('coursework.assignment.deadline'),
    key: 'deadline',
    width: 150,
    render: (row) => formatDateTime(row.deadline),
  },
  {
    title: t('coursework.assignment.totalScore'),
    key: 'totalScore',
    width: 90,
    align: 'center',
    render: (row) => formatScore(row.totalScore),
  },
  {
    title: t('coursework.assignment.submittedCount'),
    key: 'submittedCount',
    width: 80,
    align: 'center',
    // 写操作返回的对象里这两个字段是 null，只有列表/详情才填充
    render: (row) => (row.submittedCount == null ? '-' : String(row.submittedCount)),
  },
  {
    title: t('coursework.assignment.gradedCount'),
    key: 'gradedCount',
    width: 80,
    align: 'center',
    render: (row) => (row.gradedCount == null ? '-' : String(row.gradedCount)),
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
    width: 330,
    fixed: 'right',
    render: (row) => {
      const busy = actingId.value === row.id
      const actions = [
        h(
          NButton,
          { size: 'small', onClick: () => openSubmissions(row) },
          () => t('coursework.assignment.submissionsTitle'),
        ),
        // 已关闭的作业不可修改（后端 409），编辑入口一并禁用
        h(
          NButton,
          { size: 'small', disabled: row.status === '已关闭', onClick: () => openEdit(row) },
          () => t('coursework.common.edit'),
        ),
        // 克隆不受源作业状态限制（落为新授课组的草稿;源无题目时后端 400）
        h(
          NButton,
          { size: 'small', onClick: () => openClone(row) },
          () => t('coursework.assignment.clone'),
        ),
      ]
      if (row.status === '草稿') {
        actions.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handlePublish(row) },
            {
              default: () => t('coursework.assignment.publishConfirm'),
              trigger: () =>
                h(
                  NButton,
                  { size: 'small', type: 'primary', loading: busy },
                  () => t('coursework.assignment.publish'),
                ),
            },
          ),
        )
      }
      if (row.status === '已发布') {
        actions.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleClose(row) },
            {
              default: () => t('coursework.assignment.closeConfirm'),
              trigger: () =>
                h(
                  NButton,
                  { size: 'small', loading: busy },
                  () => t('coursework.assignment.close'),
                ),
            },
          ),
        )
      }
      // 仅草稿可删（文档 §2.1 状态机），其余状态直接不给入口而不是让用户撞 409
      if (row.status === '草稿') {
        actions.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row) },
            {
              default: () => t('coursework.common.deleteConfirm'),
              trigger: () =>
                h(
                  NButton,
                  { size: 'small', type: 'error', loading: busy },
                  () => t('coursework.common.delete'),
                ),
            },
          ),
        )
      }
      return h(NSpace, { size: 8, wrap: false }, () => actions)
    },
  },
])

const rowKey = (row: AssignmentView) => row.id
</script>

<template>
  <div class="tab-body">
    <div class="tab-toolbar">
      <NText depth="3" class="tab-hint">{{ t('coursework.assignment.tab') }}</NText>
      <NButton type="primary" :disabled="courseId == null" @click="openCreate">
        {{ t('coursework.assignment.addTitle') }}
      </NButton>
    </div>
    <EmptyState
      v-if="!loading && courseId != null && !rows.length"
      :description="t('coursework.common.empty')"
    />
    <NDataTable
      v-else-if="rows.length"
      remote
      :columns="columns"
      :data="rows"
      :row-key="rowKey"
      :pagination="pagination"
      :single-line="false"
      :bordered="false"
      :scroll-x="1300"
    />

    <AssignmentFormModal
      v-model:show="showForm"
      :course-id="anchorId ?? 0"
      :assignment="editing"
      @saved="loadData"
    />
    <CloneAssignmentModal
      v-model:show="showClone"
      :assignment="cloneSource"
      @cloned="loadData"
    />
    <SubmissionListModal
      v-model:show="showSubmissions"
      :assignment="submissionsTarget"
      @graded="loadData"
    />
  </div>
</template>

<style scoped src="./TabShared.css"></style>
