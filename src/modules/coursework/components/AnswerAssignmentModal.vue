<script setup lang="ts">
/**
 * 学生在线作答弹窗(学习通式逐题作答,替代旧的文本+附件提交)。
 *
 * 数据流(docs/在线作答作业-前端接口文档.md §6.2):
 * 1. 打开即 GET /assignments/{id}(服务端记「已查看」),questions 渲染题目;
 *    未提交时 myAnswer 回显 Redis 草稿,重交(mySubmissionId != null)时改从 my-submission 预填;
 * 2. 作答变动 → 800ms 防抖 PUT /{id}/draft(整体覆盖,只写 Redis);
 * 3. 提交前先校验 requireFile、把大题新选附件传成 {path, original},再纯 JSON POST submit;
 * 4. 题型组件按详情 questionTypes 条件渲染(defineAsyncComponent,没出现的题型不会加载)。
 *
 * 答案状态模型:每题一行 QuestionState,五种题型各占一个字段(只用属于本题型那个),
 * 这样 v-model 绑定全程类型安全,也不需要索引签名(项目开着 noUncheckedIndexedAccess)。
 */
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NAlert,
  NButton,
  NSpace,
  NTag,
  NText,
  useMessage,
  type UploadFileInfo,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { formatDateTime, formatScore } from '@/shared/utils/format'
import { useLoading } from '@/shared/composables/useLoading'
import { uploadForStoredRef } from '@/modules/file/submit'
import { validateFileForBiz } from '@/modules/file/validate'
import FilePreviewModal from '@/modules/file/components/FilePreviewModal.vue'
import type { PreviewFileTarget } from '@/modules/file/preview'
import {
  downloadCourseFile,
  fetchAssignmentDetail,
  fetchMySubmission,
  saveAssignmentDraft,
  submitAssignment,
} from '../api'
import { SUBMISSION_BIZ } from '../constants'
import {
  asBooleanAnswer,
  asEssayAnswer,
  asStringAnswer,
  asStringArrayAnswer,
  multiScoreRuleLabelKey,
  questionTypeLabelKey,
  questionTypeTagType,
} from '../utils'
import type {
  AnswerInput,
  AssignmentQuestionView,
  AssignmentView,
  EssayAnswerFile,
  QuestionAnswerJson,
  QuestionType,
  SubmissionView,
} from '../types'

const SingleChoiceField = defineAsyncComponent(() => import('./answers/SingleChoiceField.vue'))
const MultiChoiceField = defineAsyncComponent(() => import('./answers/MultiChoiceField.vue'))
const JudgeField = defineAsyncComponent(() => import('./answers/JudgeField.vue'))
const FillBlankField = defineAsyncComponent(() => import('./answers/FillBlankField.vue'))
const EssayField = defineAsyncComponent(() => import('./answers/EssayField.vue'))

/** 一题的作答状态:五种题型各占一个字段,只使用本题型那个 */
interface QuestionState {
  question: AssignmentQuestionView
  single: string | null
  multi: string[]
  judge: boolean | null
  fill: string[]
  essay: {
    text: string
    /** 已上传的附件(上次提交遗留 / 本次已传),提交时直接进 answer.files */
    keptFiles: EssayAnswerFile[]
    /** 新选未传的本地文件,提交时才上传 */
    fileList: UploadFileInfo[]
  }
}

const props = defineProps<{
  show: boolean
  assignment: AssignmentView | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  submitted: []
}>()

const { t } = useI18n()
const message = useMessage()

const detail = ref<AssignmentView | null>(null)
const states = ref<QuestionState[]>([])
/** 重交时的上次提交(用于预填与「会清批改」提醒) */
const existing = ref<SubmissionView | null>(null)
const { loading: saving, withLoading: withSaving } = useLoading()

const draftStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const draftSavedAt = ref<string>('')
/** 预填期间暂停草稿 watcher,否则回显本身会触发一次无意义暂存 */
let suppressDraftWatch = true
let draftTimer: ReturnType<typeof setTimeout> | null = null

const isResubmit = computed(() => existing.value !== null)

const presentTypes = computed(() => new Set(detail.value?.questionTypes ?? []))

function hasType(type: QuestionType): boolean {
  return presentTypes.value.has(type)
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      void openAndLoad()
    } else {
      // 先压住草稿 watcher 再清空:否则清空 states 会触发一次 answers=[] 的暂存,
      // 把刚自动保存的草稿抹掉(取消作答后重进应能拿回草稿)
      suppressDraftWatch = true
      resetState()
    }
  },
)

