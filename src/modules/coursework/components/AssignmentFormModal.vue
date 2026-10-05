<script setup lang="ts">
/**
 * 教师新建/编辑作业弹窗(在线作答版)。
 *
 * 契约要点(docs/在线作答作业-前端接口文档.md):
 * - **满分不可填**:totalScore 入参被忽略,总分 = Σ 题目配分,这里只做实时预览;
 * - 题目两个来源:**题库抽题**(可逐题覆盖配分)与**直接录入**(默认同步入题库),
 *   顺序 = 题库抽题序 + 直接录入序;
 * - **已发布作业不可改题**(传题目字段 400),只能延长截止/改标题说明/答案可见性,
 *   故已发布时题目区只读;
 * - 编辑草稿时的题目语义是**全量替换**:预填现有题目,只有动过题目区(questionsDirty)
 *   才传 questionIds/newQuestions —— 只改标题不动题目,后端保留原题;
 * - publish=true 时至少 1 题且总分 >0(后端 400,本地先拦);
 * - 附件是独立的一次覆盖写(POST /{id}/attachment),编辑时「改字段」与「换附件」是两次请求。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NDatePicker,
  NUpload,
  NButton,
  NSpace,
  NCheckbox,
  NSelect,
  NTag,
  NText,
  useMessage,
  type UploadFileInfo,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { formatScore } from '@/shared/utils/format'
import { useLoading } from '@/shared/composables/useLoading'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { prepareSubmitFile } from '@/modules/file/submit'
import { bizAccept, validateFileForBiz } from '@/modules/file/validate'
import {
  createAssignment,
  fetchAssignmentDetail,
  replaceAssignmentAttachment,
  updateAssignment,
} from '../api'
import { ASSIGNMENT_BIZ } from '../constants'
import { questionFormFromAssignment, toQuestionInput } from '../questionForm'
import {
  answerVisibleLabelKey,
  parseServerTime,
  questionTypeLabelKey,
  questionTypeTagType,
} from '../utils'
import QuestionFormModal from './QuestionFormModal.vue'
import QuestionBankPickerModal from './QuestionBankPickerModal.vue'
import type { QuestionFormValue } from '../questionForm'
import type { AnswerVisible, AssignmentView, QuestionView } from '../types'

const props = defineProps<{
  show: boolean
  courseId: number
  /** null = 新建;非 null = 编辑该作业 */
  assignment: AssignmentView | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const message = useMessage()
const localeStore = useLocaleStore()
const dateLocale = computed(() => localeStore.naiveConfig().dateLocale)

const isEdit = computed(() => props.assignment !== null)
/** 已发布:截止只能往后延、题目锁定 */
const isPublished = computed(() => props.assignment?.status === '已发布')

const form = ref<{
  title: string
  content: string
  deadline: string | null
  publish: boolean
  answerVisible: AnswerVisible
}>({ title: '', content: '', deadline: null, publish: false, answerVisible: 'SUBMIT' })

const fileList = ref<UploadFileInfo[]>([])
const { loading: saving, withLoading: withSaving } = useLoading()

// ---- 题目配置 ----

/** 题库抽题:score 为 null = 用题库默认配分 */
interface BankPick {
  question: QuestionView
  score: number | null
}

const bankPicks = ref<BankPick[]>([])
const newQuestions = ref<QuestionFormValue[]>([])
/** 编辑模式下是否动过题目区:没动就不传题目字段,后端保留原题 */
const questionsDirty = ref(false)

const showPicker = ref(false)
const showQuestionForm = ref(false)
/** 正在编辑的直接录入题目下标,null = 新建 */
const editingQuestionIndex = ref<number | null>(null)
const editingQuestion = ref<QuestionFormValue | null>(null)

const answerVisibleOptions = computed(() =>
  (['SUBMIT', 'DEADLINE', 'CLOSED', 'NEVER'] as AnswerVisible[]).map((code) => ({
    label: t(answerVisibleLabelKey(code)),
    value: code,
  })),
)

const pickedBankIds = computed(() => bankPicks.value.map((p) => p.question.id))

/** 总分预览 = Σ 抽题配分(覆盖值优先,否则题库默认)+ Σ 直录配分 */
const totalPreview = computed(() => {
  const fromBank = bankPicks.value.reduce(
    (sum, p) => sum + (p.score ?? p.question.defaultScore ?? 0),
    0,
  )
  const fromNew = newQuestions.value.reduce((sum, q) => sum + (q.score ?? 0), 0)
  return fromBank + fromNew
})

