<script setup lang="ts">
/**
 * 学生查看自己的提交:整份信息 + 逐题作答/得分/评语。
 *
 * 契约要点:
 * - my-submission 在**未提交时返回 data: null**(不是 404),用空态而非报错;
 * - `standardAnswer/analysis` 由后端按 answerVisible 四档门控 —— **为 null 就不渲染该区域**,
 *   前端不做任何时间/状态推断(门控口径以后端为准);
 * - 客观题 finalScore=autoScore;大题 finalScore=null 表示「待批」。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NDescriptions,
  NDescriptionsItem,
  NButton,
  NSpace,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { formatDateTime, formatScore } from '@/shared/utils/format'
import FilePreviewModal from '@/modules/file/components/FilePreviewModal.vue'
import type { PreviewFileTarget } from '@/modules/file/preview'
import { downloadCourseFile } from '../api'
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
import type { AnswerView, EssayAnswerFile, SubmissionView } from '../types'

const props = defineProps<{
  show: boolean
  submission: SubmissionView | null
}>()

const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const { t } = useI18n()
const message = useMessage()

const hasScore = computed(() => props.submission?.score != null)
const sortedAnswers = computed(() =>
  (props.submission?.answers ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
)

/** 客观题的我的作答展示文本(大题走专门区域,返回 '') */
function myAnswerText(a: AnswerView): string {
  switch (a.type) {
    case 'SINGLE_CHOICE':
      return asStringAnswer(a.myAnswer) ?? t('coursework.answer.unanswered')
    case 'MULTI_CHOICE': {
      const keys = asStringArrayAnswer(a.myAnswer)
      return keys.length ? keys.join('、') : t('coursework.answer.unanswered')
    }
    case 'JUDGE': {
      const v = asBooleanAnswer(a.myAnswer)
      if (v == null) return t('coursework.answer.unanswered')
      return t(v ? 'coursework.question.judgeTrue' : 'coursework.question.judgeFalse')
    }
    case 'FILL_BLANK': {
      const blanks = asStringArrayAnswer(a.myAnswer)
      return blanks.length ? blanks.join('；') : t('coursework.answer.unanswered')
    }
    case 'ESSAY':
      return ''
  }
}

/** 标准答案展示文本(仅 standardAnswer 非 null 时调用) */
function standardAnswerText(a: AnswerView): string {
  switch (a.type) {
    case 'SINGLE_CHOICE':
      return asStringAnswer(a.standardAnswer) ?? ''
    case 'MULTI_CHOICE':
      return asStringArrayAnswer(a.standardAnswer).join('、')
    case 'JUDGE': {
      const v = asBooleanAnswer(a.standardAnswer)
      return v == null ? '' : t(v ? 'coursework.question.judgeTrue' : 'coursework.question.judgeFalse')
    }
    case 'FILL_BLANK': {
      const std = asFillBlankStandard(a.standardAnswer)
      if (!std) return ''
      return std.blanks.map((group) => group.join(' / ')).join('；')
    }
    case 'ESSAY':
      return asStringAnswer(a.standardAnswer) ?? ''
  }
}

/** 大题作答(文本 + 附件) */
function essayOf(a: AnswerView) {
  return asEssayAnswer(a.myAnswer)
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
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="coursework-modal-answer"
    :title="t('coursework.assignment.mySubmissionTitle')"
    @update:show="emit('update:show', $event)"
  >
    <NText v-if="!submission" depth="3">
      {{ t('coursework.assignment.noSubmission') }}
    </NText>
    <div v-else class="submission-body">
      <NDescriptions :column="2" label-placement="left" bordered size="small">
        <NDescriptionsItem :label="t('coursework.assignment.submitStatus')">
          <NTag :type="submissionStatusTagType(submission.status)" size="small" :bordered="false">
            {{ submission.status }}
          </NTag>
        </NDescriptionsItem>
        <NDescriptionsItem :label="t('coursework.assignment.submitTime')">
          {{ formatDateTime(submission.submitTime) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="t('coursework.assignment.version')">
          {{ t('coursework.assignment.version', { version: submission.version }) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="t('coursework.assignment.late')">
          {{
            t(submission.late === 1 ? 'coursework.assignment.lateYes' : 'coursework.assignment.lateNo')
          }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="t('coursework.assignment.score')">
          {{ hasScore ? formatScore(submission.score) : '-' }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="t('coursework.assignment.autoScore')">
          {{ submission.autoScore == null ? '-' : formatScore(submission.autoScore) }}
        </NDescriptionsItem>
        <NDescriptionsItem :label="t('coursework.assignment.comment')" :span="2">
          {{ submission.comment || '-' }}
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
          <NTag v-if="a.finalScore != null" size="small" type="success" :bordered="false">
            {{ t('coursework.answer.gotScore', { score: formatScore(a.finalScore) }) }}
          </NTag>
          <NTag v-else size="small" type="warning" :bordered="false">
            {{ t('coursework.answer.pendingGrade') }}
          </NTag>
        </div>
        <div class="question-stem">{{ a.stem }}</div>

        <!-- 客观题:我的作答一行 -->
        <div v-if="a.type !== 'ESSAY'" class="answer-line">
          <NText depth="3">{{ t('coursework.answer.myAnswer') }}：</NText>
          <NText>{{ myAnswerText(a) }}</NText>
        </div>
        <!-- 大题:文本 + 附件下载 -->
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
        </template>

        <div v-if="a.comment" class="answer-line">
          <NText depth="3">{{ t('coursework.answer.itemComment') }}：</NText>
          <NText>{{ a.comment }}</NText>
        </div>
        <!-- 标准答案/解析:后端门控,为 null 不渲染 -->
        <div v-if="a.standardAnswer != null" class="answer-line">
          <NText depth="3">{{ t('coursework.answer.standardAnswer') }}：</NText>
          <NText class="essay-text">{{ standardAnswerText(a) }}</NText>
        </div>
        <div v-if="a.analysis != null" class="answer-line">
          <NText depth="3">{{ t('coursework.question.analysis') }}：</NText>
          <NText class="essay-text">{{ a.analysis }}</NText>
        </div>
      </div>
    </div>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">{{ t('coursework.player.close') }}</NButton>
      </NSpace>
    </template>
  </NModal>

  <FilePreviewModal v-model:show="showPreview" :file="previewFile" />
</template>

<style scoped src="./MySubmissionModal.css"></style>

<style>
.coursework-modal-answer {
  width: 900px;
  max-width: 96vw;
}
</style>
