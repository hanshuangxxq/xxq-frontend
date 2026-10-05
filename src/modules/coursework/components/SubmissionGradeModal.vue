<script setup lang="ts">
/**
 * 教师逐题批改弹窗:查看单份提交的全部题目与该生作答,仅大题可给分。
 *
 * 契约要点:
 * - GET /coursework/submissions/{id} 教师视角**恒含标准答案**;
 * - 批改体是 {items:[{answerId, score, comment}], comment} —— items 仅大题
 *   (传客观题 answerId 会 400),score ∈ [0, 题分];
 * - 全部大题判完服务端自动合成总分并转「已批改」(仅 SUBMITTED→GRADED 跃迁时通知学生);
 * - 改判 = 再次调用,草稿预填上次的 finalScore/评语。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NDescriptions,
  NDescriptionsItem,
  NInput,
  NInputNumber,
  NButton,
  NSpace,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { formatDateTime, formatScore } from '@/shared/utils/format'
import { useLoading } from '@/shared/composables/useLoading'
import FilePreviewModal from '@/modules/file/components/FilePreviewModal.vue'
import type { PreviewFileTarget } from '@/modules/file/preview'
import { downloadCourseFile, fetchSubmissionDetail, gradeSubmission } from '../api'
import {
  asBooleanAnswer,
  asEssayAnswer,
  asFillBlankStandard,
  asStringAnswer,
  asStringArrayAnswer,
  questionTypeLabelKey,
  questionTypeTagType,
  submissionStatusTagType,
} from '../utils'
import type {
  AnswerView,
  EssayAnswerFile,
  GradeItem,
  TeacherSubmissionView,
} from '../types'

/** 大题的本地批改草稿(直接改接口返回对象会污染对比,故另存) */
interface GradeDraft {
  score: number | null
  comment: string
}

const props = defineProps<{
  show: boolean
  submissionId: number | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  graded: []
}>()

const { t } = useI18n()
const message = useMessage()

const detail = ref<TeacherSubmissionView | null>(null)
/** answerId -> 批改草稿(仅大题) */
const drafts = ref<Map<number, GradeDraft>>(new Map())
const overallComment = ref('')
const { loading: saving, withLoading: withSaving } = useLoading()

const sortedAnswers = computed(() =>
  (detail.value?.answers ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
)

/** 是否有大题:全客观作业提交即出分,这个弹窗只剩查看价值,隐藏提交按钮 */
const hasEssay = computed(() => sortedAnswers.value.some((a) => a.type === 'ESSAY'))

function loadDetail(): Promise<void> {
  const id = props.submissionId
  if (id == null) return Promise.resolve()
  return (async () => {
    try {
      const res = await fetchSubmissionDetail(id)
      detail.value = res.data
      overallComment.value = res.data.comment ?? ''
      const map = new Map<number, GradeDraft>()
      for (const a of res.data.answers ?? []) {
        if (a.type === 'ESSAY') {
          map.set(a.answerId, { score: a.finalScore, comment: a.comment ?? '' })
        }
      }
      drafts.value = map
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.loadFail'))
      }
      emit('update:show', false)
    }
  })()
}

// 打开时拉详情;关闭时清空,避免下次打开先闪出上一位学生的作答
watch(
  () => props.show,
  (show) => {
    if (show) void loadDetail()
    else {
      detail.value = null
      drafts.value = new Map()
      overallComment.value = ''
    }
  },
)

/** 客观题作答/标准答案的展示文本(与学生端同口径) */
function objectiveText(value: AnswerView['myAnswer'], a: AnswerView): string {
  switch (a.type) {
    case 'SINGLE_CHOICE':
      return asStringAnswer(value) ?? t('coursework.answer.unanswered')
    case 'MULTI_CHOICE': {
      const keys = asStringArrayAnswer(value)
      return keys.length ? keys.join('、') : t('coursework.answer.unanswered')
    }
    case 'JUDGE': {
      const v = asBooleanAnswer(value)
      if (v == null) return t('coursework.answer.unanswered')
      return t(v ? 'coursework.question.judgeTrue' : 'coursework.question.judgeFalse')
    }
    case 'FILL_BLANK': {
      const blanks = asStringArrayAnswer(value)
      return blanks.length ? blanks.join('；') : t('coursework.answer.unanswered')
    }
    case 'ESSAY':
      return ''
  }
}