const questionCount = computed(() => bankPicks.value.length + newQuestions.value.length)

/** 每次打开按当前入参重置表单,避免上一次的残留 */
watch(
  () => [props.show, props.assignment] as const,
  ([show]) => {
    if (!show) return
    const a = props.assignment
    form.value = a
      ? {
          title: a.title,
          content: a.content ?? '',
          deadline: a.deadline,
          publish: false,
          answerVisible: a.answerVisible ?? 'SUBMIT',
        }
      : { title: '', content: '', deadline: null, publish: false, answerVisible: 'SUBMIT' }
    fileList.value = []
    bankPicks.value = []
    newQuestions.value = []
    questionsDirty.value = false
    // 编辑草稿:预填现有题目为「直接录入」形态(快照无题库溯源字段,统一按直录回显;
    // saveToBank=false 防止保存时把题库原题重复录入题库)。已发布不回填(题目区只读)。
    if (a && a.status === '草稿') {
      void (async () => {
        try {
          const res = await fetchAssignmentDetail(a.id)
          newQuestions.value = (res.data.questions ?? []).map((q) => ({
            ...questionFormFromAssignment(q),
            saveToBank: false,
          }))
        } catch {
          // 预填失败不阻断编辑:不动题目区就不会触碰题目
        }
      })()
    }
  },
  { immediate: true },
)

function close(): void {
  emit('update:show', false)
}

/** 已发布作业的截止时间只能往后延;后端会以 400 拒绝,这里提前拦住给出可读提示 */
function deadlineTooEarly(deadline: string): boolean {
  const original = parseServerTime(props.assignment?.deadline)
  const next = parseServerTime(deadline)
  if (!original || !next) return false
  return next.getTime() < original.getTime()
}

// ---- 题目区操作(任何变动都置 questionsDirty) ----

function openPicker(): void {
  showPicker.value = true
}

function handlePickConfirm(questions: QuestionView[]): void {
  for (const q of questions) {
    if (!pickedBankIds.value.includes(q.id)) {
      bankPicks.value.push({ question: q, score: null })
    }
  }
  if (questions.length) questionsDirty.value = true
}

function removeBankPick(index: number): void {
  bankPicks.value.splice(index, 1)
  questionsDirty.value = true
}

function moveBankPick(index: number, delta: number): void {
  const target = index + delta
  if (target < 0 || target >= bankPicks.value.length) return
  const [item] = bankPicks.value.splice(index, 1)
  if (item) bankPicks.value.splice(target, 0, item)
  questionsDirty.value = true
}

function openQuestionCreate(): void {
  editingQuestionIndex.value = null
  editingQuestion.value = null
  showQuestionForm.value = true
}

function openQuestionEdit(index: number): void {
  editingQuestionIndex.value = index
  editingQuestion.value = newQuestions.value[index] ?? null
  showQuestionForm.value = true
}

function handleQuestionSubmit(value: QuestionFormValue): void {
  if (editingQuestionIndex.value != null) {
    newQuestions.value.splice(editingQuestionIndex.value, 1, value)
  } else {
    newQuestions.value.push(value)
  }
  questionsDirty.value = true
}

function removeNewQuestion(index: number): void {
  newQuestions.value.splice(index, 1)
  questionsDirty.value = true
}

function moveNewQuestion(index: number, delta: number): void {
  const target = index + delta
  if (target < 0 || target >= newQuestions.value.length) return
  const [item] = newQuestions.value.splice(index, 1)
  if (item) newQuestions.value.splice(target, 0, item)
  questionsDirty.value = true
}

