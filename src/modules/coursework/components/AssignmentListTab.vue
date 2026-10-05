<script setup lang="ts">
/**
 * 学生：作业列表 + 在线作答/重交 + 查看我的提交 + 下载作业附件。
 *
 * 契约要点:
 * - 「我的提交」状态来自 `mySubmissionStatus`，取值是**英文码** `SUBMITTED`/`GRADED`
 *   （全文档唯一例外），别按中文匹配；而作业自身的 `status` 是中文；
 * - 学生视角看不到草稿（列表已过滤）；
 * - 提交/重交后 `version` 递增、批改痕迹清空，所以成功后**必须重新拉列表**，
 *   不能拿提交响应去更新行；
 * - 已关闭的作业不能再提交（服务端 400），按钮直接禁用；
 * - 作答在 AnswerAssignmentModal 里逐题进行（打开详情即记「已查看」）。
 */
import { computed, h, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NDataTable,
  NButton,
  NSpace,
  NTag,
  NText,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { formatDateTime, formatScore } from '@/shared/utils/format'
import { useLoading } from '@/shared/composables/useLoading'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import EmptyState from '@/shared/components/EmptyState.vue'
import FilePreviewModal from '@/modules/file/components/FilePreviewModal.vue'
import type { PreviewFileTarget } from '@/modules/file/preview'
import { downloadCourseFile, fetchAssignments, fetchMySubmission } from '../api'
import { DEFAULT_PAGE_SIZE } from '../constants'
import {
  assignmentStatusTagType,
  mySubmissionStatusLabelKey,
  mySubmissionStatusTagType,
  parseServerTime,
} from '../utils'
import AnswerAssignmentModal from './AnswerAssignmentModal.vue'
import MySubmissionModal from './MySubmissionModal.vue'
import type { AssignmentView, SubmissionView } from '../types'
import { useCourseAnchor } from '../useCourseAnchor'

const props = defineProps<{ courseId: number | null }>()

/** 请求一律用锚点 id(文档 §1.6):服务端回带的 teachInfoId 才回写进 anchorId */
const { anchorId, adopt } = useCourseAnchor(() => props.courseId)

const { t } = useI18n()
const message = useMessage()

const rows = ref<AssignmentView[]>([])
const { loading, withLoading } = useLoading()
const { pagination, reset } = useRemotePagination(loadData, { pageSize: DEFAULT_PAGE_SIZE })

const submitTarget = ref<AssignmentView | null>(null)
const showSubmit = ref(false)
const showMine = ref(false)
const mine = ref<SubmissionView | null>(null)

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
      // 列表回带的是锚点行 id,采纳后详情/提交等后续请求都用它
      adopt(res.data.records[0]?.teachInfoId)
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.loadFail'))
      }
      rows.value = []
    }
  })
}

watch(
  () => props.courseId,
  () => {
    reset()
    void loadData()
  },
  { immediate: true },
)

/** 是否已过截止时间（用于提示迟交，提交本身不受限——截止后仍可提交且 late=1） */
function isOverdue(row: AssignmentView): boolean {
  const deadline = parseServerTime(row.deadline)
  return deadline != null && Date.now() > deadline.getTime()
}

function openSubmit(row: AssignmentView): void {
  submitTarget.value = row
  showSubmit.value = true
}

async function openMine(row: AssignmentView): Promise<void> {
  mine.value = null
  showMine.value = true
  try {
    const res = await fetchMySubmission(row.id)
    mine.value = res.data
  } catch (e) {
    if (!isReportedError(e)) {
      message.error((e as Error).message || t('coursework.common.loadFail'))
    }
  }
}

function handleDownloadAttachment(row: AssignmentView) {
  const path = row.fileName
  if (!path) return
  void (async () => {
    try {
      await downloadCourseFile(path, row.fileOriginal)
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.downloadFail'))
      }
    }
  })()
}

/** 附件预览目标;「预览」按钮打开预览弹窗,下载按钮保持原样 */
const previewFile = ref<PreviewFileTarget | null>(null)
const showPreview = ref(false)

function openPreview(row: AssignmentView): void {
  const path = row.fileName
  if (!path) return
  previewFile.value = { path, name: row.fileOriginal || path.split('/').pop() || path }
  showPreview.value = true
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
    width: 170,
    render: (row) => {
      const children = [h('span', formatDateTime(row.deadline))]
      // 已提交看服务端的 late 标记；还没交但已过截止时间，用本地时间提前提醒会迟交
      const late = row.myLate === 1 || (row.mySubmissionId == null && isOverdue(row))
      if (late) {
        children.push(
          h(
            NTag,
            { type: 'warning', size: 'small', bordered: false },
            () => t('coursework.assignment.lateYes'),
          ),
        )
      }
      return h(NSpace, { size: 6, align: 'center', wrap: false }, () => children)
    },
  },
  {
    title: t('coursework.assignment.myStatus'),
    key: 'mySubmissionStatus',
    width: 110,
    align: 'center',
    render: (row) => {
      // ★ 英文码：SUBMITTED / GRADED，不是中文
      const key = mySubmissionStatusLabelKey(row.mySubmissionStatus)
      return h(
        NTag,
        {
          type: mySubmissionStatusTagType(row.mySubmissionStatus),
          size: 'small',
          bordered: false,
        },
        () => (key ? t(key) : t('coursework.assignment.notSubmitted')),
      )
    },
  },
  {
    title: t('coursework.assignment.myScore'),
    key: 'myScore',
    width: 100,
    align: 'center',
    render: (row) => (row.myScore == null ? '-' : formatScore(row.myScore)),
  },
  {
    title: t('coursework.assignment.version'),
    key: 'myVersion',
    width: 120,
    align: 'center',
    render: (row) =>
      row.myVersion == null ? '-' : t('coursework.assignment.version', { version: row.myVersion }),
  },
  {
    title: t('coursework.common.actions'),
    key: 'actions',
    width: 340,
    fixed: 'right',
    render: (row) => {
      const closed = row.status === '已关闭'
      const actions = [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            disabled: closed,
            onClick: () => void openSubmit(row),
          },
          () =>
            t(row.mySubmissionId == null ? 'coursework.assignment.submit' : 'coursework.assignment.resubmit'),
        ),
        h(
          NButton,
          {
            size: 'small',
            disabled: row.mySubmissionId == null,
            onClick: () => void openMine(row),
          },
          () => t('coursework.assignment.mySubmissionTitle'),
        ),
      ]
      if (row.fileName) {
        actions.push(
          h(
            NButton,
            { size: 'small', onClick: () => openPreview(row) },
            () => t('coursework.common.preview'),
          ),
          h(
            NButton,
            { size: 'small', onClick: () => handleDownloadAttachment(row) },
            () => t('coursework.common.download'),
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
      :scroll-x="1180"
    />

    <AnswerAssignmentModal
      v-model:show="showSubmit"
      :assignment="submitTarget"
      @submitted="loadData"
    />
    <MySubmissionModal v-model:show="showMine" :submission="mine" />
    <FilePreviewModal v-model:show="showPreview" :file="previewFile" />
  </div>
</template>

<style scoped src="./TabShared.css"></style>