function standardText(a: AnswerView): string {
  if (a.type === 'FILL_BLANK') {
    const std = asFillBlankStandard(a.standardAnswer)
    return std ? std.blanks.map((group) => group.join(' / ')).join('；') : ''
  }
  return objectiveText(a.standardAnswer, a)
}

function essayOf(a: AnswerView) {
  return asEssayAnswer(a.myAnswer)
}

function draftOf(answerId: number): GradeDraft {
  return drafts.value.get(answerId) ?? { score: null, comment: '' }
}

function setDraftScore(answerId: number, score: number | null): void {
  const d = draftOf(answerId)
  d.score = score
  drafts.value.set(answerId, d)
}

function setDraftComment(answerId: number, comment: string): void {
  const d = draftOf(answerId)
  d.comment = comment
  drafts.value.set(answerId, d)
}

/** 附件预览目标;点击文件名按钮打开预览弹窗,下载走旁边的独立按钮 */
const previewFile = ref<PreviewFileTarget | null>(null)
const showPreview = ref(false)

function handlePreview(file: EssayAnswerFile): void {
  previewFile.value = { path: file.path, name: file.original }
  showPreview.value = true
}

function handleDownload(file: EssayAnswerFile): void {
  void (async () => {
    try {
      await downloadCourseFile(file.path, file.original)
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.downloadFail'))
      }
    }
  })()
}

