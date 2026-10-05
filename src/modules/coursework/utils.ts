import { formatBytes } from '@/shared/utils/format'
import { courseKey, parseCourseKey } from '@/modules/course/utils'
import type { TeachInfo } from '@/modules/curriculum/types'
import type {
  AnswerVisible,
  AssignmentStatus,
  CourseOption,
  EssayAnswer,
  FillBlankStandardAnswer,
  MultiScoreRule,
  MySubmissionStatusCode,
  QuestionAnswerJson,
  QuestionType,
  SubmissionState,
  SubmissionStatus,
} from './types'

/** NTag 的 type 属性取值,各状态 -> 标签色映射函数的返回类型 */
type TagType = 'success' | 'info' | 'warning' | 'error' | 'default'

/** 作业状态 -> Tag 类型(草稿灰、已发布绿、已关闭弱化) */
export function assignmentStatusTagType(status: AssignmentStatus): TagType {
  switch (status) {
    case '草稿':
      return 'default'
    case '已发布':
      return 'success'
    case '已关闭':
      return 'warning'
  }
}

/** 提交状态 -> Tag 类型(已批改绿、待批改信息色) */
export function submissionStatusTagType(status: SubmissionStatus): TagType {
  switch (status) {
    case '已提交':
      return 'info'
    case '已批改':
      return 'success'
  }
}

/**
 * 「我的提交」状态码 -> i18n 键。★ 该字段是英文码,别按中文匹配(文档 §1.4 的唯一例外);
 * 用映射表而不是直接拼 key,未知码时能安全退化成空串。
 */
export function mySubmissionStatusLabelKey(code: MySubmissionStatusCode | null): string {
  switch (code) {
    case 'SUBMITTED':
      return 'coursework.assignment.myStatusSubmitted'
    case 'GRADED':
      return 'coursework.assignment.myStatusGraded'
    default:
      return ''
  }
}

/** 「我的提交」状态码 -> Tag 类型 */
export function mySubmissionStatusTagType(code: MySubmissionStatusCode | null): TagType {
  switch (code) {
    case 'SUBMITTED':
      return 'info'
    case 'GRADED':
      return 'success'
    default:
      return 'default'
  }
}

/** 题型 code -> i18n 键(映射表面不是拼 key,未知 code 安全退化为空串) */
export function questionTypeLabelKey(type: QuestionType | null | undefined): string {
  switch (type) {
    case 'SINGLE_CHOICE':
      return 'coursework.question.typeSingle'
    case 'MULTI_CHOICE':
      return 'coursework.question.typeMulti'
    case 'JUDGE':
      return 'coursework.question.typeJudge'
    case 'FILL_BLANK':
      return 'coursework.question.typeFillBlank'
    case 'ESSAY':
      return 'coursework.question.typeEssay'
    default:
      return ''
  }
}

/** 题型 -> Tag 类型(客观题信息色、大题警告色,名单/详情里一眼区分) */
export function questionTypeTagType(type: QuestionType | null | undefined): TagType {
  return type === 'ESSAY' ? 'warning' : 'info'
}

/** 多选计分规则 -> i18n 键 */
export function multiScoreRuleLabelKey(rule: MultiScoreRule | null | undefined): string {
  switch (rule) {
    case 'ALL_OR_NOTHING':
      return 'coursework.question.scoreRuleAll'
    case 'HALF_ON_PARTIAL':
      return 'coursework.question.scoreRuleHalf'
    default:
      return ''
  }
}

/** 答案可见性 -> i18n 键 */
export function answerVisibleLabelKey(code: AnswerVisible | null | undefined): string {
  switch (code) {
    case 'SUBMIT':
      return 'coursework.assignment.answerVisibleSubmit'
    case 'DEADLINE':
      return 'coursework.assignment.answerVisibleDeadline'
    case 'CLOSED':
      return 'coursework.assignment.answerVisibleClosed'
    case 'NEVER':
      return 'coursework.assignment.answerVisibleNever'
    default:
      return ''
  }
}

/** 名单五态 -> i18n 键 */
export function submissionStateLabelKey(state: SubmissionState | null | undefined): string {
  switch (state) {
    case 'GRADED':
      return 'coursework.assignment.stateGraded'
    case 'SUBMITTED':
      return 'coursework.assignment.stateSubmitted'
    case 'DRAFTING':
      return 'coursework.assignment.stateDrafting'
    case 'VIEWED':
      return 'coursework.assignment.stateViewed'
    case 'NOT_VIEWED':
      return 'coursework.assignment.stateNotViewed'
    default:
      return ''
  }
}

/** 名单五态 -> Tag 类型(文档 §6.4 建议配色:GRADED 绿/SUBMITTED 蓝/DRAFTING 黄/VIEWED 灰/NOT_VIEWED 红) */
export function submissionStateTagType(state: SubmissionState | null | undefined): TagType {
  switch (state) {
    case 'GRADED':
      return 'success'
    case 'SUBMITTED':
      return 'info'
    case 'DRAFTING':
      return 'warning'
    case 'VIEWED':
      return 'default'
    case 'NOT_VIEWED':
      return 'error'
    default:
      return 'default'
  }
}

// ---- 答案 JSON 类型守卫(视图里是联合类型,按题型取出时用) ----

/** 单选/判断以外的字符串答案:单选选项 key、大题参考答案 */
export function asStringAnswer(value: QuestionAnswerJson | null | undefined): string | null {
  return typeof value === 'string' ? value : null
}

