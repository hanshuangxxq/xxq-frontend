/**
 * 题目表单(QuestionFormModal)的纯逻辑:表单状态模型、视图互转、校验。
 * 题库录入(QuestionSaveRequest)与作业直接录入(QuestionInput)共用同一套题目编辑器,
 * 差别只在配分字段(defaultScore vs score)与 saveToBank,故表单状态抽到这里集中管理。
 */
import type {
  AssignmentQuestionView,
  MultiScoreRule,
  OptionItem,
  QuestionInput,
  QuestionSaveRequest,
  QuestionType,
  QuestionView,
} from './types'
import {
  asFillBlankStandard,
  asStringAnswer,
  asStringArrayAnswer,
  courseTagFields,
  courseTagKeyOf,
} from './utils'

/** 题目表单的扁平编辑状态(按题型取用对应字段) */
export interface QuestionFormValue {
  type: QuestionType
  stem: string
  /** 选择题选项(key 由行序自动生成 A/B/C...) */
  options: OptionItem[]
  /** 单选正确选项 key */
  singleAnswer: string | null
  /** 多选正确选项 key 列表(≥2) */
  multiAnswer: string[]
  /** 多选计分规则 */
  scoreRule: MultiScoreRule
  /** 判断题答案 */
  judgeAnswer: boolean | null
  /** 填空:每空一组可接受答案 */
  blanks: string[][]
  /** 填空:按顺序作答(false = 可乱序) */
  ordered: boolean
  /** 填空:区分大小写 */
  caseSensitive: boolean
  /** 大题参考答案(可空) */
  essayReference: string
  /** 大题必须上传附件 */
  requireFile: boolean
  analysis: string
  /**
   * 课程标签:课程复合键 `source:id`(常规课 MANUAL / 公选活动 SELECTION_CAMPAIGN),null = 不设置。
   * 仅题库模式录入 —— 后端的课程标签挂在题库记录上,作业题目快照不存该字段。
   */
  courseTag: string | null
  /** 题库模式:默认配分 */
  defaultScore: number | null
  /** 作业模式:本题配分 */
  score: number | null
  /** 作业模式:同步入本人题库 */
  saveToBank: boolean
}

/** 选项 key 自动生成:0->A、1->B...(后端大小写不敏感去重) */
export function optionKeyOf(index: number): string {
  return String.fromCharCode(65 + index)
}

/** 最大选项数(Z 之后没有直觉字母,也没有真实场景) */
export const MAX_OPTIONS = 8
/** 填空题空位数上限(与「每题附件 ≤3」同类的防呆边界) */
export const MAX_BLANKS = 10

/** 指定题型的空白表单 */
export function emptyQuestionForm(type: QuestionType): QuestionFormValue {
  return {
    type,
    stem: '',
    options:
      type === 'SINGLE_CHOICE' || type === 'MULTI_CHOICE'
        ? [
            { key: 'A', text: '' },
            { key: 'B', text: '' },
          ]
        : [],
    singleAnswer: null,
    multiAnswer: [],
    scoreRule: 'HALF_ON_PARTIAL',
    judgeAnswer: null,
    blanks: type === 'FILL_BLANK' ? [['']] : [],
    ordered: true,
    caseSensitive: false,
    essayReference: '',
    requireFile: false,
    analysis: '',
    courseTag: null,
    defaultScore: 5,
    score: null,
    saveToBank: true,
  }
}

/** 题库题目 -> 表单(题库编辑回显) */
export function questionFormFromBank(q: QuestionView): QuestionFormValue {
  return fillFromPayload(emptyQuestionForm(q.type), {
    stem: q.stem,
    options: q.options ?? [],
    answer: q.answer,
    analysis: q.analysis ?? '',
    scoreRule: q.scoreRule ?? 'HALF_ON_PARTIAL',
    caseSensitive: q.caseSensitive === true,
    requireFile: q.requireFile === true,
    courseTag: courseTagKeyOf(q),
    defaultScore: q.defaultScore,
  })
}

/** 作业题目快照 -> 表单(作业表单里编辑已录题目回显) */
export function questionFormFromAssignment(q: AssignmentQuestionView): QuestionFormValue {
  return fillFromPayload(emptyQuestionForm(q.type), {
    stem: q.stem,
    options: q.options ?? [],
    answer: q.answer,
    analysis: q.analysis ?? '',
    scoreRule: q.scoreRule ?? 'HALF_ON_PARTIAL',
    caseSensitive: q.caseSensitive === true,
    requireFile: q.requireFile === true,
    score: q.score,
  })
}

interface PayloadParts {
  stem: string
  options: OptionItem[]
  answer: QuestionView['answer']
  analysis: string
  scoreRule: MultiScoreRule
  caseSensitive: boolean
  requireFile: boolean
  /** 课程标签复合键;作业快照不带该字段,故只有题库来源会传 */
  courseTag?: string | null
  defaultScore?: number
  score?: number
}