function handleGrade() {
  const id = props.submissionId
  if (id == null) return
  const items: GradeItem[] = []
  for (const a of sortedAnswers.value) {
    if (a.type !== 'ESSAY') continue
    const d = drafts.value.get(a.answerId)
    if (!d || d.score == null) continue
    if (d.score < 0 || d.score > a.questionScore) {
      message.warning(
        t('coursework.assignment.itemScoreRange', { n: a.sortOrder, max: formatScore(a.questionScore) }),
      )
      return
    }
    items.push({ answerId: a.answerId, score: d.score, comment: d.comment.trim() || undefined })
  }
  if (!items.length) {
    message.warning(t('coursework.assignment.scoreRequired'))
    return
  }
  return withSaving(async () => {
    try {
      await gradeSubmission(id, {
        items,
        comment: overallComment.value.trim() || undefined,
      })
      message.success(t('coursework.assignment.gradeSuccess'))
      emit('update:show', false)
      emit('graded')
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.operationFail'))
      }
    }
  })
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="coursework-modal-answer"
    :title="t('coursework.assignment.gradeTitle')"
    @update:show="emit('update:show', $event)"
  >
    <div v-if="detail" class="grade-body">
      <NDescriptions :column="3" label-placement="left" bordered size="small">
        <NDescriptionsItem :label="t('coursework.assignment.studentNo')">
          {{ detail.studentNo }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="t('coursework.assignment.studentName')">
          {{ detail.studentName }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="t('coursework.assignment.submitStatus')">
          <NTag :type="submissionStatusTagType(detail.status)" size="small" :bordered="false">
            {{ detail.status }}
          </NTag>
        </NDescriptionsItem>
        <NDescriptionsItem :label="t('coursework.assignment.submitTime')">
          {{ formatDateTime(detail.submitTime) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="t('coursework.assignment.late')">
          {{ t(detail.late === 1 ? 'coursework.assignment.lateYes' : 'coursework.assignment.lateNo') }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="t('coursework.assignment.autoScore')">
          {{ detail.autoScore == null ? '-' : formatScore(detail.autoScore) }}
        </NDescriptionsItem>
      </NDescriptions>

      <div v-for="a in sortedAnswers" :key="a.answerId" class="question-card">
        <div class="question-header">
          <NText strong>{{ t('coursework.answer.questionN', { n: a.sortOrder }) }}</NText>
          <NTag :type="questionTypeTagType(a.type)" size="small" :bordered="false">
            {{ t(questionTypeLabelKey(a.type)) }}
          </NTag>
          <NTag size="small" :bordered="false">
            {{ t('coursework.question.scoreWithValue', { score: formatScore(a.questionScore) }) }}
          </NTag>
          <NTag v-if="a.type !== 'ESSAY'" size="small" type="info" :bordered="false">
            {{ t('coursework.answer.autoScored', { score: formatScore(a.autoScore) }) }}
          </NTag>
          <NTag
            v-else-if="a.requireFile"
            size="small"
            type="warning"
            :bordered="false"
          >
            {{ t('coursework.question.requireFileBadge') }}
          </NTag>
        </div>
        <div class="question-stem">{{ a.stem }}</div>

        <!-- 客观题:只读对照(不可改判) -->
        <template v-if="a.type !== 'ESSAY'">
          <div class="answer-line">
            <NText depth="3">{{ t('coursework.answer.myAnswer') }}：</NText>
            <NText>{{ objectiveText(a.myAnswer, a) }}</NText>
          </div>
          <div class="answer-line">
            <NText depth="3">{{ t('coursework.answer.standardAnswer') }}：</NText>
            <NText class="essay-text">{{ standardText(a) }}</NText>
          </div>
          <div v-if="a.analysis" class="answer-line">
            <NText depth="3">{{ t('coursework.question.analysis') }}：</NText>
            <NText class="essay-text">{{ a.analysis }}</NText>
          </div>
        </template>

        <!-- 大题:作答 + 给分 + 逐题评语 -->
        <template v-else>
          <div class="answer-line">
            <NText depth="3">{{ t('coursework.answer.myAnswer') }}：</NText>
            <NText class="essay-text">{{ essayOf(a)?.text || t('coursework.answer.unanswered') }}</NText>
          </div>
          <div v-if="essayOf(a)?.files?.length" class="essay-files">
            <div v-for="file in essayOf(a)?.files ?? []" :key="file.path" class="essay-file-item">
              <NButton size="small" @click="handlePreview(file)">
                {{ file.original }}
              </NButton>
              <NButton size="small" quaternary @click="handleDownload(file)">
                {{ t('coursework.common.download') }}
              </NButton>
            </div>
          </div>
          <div v-if="a.standardAnswer != null" class="answer-line">
            <NText depth="3">{{ t('coursework.question.referenceAnswer') }}：</NText>
            <NText class="essay-text">{{ asStringAnswer(a.standardAnswer) }}</NText>
          </div>
          <div class="grade-inputs">
            <NInputNumber
              :value="draftOf(a.answerId).score"
              :min="0"
              :max="a.questionScore"
              :show-button="false"
              :placeholder="`0-${formatScore(a.questionScore)}`"
              class="grade-score-input"
              @update:value="(v) => setDraftScore(a.answerId, v)"
            />
            <NInput
              :value="draftOf(a.answerId).comment"
              :placeholder="t('coursework.assignment.commentPlaceholder')"
              @update:value="(v) => setDraftComment(a.answerId, v)"
            />
          </div>
        </template>
      </div>

      <NInput
        v-if="hasEssay"
        v-model:value="overallComment"
        type="textarea"
        :rows="2"
        :placeholder="t('coursework.assignment.overallCommentPlaceholder')"
      />
    </div>
    <div v-else class="grade-loading"></div>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">{{ t('coursework.player.close') }}</NButton>
        <NButton v-if="hasEssay" type="primary" :loading="saving" @click="handleGrade">
          {{ t('coursework.assignment.gradeSubmit') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>

  <FilePreviewModal v-model:show="showPreview" :file="previewFile" />
</template>

<style scoped src="./MySubmissionModal.css"></style>
<style scoped src="./SubmissionGradeModal.css"></style>

<style>
.coursework-modal-answer {
  width: 900px;
  max-width: 96vw;
}
</style>
