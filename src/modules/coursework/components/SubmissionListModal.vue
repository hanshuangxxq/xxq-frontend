<script setup lang="ts">
/**
 * 教师提交名单:完整花名册(未交学生也在列,按学号升序),五态进度 + 进入逐题批改。
 *
 * 契约要点:
 * - 名单行 `state` 五态:GRADED > SUBMITTED > DRAFTING > VIEWED > NOT_VIEWED
 *   (草稿/已查看来自 Redis,未交行 `submissionId` 为 null —— 批改按钮据此禁用);
 * - `autoScore` = 客观题自动得分合计(未交为 null);
 * - 批改改为逐题进行(SubmissionGradeModal),整份打分入口已废弃。
 */
import { computed, h, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NDataTable,
  NButton,
  NSpace,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { formatDateTime, formatScore } from '@/shared/utils/format'
import { useLoading } from '@/shared/composables/useLoading'
import EmptyState from '@/shared/components/EmptyState.vue'
import { fetchSubmissions } from '../api'
import { submissionStateLabelKey, submissionStateTagType } from '../utils'
import SubmissionGradeModal from './SubmissionGradeModal.vue'
import type { AssignmentView, SubmissionRowView } from '../types'

const props = defineProps<{
  show: boolean
  assignment: AssignmentView | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  /** 批改成功后通知父级:列表里的「已批」计数需要重新拉 */
  graded: []
}>()

const { t } = useI18n()
const message = useMessage()

const rows = ref<SubmissionRowView[]>([])
const { loading, withLoading } = useLoading()

const showGrade = ref(false)
const gradingSubmissionId = ref<number | null>(null)

function loadRows(): Promise<void> {
  const id = props.assignment?.id
  if (id == null) return Promise.resolve()
  return withLoading(async () => {
    try {
      const res = await fetchSubmissions(id)
      rows.value = res.data
    } catch (e) {
      if (!isReportedError(e)) message.error((e as Error).message || t('coursework.common.loadFail'))
      rows.value = []
    }
  })
}

// 打开时按当前作业拉名单;关闭时清空,避免下次打开先闪出上一份作业的名单
watch(
  () => props.show,
  (show) => {
    if (show) void loadRows()
    else rows.value = []
  },
)

function openGrade(row: SubmissionRowView): void {
  gradingSubmissionId.value = row.submissionId
  showGrade.value = true
}

function handleGraded(): void {
  void loadRows()
  emit('graded')
}

const columns = computed<DataTableColumns<SubmissionRowView>>(() => [
  { title: t('coursework.assignment.studentNo'), key: 'studentNo', width: 120 },
  { title: t('coursework.assignment.studentName'), key: 'studentName', width: 100 },
  {
    title: t('coursework.assignment.submitStatus'),
    key: 'state',
    width: 110,
    align: 'center',
    render: (row) =>
      h(
        NTag,
        { type: submissionStateTagType(row.state), size: 'small', bordered: false },
        () => t(submissionStateLabelKey(row.state)) || row.state,
      ),
  },
  {
    title: t('coursework.assignment.submitTime'),
    key: 'submitTime',
    width: 150,
    render: (row) => formatDateTime(row.submitTime),
  },
  {
    title: t('coursework.assignment.version'),
    key: 'version',
    width: 110,
    align: 'center',
    render: (row) =>
      row.version == null ? '-' : t('coursework.assignment.version', { version: row.version }),
  },
  {
    title: t('coursework.assignment.late'),
    key: 'late',
    width: 90,
    align: 'center',
    render: (row) =>
      row.submitted
        ? t(row.late === 1 ? 'coursework.assignment.lateYes' : 'coursework.assignment.lateNo')
        : '-',
  },
  {
    title: t('coursework.assignment.autoScore'),
    key: 'autoScore',
    width: 100,
    align: 'center',
    render: (row) => (row.autoScore == null ? '-' : formatScore(row.autoScore)),
  },
  {
    title: t('coursework.assignment.score'),
    key: 'score',
    width: 90,
    align: 'center',
    render: (row) => (row.score == null ? '-' : formatScore(row.score)),
  },
  {
    title: t('coursework.common.actions'),
    key: 'actions',
    width: 110,
    fixed: 'right',
    render: (row) =>
      h(
        NButton,
        {
          size: 'small',
          type: 'primary',
          // 未交学生没有 submissionId,无可批改/可查看的对象
          disabled: row.submissionId == null,
          onClick: () => openGrade(row),
        },
        () => t(row.status === '已批改' ? 'coursework.assignment.regrade' : 'coursework.assignment.grade'),
      ),
  },
])

const rowKey = (row: SubmissionRowView) => row.studentUserId
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="coursework-modal coursework-modal-wide"
    :title="`${t('coursework.assignment.submissionsTitle')}${assignment ? ` - ${assignment.title}` : ''}`"
    @update:show="emit('update:show', $event)"
  >
    <EmptyState
      v-if="!loading && assignment != null && !rows.length"
      :description="t('coursework.common.empty')"
    />
    <NDataTable
      v-else-if="rows.length"
      :columns="columns"
      :data="rows"
      :row-key="rowKey"
      :single-line="false"
      :bordered="false"
      :pagination="false"
      :scroll-x="1000"
      max-height="60vh"
    />
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">{{ t('coursework.player.close') }}</NButton>
      </NSpace>
    </template>

    <SubmissionGradeModal
      v-model:show="showGrade"
      :submission-id="gradingSubmissionId"
      @graded="handleGraded"
    />
  </NModal>
</template>

<style scoped src="./SubmissionListModal.css"></style>

<style>
.coursework-modal-wide {
  width: 1080px;
  max-width: 96vw;
}
</style>