/** 把视图字段摊进扁平表单(标准答案按题型拆到对应字段) */
function fillFromPayload(form: QuestionFormValue, p: PayloadParts): QuestionFormValue {
  form.stem = p.stem
  form.analysis = p.analysis
  form.scoreRule = p.scoreRule
  form.caseSensitive = p.caseSensitive
  form.requireFile = p.requireFile
  form.courseTag = p.courseTag ?? null
  if (p.defaultScore != null) form.defaultScore = p.defaultScore
  if (p.score != null) form.score = p.score
  switch (form.type) {
    case 'SINGLE_CHOICE':
      form.options = p.options.length ? p.options.map((o) => ({ ...o })) : form.options
      form.singleAnswer = asStringAnswer(p.answer)
      break
    case 'MULTI_CHOICE':
      form.options = p.options.length ? p.options.map((o) => ({ ...o })) : form.options
      form.multiAnswer = asStringArrayAnswer(p.answer)
      break
    case 'JUDGE':
      form.judgeAnswer = typeof p.answer === 'boolean' ? p.answer : null
      break
    case 'FILL_BLANK': {
      const std = asFillBlankStandard(p.answer)
      if (std) {
        form.blanks = std.blanks.map((group) => [...group])
        form.ordered = std.ordered
      }
      break
    }
    case 'ESSAY':
      form.essayReference = asStringAnswer(p.answer) ?? ''
      break
  }
  return form
}

/**
 * 表单 -> 题库请求(题库模式)。
 * 课程标签必须原样回传:题库 PUT 是全量覆盖,漏传即等于把已有标签清掉。
 */
export function toQuestionSaveRequest(form: QuestionFormValue): QuestionSaveRequest {
  return {
    type: form.type,
    stem: form.stem.trim(),
    ...answerFields(form),
    analysis: form.analysis.trim() || undefined,
    ...courseTagFields(form.courseTag),
    defaultScore: form.defaultScore ?? undefined,
  }
}

/** 表单 -> 作业直接录入题目(作业模式) */
export function toQuestionInput(form: QuestionFormValue): QuestionInput {
  return {
    type: form.type,
    stem: form.stem.trim(),
    ...answerFields(form),
    analysis: form.analysis.trim() || undefined,
    score: form.score ?? 0,
    saveToBank: form.saveToBank,
  }
}

/** 按题型组装 options/answer/规则字段(两种请求共用) */
function answerFields(form: QuestionFormValue): Pick<
  QuestionSaveRequest,
  'options' | 'answer' | 'scoreRule' | 'caseSensitive' | 'requireFile'
> {
  switch (form.type) {
    case 'SINGLE_CHOICE':
      return {
        options: normalizeOptions(form.options),
        answer: form.singleAnswer,
      }
    case 'MULTI_CHOICE':
      return {
        options: normalizeOptions(form.options),
        answer: [...form.multiAnswer],
        scoreRule: form.scoreRule,
      }
    case 'JUDGE':
      return { answer: form.judgeAnswer }
    case 'FILL_BLANK':
      return {
        answer: {
          ordered: form.ordered,
          blanks: form.blanks.map((group) => group.map((s) => s.trim()).filter(Boolean)),
        },
        caseSensitive: form.caseSensitive,
      }
    case 'ESSAY':
      return {
        answer: form.essayReference.trim() || null,
        requireFile: form.requireFile,
      }
  }
}

/** 选项 key 按行序重排 A/B/C... 并去空白文本行(提交前再兜一次) */
function normalizeOptions(options: OptionItem[]): OptionItem[] {
  return options
    .filter((o) => o.text.trim())
    .map((o, i) => ({ key: optionKeyOf(i), text: o.text.trim() }))
}

/**
 * 表单校验,返回 i18n 键(null = 通过)。规则与后端 QuestionPayloadValidator 对齐,
 * 把 400 挡在提交前:题干必填;选择题 ≥2 选项且答案命中 key(多选 ≥2);
 * 填空 ≥1 空且每空 ≥1 个非空可接受答案;作业模式配分 >0。
 */
export function validateQuestionForm(form: QuestionFormValue, mode: 'bank' | 'assignment'): string | null {
  if (!form.stem.trim()) return 'coursework.question.stemRequired'
  switch (form.type) {
    case 'SINGLE_CHOICE': {
      const opts = normalizeOptions(form.options)
      if (opts.length < 2) return 'coursework.question.optionsTooFew'
      if (!form.singleAnswer || !opts.some((o) => o.key === form.singleAnswer)) {
        return 'coursework.question.singleAnswerRequired'
      }
      break
    }
    case 'MULTI_CHOICE': {
      const opts = normalizeOptions(form.options)
      if (opts.length < 2) return 'coursework.question.optionsTooFew'
      if (
        form.multiAnswer.length < 2 ||
        !form.multiAnswer.every((k) => opts.some((o) => o.key === k))
      ) {
        return 'coursework.question.multiAnswerRequired'
      }
      break
    }
    case 'JUDGE':
      if (form.judgeAnswer == null) return 'coursework.question.judgeAnswerRequired'
      break
    case 'FILL_BLANK': {
      const groups = form.blanks.map((g) => g.map((s) => s.trim()).filter(Boolean))
      if (!groups.length || groups.some((g) => !g.length)) {
        return 'coursework.question.blankAnswerRequired'
      }
      break
    }
    case 'ESSAY':
      break
  }
  if (mode === 'assignment' && (form.score == null || form.score <= 0)) {
    return 'coursework.question.scoreRequired'
  }
  if (mode === 'bank' && form.defaultScore != null && form.defaultScore <= 0) {
    return 'coursework.question.scoreRequired'
  }
  return null
}