function resetState(): void {
  // 防抖窗口里还没发出去的改动,清空状态前先补发一次 —— 否则「改完立刻关弹窗」
  // 会把最后一次编辑静默丢掉(docs §6.2:草稿以最后一次改动为准)。
  // persistDraft 同步取走 buildAnswers(),故紧跟着清空 states 是安全的。
  if (draftTimer) {
    clearTimeout(draftTimer)
    draftTimer = null
    void persistDraft()
  }
  detail.value = null
  states.value = []
  existing.value = null
  draftStatus.value = 'idle'
  draftSavedAt.value = ''
}

async function openAndLoad(): Promise<void> {
  const id = props.assignment?.id
  if (id == null) return
  suppressDraftWatch = true
  try {
    const res = await fetchAssignmentDetail(id)
    // 加载途中用户已关闭弹窗:丢弃结果,别复活一个已重置的状态
    if (!props.show) return
    detail.value = res.data
    const questions = (res.data.questions ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
    // 预填来源:已提交 -> my-submission 的逐题作答;未提交 -> 详情里的 Redis 草稿
    const prefill = new Map<number, QuestionAnswerJson | null>()
    if (res.data.mySubmissionId != null) {
      try {
        const mine = await fetchMySubmission(id)
        if (!props.show) return
        existing.value = mine.data
        for (const a of mine.data?.answers ?? []) {
          prefill.set(a.questionId, a.myAnswer)
        }
      } catch {
        // 预填失败不阻断作答:按空白开始
      }
    } else {
      for (const q of questions) prefill.set(q.id, q.myAnswer)
    }
    states.value = questions.map((q) => buildState(q, prefill.get(q.id) ?? null))
  } catch (e) {
    // 404(草稿/不存在)等错误已由 api 层提示;作答页打不开就关掉弹窗
    if (!isReportedError(e)) {
      message.error((e as Error).message || t('coursework.common.loadFail'))
    }
    emit('update:show', false)
    return
  } finally {
    // ★ 必须等 Vue 把上面 `states.value = ...` 排的 watcher 任务冲刷完再解禁 ——
    // watcher 是异步(post/pre 队列)执行的,直接在这里置 false 的话,
    // 预填本身会被当成一次「作答变动」,打开弹窗就白存一次草稿。
    await nextTick()
    suppressDraftWatch = false
  }
}

/** 由题目 + 预填答案(JSON 形状按题型)构造一题的作答状态 */
function buildState(q: AssignmentQuestionView, answer: QuestionAnswerJson | null): QuestionState {
  const essay = q.type === 'ESSAY' ? asEssayAnswer(answer) : null
  const fill = q.type === 'FILL_BLANK' ? asStringArrayAnswer(answer) : []
  const blankCount = q.blankCount ?? 0
  return {
    question: q,
    single: q.type === 'SINGLE_CHOICE' ? asStringAnswer(answer) : null,
    multi: q.type === 'MULTI_CHOICE' ? asStringArrayAnswer(answer) : [],
    judge: q.type === 'JUDGE' ? asBooleanAnswer(answer) : null,
    fill: Array.from({ length: blankCount }, (_, i) => fill[i] ?? ''),
    essay: {
      text: essay?.text ?? '',
      keptFiles: essay?.files ? [...essay.files] : [],
      fileList: [],
    },
  }
}

/** 把作答状态组装成全量答案(每题一条,未答为 null) */
function buildAnswers(): AnswerInput[] {
  return states.value.map((s) => {
    let answer: QuestionAnswerJson | null
    switch (s.question.type) {
      case 'SINGLE_CHOICE':
        answer = s.single
        break
      case 'MULTI_CHOICE':
        answer = s.multi.length ? [...s.multi] : null
        break
      case 'JUDGE':
        answer = s.judge
        break
      case 'FILL_BLANK': {
        const blanks = s.fill.map((v) => v.trim())
        answer = blanks.some((v) => v) ? blanks : null
        break
      }
      case 'ESSAY': {
        const text = s.essay.text.trim()
        const files = s.essay.keptFiles
        answer = text || files.length ? { text, files } : null
        break
      }
    }
    return { questionId: s.question.id, answer }
  })
}

// 作答变动 -> 800ms 防抖整体覆盖暂存(只写 Redis)
watch(
  states,
  () => {
    if (suppressDraftWatch) return
    scheduleDraftSave()
  },
  { deep: true },
)

function scheduleDraftSave(): void {
  // 已提交(重交场景)不暂存草稿:草稿只服务于未提交的学生 —— 详情接口的 myAnswer
  // 在已提交时恒为 null,写进去的草稿没有任何界面会读,只会在 Redis 里留一份残留。
  if (isResubmit.value) return
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    draftTimer = null
    void persistDraft()
  }, 800)
}