/** 字符串数组答案:多选选项 key 列表、填空学生作答 */
export function asStringArrayAnswer(value: QuestionAnswerJson | null | undefined): string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
    ? (value as string[])
    : []
}

/** 布尔答案:判断题 */
export function asBooleanAnswer(value: QuestionAnswerJson | null | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null
}

/** 填空题标准答案({ordered, blanks}) */
export function asFillBlankStandard(
  value: QuestionAnswerJson | null | undefined,
): FillBlankStandardAnswer | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Partial<FillBlankStandardAnswer>
  if (!Array.isArray(v.blanks)) return null
  return { ordered: v.ordered !== false, blanks: v.blanks as string[][] }
}

/** 大题学生作答({text, files}) */
export function asEssayAnswer(value: QuestionAnswerJson | null | undefined): EssayAnswer | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as EssayAnswer
  return {
    text: typeof v.text === 'string' ? v.text : undefined,
    files: Array.isArray(v.files) ? v.files : undefined,
  }
}

/**
 * 秒数 -> 「mm:ss」/「h:mm:ss」。durationSec 可能为 null(登记时前端没探测出来),显示 '-'。
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '-'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * 题库/题目的课程标签 -> 课程复合键 `source:id`。
 *
 * 后端的课程标签是 `courseId`(常规课)与 `campaignId`(公选活动)**二选一**,前端统一编码成
 * 一个可下拉的字符串值(见 `@/modules/course/utils` 的 courseKey —— 两张表 id 可能重复,
 * 单看 id 无法区分),提交时再用 courseTagFields 拆回对应字段。
 */
export function courseTagKeyOf(view: {
  courseId: number | null
  campaignId: number | null
}): string | null {
  if (view.campaignId != null) return courseKey(view.campaignId, 'SELECTION_CAMPAIGN')
  if (view.courseId != null) return courseKey(view.courseId, 'MANUAL')
  return null
}

/**
 * 课程复合键 -> 题库请求的标签字段。
 *
 * ★ **只出现其中一个字段**:题库 PUT 是全量覆盖(传 null 即清空),缺省的那个字段正好被清掉,
 * 天然实现「二选一」语义 —— 改选常规课会清掉公选活动标签,反之亦然;
 * 传 null(清空标签)则两个字段都缺省,两个标签一起清。
 */
export function courseTagFields(key: string | null): {
  courseId?: number
  campaignId?: number
} {
  if (!key) return {}
  const { id, source } = parseCourseKey(key)
  if (!Number.isFinite(id)) return {}
  return source === 'SELECTION_CAMPAIGN' ? { campaignId: id } : { courseId: id }
}

/**
 * 解析后端返回的 ISO 时间。
 *
 * ⚠️ **不要直接 `new Date(字符串)`**:写入类接口的响应可能带 7 位小数秒
 * (如 `2026-09-22T07:56:32.9636228`),而 ES 规范只规定支持 3 位小数秒 ——
 * V8 会容忍,其它实现不一定,属实现相关行为。这里先截到秒再解析。
 * 读取接口回来的是 MySQL DATETIME(截断到秒),两种都要能吃下。
 */
export function parseServerTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const normalized = value.trim().replace(' ', 'T').slice(0, 19)
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** 文件大小展示,走共享的 formatBytes;null/0 显示 '-' 而不是 '0 B' */
export function formatFileSize(bytes: number | null | undefined): string {
  return bytes ? formatBytes(bytes) : '-'
}

/**
 * 把 GET /teach-info 的课程列表收敛成课程选择器的选项。
 *
 * 同一门课（同一位教师、同一个班级）会因多个上课时段在 teach_info 里对应多行，
 * 对课业而言是同一门 —— 按「课程名 + 教师名 + 班级名」收敛成一项，id 取组内最小值
 * （服务端的锚点行就是组内最小 id，取最小可让传进去的 id 往往已等于返回值）。
 *
 * ⚠️ 去重键只能用**可见字段**拼：后端 CourseDto 是脱敏的，不含 courseId / teacherId，
 * **也不含 semesterId**（已核对 CourseDto 及其全部子类）。因此跨学期的同名课程无法区分，
 * 会被合并成一项 —— 与课表页「我的课程」的行为一致。若将来要按学期收敛，
 * 需要后端在 CourseDto 上回填 semesterId。
 *
 * @param courses        TeachInfo[]；course.id 缺失的行（纯展示视图）直接跳过
 * @param includeTeacher 学生端需要教师名区分同名课；教师端显示自己的课，教师名是冗余信息
 */
export function buildCourseOptions(
  courses: readonly TeachInfo[],
  includeTeacher: boolean,
): CourseOption[] {
  const byKey = new Map<string, CourseOption>()
  for (const c of courses) {
    if (c.id == null) continue
    const key = `${c.courseName}|${c.teacherName}|${c.className}`
    const existing = byKey.get(key)
    if (existing) {
      if (c.id < existing.id) existing.id = c.id
      continue
    }
    byKey.set(key, {
      id: c.id,
      courseName: c.courseName,
      teacherName: c.teacherName,
      className: c.className,
      label: includeTeacher
        ? `${c.courseName} - ${c.teacherName}（${c.className}）`
        : `${c.courseName}（${c.className}）`,
    })
  }
  return [...byKey.values()]
}