function handleSave() {
  const f = form.value
  // data 里的必填字段缺失只会得到笼统的 400「请求体格式错误」,所以本地必须先校验
  if (!f.title.trim()) {
    message.warning(t('coursework.assignment.titleRequired'))
    return
  }
  // 收成局部常量:后面还要穿过若干次 await,靠属性收窄拿不到 string
  const deadline = f.deadline
  if (!deadline) {
    message.warning(t('coursework.assignment.deadlineRequired'))
    return
  }
  if (isPublished.value && deadlineTooEarly(deadline)) {
    message.warning(t('coursework.assignment.deadlineOnlyExtend'))
    return
  }
  // 发布校验(后端 400,本地先拦):至少 1 题且总分 >0
  if (!isEdit.value && f.publish && (questionCount.value === 0 || totalPreview.value <= 0)) {
    message.warning(t('coursework.assignment.questionsRequired'))
    return
  }

  const raw = fileList.value[0]?.file ?? null
  if (raw) {
    const err = validateFileForBiz(raw, ASSIGNMENT_BIZ)
    if (err) {
      message.warning(t(`file.error.${err}`))
      return
    }
  }

  return withSaving(async () => {
    try {
      // ≤20MB 走 multipart 整传;>20MB 自动分片上传,进度见右下角面板
      const prepared = await prepareSubmitFile(raw, ASSIGNMENT_BIZ)
      const current = props.assignment
      if (current) {
        await updateAssignment(current.id, {
          title: f.title.trim(),
          content: f.content,
          deadline,
          answerVisible: f.answerVisible,
          // 没动题目区就不传题目字段(后端保留原题);已发布作业题目区只读,不会置脏
          ...(questionsDirty.value
            ? {
                questionIds: bankPicks.value.map((p) => ({
                  questionId: p.question.id,
                  score: p.score ?? undefined,
                })),
                newQuestions: newQuestions.value.map((q) => toQuestionInput(q)),
              }
            : {}),
        })
        // 附件是独立端点;没选新文件就保留原附件
        if (prepared.file || prepared.filePath) {
          await replaceAssignmentAttachment(current.id, prepared)
        }
      } else {
        await createAssignment(
          {
            teachInfoId: props.courseId,
            title: f.title.trim(),
            content: f.content,
            deadline,
            publish: f.publish,
            answerVisible: f.answerVisible,
            questionIds: bankPicks.value.map((p) => ({
              questionId: p.question.id,
              score: p.score ?? undefined,
            })),
            newQuestions: newQuestions.value.map((q) => toQuestionInput(q)),
          },
          prepared,
        )
      }
      message.success(t('coursework.common.operationSuccess'))
      close()
      emit('saved')
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
    class="coursework-modal-form"
    :title="isEdit ? t('coursework.assignment.editTitle') : t('coursework.assignment.addTitle')"
    @update:show="emit('update:show', $event)"
  >
    <NForm :model="form" label-placement="top">
      <NFormItem :label="t('coursework.assignment.title')" required>
        <NInput v-model:value="form.title" maxlength="100" show-count />
      </NFormItem>
      <NFormItem :label="t('coursework.assignment.content')">
        <NInput v-model:value="form.content" type="textarea" :rows="3" />
      </NFormItem>
      <NFormItem :label="t('coursework.assignment.deadline')" required>
        <NDatePicker
          v-model:formatted-value="form.deadline"
          type="datetime"
          value-format="yyyy-MM-dd'T'HH:mm:ss"
          :locale="dateLocale"
          clearable
          class="full-width"
        />
      </NFormItem>
      <NFormItem :label="t('coursework.assignment.answerVisible')">
        <NSelect
          v-model:value="form.answerVisible"
          :options="answerVisibleOptions"
          class="full-width"
        />
      </NFormItem>

      <!-- 题目配置:已发布只读(后端 400),草稿/新建可配 -->
      <NFormItem :label="t('coursework.assignment.questions')">
        <div class="question-config">
          <NText v-if="isPublished" depth="3" class="upload-hint">
            {{ t('coursework.assignment.questionsLocked', { score: formatScore(assignment?.totalScore) }) }}
          </NText>
          <template v-else>
            <div class="question-group">
              <div class="question-group-header">
                <NText depth="3">{{ t('coursework.assignment.bankPicks') }}</NText>
                <NButton size="small" @click="openPicker">
                  {{ t('coursework.assignment.pickFromBank') }}
                </NButton>
              </div>
              <NText v-if="!bankPicks.length" class="question-empty">
                {{ t('coursework.assignment.noBankPicks') }}
              </NText>
              <div v-for="(pick, index) in bankPicks" :key="pick.question.id" class="question-item">
                <NTag :type="questionTypeTagType(pick.question.type)" size="small" :bordered="false">
                  {{ t(questionTypeLabelKey(pick.question.type)) }}
                </NTag>
                <span class="question-item-stem" :title="pick.question.stem">
                  {{ pick.question.stem }}
                </span>
                <NInputNumber
                  v-model:value="pick.score"
                  :min="0.5"
                  :max="1000"
                  :show-button="false"
                  :placeholder="t('coursework.assignment.scoreDefault', { score: formatScore(pick.question.defaultScore) })"
                  class="question-item-score"
                  @update:value="questionsDirty = true"
                />
                <NButton size="tiny" quaternary :disabled="index === 0" @click="moveBankPick(index, -1)">
                  ↑
                </NButton>
                <NButton
                  size="tiny"
                  quaternary
                  :disabled="index === bankPicks.length - 1"
                  @click="moveBankPick(index, 1)"
                >
                  ↓
                </NButton>
                <NButton size="tiny" quaternary type="error" @click="removeBankPick(index)">
                  {{ t('coursework.common.delete') }}
                </NButton>
              </div>
            </div>
            <div class="question-group">
              <div class="question-group-header">
                <NText depth="3">{{ t('coursework.assignment.newQuestions') }}</NText>
                <NButton size="small" @click="openQuestionCreate">
                  {{ t('coursework.question.addTitle') }}
                </NButton>
              </div>
              <NText v-if="!newQuestions.length" class="question-empty">
                {{ t('coursework.assignment.noNewQuestions') }}
              </NText>
              <div v-for="(question, index) in newQuestions" :key="index" class="question-item">
                <NTag :type="questionTypeTagType(question.type)" size="small" :bordered="false">
                  {{ t(questionTypeLabelKey(question.type)) }}
                </NTag>
                <span class="question-item-stem" :title="question.stem">{{ question.stem }}</span>
                <NTag size="small" :bordered="false">
                  {{ t('coursework.question.scoreWithValue', { score: formatScore(question.score) }) }}
                </NTag>
                <NButton size="tiny" quaternary :disabled="index === 0" @click="moveNewQuestion(index, -1)">
                  ↑
                </NButton>
                <NButton
                  size="tiny"
                  quaternary
                  :disabled="index === newQuestions.length - 1"
                  @click="moveNewQuestion(index, 1)"
                >
                  ↓
                </NButton>
                <NButton size="tiny" quaternary @click="openQuestionEdit(index)">
                  {{ t('coursework.common.edit') }}
                </NButton>
                <NButton size="tiny" quaternary type="error" @click="removeNewQuestion(index)">
                  {{ t('coursework.common.delete') }}
                </NButton>
              </div>
            </div>
            <div class="question-total">
              <NText depth="3">{{ t('coursework.assignment.questionOrderTip') }}</NText>
              <NText strong>
                {{ t('coursework.assignment.totalPreview', { score: formatScore(totalPreview) }) }}
              </NText>
            </div>
          </template>
        </div>
      </NFormItem>

      <NFormItem :label="t('coursework.assignment.attachment')">
        <div class="upload-block">
          <NText v-if="assignment?.fileOriginal" depth="3" class="upload-current">
            {{ t('coursework.assignment.currentAttachment') }}：{{ assignment.fileOriginal }}
          </NText>
          <NUpload
            v-model:file-list="fileList"
            :accept="bizAccept(ASSIGNMENT_BIZ)"
            :max="1"
            :default-upload="false"
          >
            <NButton>{{ t('coursework.common.selectFile') }}</NButton>
          </NUpload>
        </div>
      </NFormItem>
      <NFormItem v-if="!isEdit">
        <NCheckbox v-model:checked="form.publish">
          {{ t('coursework.assignment.publishNow') }}
        </NCheckbox>
        <NText depth="3" class="upload-hint">{{ t('coursework.assignment.publishNowTip') }}</NText>
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="close">{{ t('coursework.common.cancel') }}</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">
          {{ t('coursework.common.save') }}
        </NButton>
      </NSpace>
    </template>

    <QuestionBankPickerModal
      v-model:show="showPicker"
      :picked-ids="pickedBankIds"
      @confirm="handlePickConfirm"
    />
    <QuestionFormModal
      v-model:show="showQuestionForm"
      mode="assignment"
      :initial="editingQuestion"
      @submit="handleQuestionSubmit"
    />
  </NModal>
</template>

<style scoped src="./AssignmentFormModal.css"></style>

<style>
.coursework-modal-form {
  width: 900px;
  max-width: 96vw;
}
</style>