async function persistDraft(): Promise<void> {
  // 优先用已加载的详情 id:关闭弹窗时父级可能已经清掉 assignment,响应体里的 id 才是可靠的
  const id = detail.value?.id ?? props.assignment?.id
  if (id == null) return
  draftStatus.value = 'saving'
  try {
    await saveAssignmentDraft(id, { answers: buildAnswers() })
    draftStatus.value = 'saved'
    draftSavedAt.value = new Date().toLocaleTimeString()
  } catch {
    // 接口静默(后台请求不弹 toast),状态条显示失败,下次变动会再试
    draftStatus.value = 'error'
  }
}

function handleDownloadAttachment(): void {
  const d = detail.value
  const path = d?.fileName
  if (!d || !path) return
  void (async () => {
    try {
      await downloadCourseFile(path, d.fileOriginal)
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.downloadFail'))
      }
    }
  })()
}

/** 附件预览目标;点击文件名按钮打开预览弹窗,下载走旁边的独立按钮 */
const previewFile = ref<PreviewFileTarget | null>(null)
const showPreview = ref(false)

function handlePreviewAttachment(): void {
  const d = detail.value
  const path = d?.fileName
  if (!d || !path) return
  previewFile.value = { path, name: d.fileOriginal || path.split('/').pop() || path }
  showPreview.value = true
}

function handleSubmit() {
  const id = props.assignment?.id
  if (id == null || !states.value.length) return
  // requireFile 与附件白名单本地先拦,否则用户只会看到笼统的 400
  for (const s of states.value) {
    if (s.question.type !== 'ESSAY') continue
    if (s.question.requireFile && s.essay.keptFiles.length + s.essay.fileList.length === 0) {
      message.warning(t('coursework.answer.fileRequired', { n: s.question.sortOrder }))
      return
    }
    for (const f of s.essay.fileList) {
      const raw = f.file
      if (!raw) continue
      const err = validateFileForBiz(raw, SUBMISSION_BIZ)
      if (err) {
        message.warning(t(`file.error.${err}`))
        return
      }
    }
  }
  return withSaving(async () => {
    // ★ 提交全程压住草稿 watcher:下面会改写 essay 的附件状态,该改动会排入 watcher 队列,
    // 而 await 会让它在提交过程中就执行完 —— 不压住的话,提交后 resetState 会补发一次
    // 「最后改动」,把服务端刚清掉的 Redis 草稿原样写回去(文档 §6.2:提交 → 草稿自动清除)。
    suppressDraftWatch = true
    try {
      // 大题附件两步走:先把新选文件传成产物,再随答案提交 path(≤20MB 整传,>20MB 分片走面板)
      for (const s of states.value) {
        if (s.question.type !== 'ESSAY' || !s.essay.fileList.length) continue
        const uploaded: EssayAnswerFile[] = []
        for (const f of s.essay.fileList) {
          const raw = f.file
          if (!raw) continue
          const ref = await uploadForStoredRef(raw, SUBMISSION_BIZ)
          uploaded.push({ path: ref.storedPath, original: ref.originalName })
        }
        s.essay.keptFiles = [...s.essay.keptFiles, ...uploaded]
        s.essay.fileList = []
      }
      if (draftTimer) {
        clearTimeout(draftTimer)
        draftTimer = null
      }
      await submitAssignment(id, { answers: buildAnswers() })
      message.success(t('coursework.assignment.submitSuccess'))
      emit('update:show', false)
      emit('submitted')
    } catch (e) {
      // 提交失败要把自动保存放回来,否则用户接着改也不再暂存(改动会静默丢失)
      suppressDraftWatch = false
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
    :title="`${t('coursework.assignment.submitTitle')}${assignment ? ` - ${assignment.title}` : ''}`"
    @update:show="emit('update:show', $event)"
  >
    <div v-if="detail" class="answer-body">
      <NAlert v-if="isResubmit" type="warning" class="answer-alert">
        {{ t('coursework.assignment.resubmitTip') }}
      </NAlert>
      <div class="answer-meta">
        <NText depth="3">
          {{ t('coursework.assignment.deadline') }}：{{ formatDateTime(detail.deadline) }}
        </NText>
        <NText depth="3">
          {{ t('coursework.assignment.totalScore') }}：{{ formatScore(detail.totalScore) }}
        </NText>
        <template v-if="detail.fileName">
          <NButton size="small" @click="handlePreviewAttachment">
            {{ detail.fileOriginal || t('coursework.common.preview') }}
          </NButton>
          <NButton size="small" quaternary @click="handleDownloadAttachment">
            {{ t('coursework.common.download') }}
          </NButton>
        </template>
      </div>
      <NText v-if="detail.content" class="answer-content">{{ detail.content }}</NText>

      <div v-for="s in states" :key="s.question.id" class="question-card">
        <div class="question-header">
          <NText strong>{{ t('coursework.answer.questionN', { n: s.question.sortOrder }) }}</NText>
          <NTag :type="questionTypeTagType(s.question.type)" size="small" :bordered="false">
            {{ t(questionTypeLabelKey(s.question.type)) }}
          </NTag>
          <NTag size="small" :bordered="false">
            {{ t('coursework.question.scoreWithValue', { score: formatScore(s.question.score) }) }}
          </NTag>
          <NTag
            v-if="s.question.type === 'MULTI_CHOICE' && s.question.scoreRule"
            size="small"
            type="info"
            :bordered="false"
          >
            {{ t(multiScoreRuleLabelKey(s.question.scoreRule)) }}
          </NTag>
          <NTag
            v-if="s.question.type === 'FILL_BLANK' && s.question.caseSensitive"
            size="small"
            type="info"
            :bordered="false"
          >
            {{ t('coursework.question.caseSensitive') }}
          </NTag>
          <NTag
            v-if="s.question.type === 'ESSAY' && s.question.requireFile"
            size="small"
            type="warning"
            :bordered="false"
          >
            {{ t('coursework.question.requireFileBadge') }}
          </NTag>
        </div>
        <div class="question-stem">{{ s.question.stem }}</div>
        <SingleChoiceField
          v-if="s.question.type === 'SINGLE_CHOICE' && hasType('SINGLE_CHOICE')"
          v-model="s.single"
          :question="s.question"
        />
        <MultiChoiceField
          v-else-if="s.question.type === 'MULTI_CHOICE' && hasType('MULTI_CHOICE')"
          v-model="s.multi"
          :question="s.question"
        />
        <JudgeField
          v-else-if="s.question.type === 'JUDGE' && hasType('JUDGE')"
          v-model="s.judge"
          :question="s.question"
        />
        <FillBlankField
          v-else-if="s.question.type === 'FILL_BLANK' && hasType('FILL_BLANK')"
          v-model="s.fill"
          :question="s.question"
        />
        <EssayField
          v-else-if="s.question.type === 'ESSAY' && hasType('ESSAY')"
          v-model:text="s.essay.text"
          v-model:kept-files="s.essay.keptFiles"
          v-model:file-list="s.essay.fileList"
          :question="s.question"
        />
      </div>
      <NText v-if="!states.length" depth="3">{{ t('coursework.answer.noQuestions') }}</NText>
    </div>
    <div v-else class="answer-loading"></div>

    <template #footer>
      <div class="answer-footer">
        <NText v-if="draftStatus === 'saving'" depth="3" class="draft-status">
          {{ t('coursework.answer.draftSaving') }}
        </NText>
        <NText v-else-if="draftStatus === 'saved'" depth="3" class="draft-status">
          {{ t('coursework.answer.draftSaved', { time: draftSavedAt }) }}
        </NText>
        <NText v-else-if="draftStatus === 'error'" type="error" class="draft-status">
          {{ t('coursework.answer.draftError') }}
        </NText>
        <NSpace justify="end">
          <NButton @click="emit('update:show', false)">{{ t('coursework.common.cancel') }}</NButton>
          <NButton type="primary" :loading="saving" :disabled="!states.length" @click="handleSubmit">
            {{ t(isResubmit ? 'coursework.assignment.resubmit' : 'coursework.assignment.submit') }}
          </NButton>
        </NSpace>
      </div>
    </template>
  </NModal>

  <FilePreviewModal v-model:show="showPreview" :file="previewFile" />
</template>

<style scoped src="./AnswerAssignmentModal.css"></style>

<style>
.coursework-modal-answer {
  width: 900px;
  max-width: 96vw;
}
</style>
