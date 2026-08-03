/**
 * 学情分析模块类型（同后端 com.xrq.xxq.module.analysis.dto）。
 * 枚举：响应里是中文描述，请求时传 code（见 §1.4）。
 */

// ---- 枚举（响应为中文描述） ----

/** 预警级别（响应中文描述） */
export type WarningLevel = '黄色预警' | '橙色预警' | '红色预警'
/** 预警级别 code（请求时传） */
export type WarningLevelCode = 'YELLOW' | 'ORANGE' | 'RED'

/** 预警状态（响应中文描述） */
export type WarningStatus = '生效中' | '已解除'
/** 预警状态 code */
export type WarningStatusCode = 'ACTIVE' | 'RESOLVED'

/** 成绩等级 */
export type ScoreLevel = '优' | '良' | '中' | '及格' | '不及格'
/** 课程类型 */
export type CourseType = '必修' | '选修' | '公选' | '实践'
/** 进度状态 */
export type ProgressStatus = '进行中' | '已结课'
/** 考试状态 */
export type ExamStatus = '无考试' | '已排考' | '已完成'

// ---- #1 学生个人画像（融入「我的成绩」） ----

export interface SemesterGpaTrend {
  semesterId: number
  semesterName: string
  gpa: number
  avgScore: number
  failCount: number
}

export interface SubjectPerformance {
  courseId: number
  courseName: string
  courseType: CourseType | string
  credit: number
  totalScore: number
  scoreLevel: ScoreLevel | string
  gradePoint: number
}

export interface StudentProfileDto {
  studentUserId: number
  studentName: string
  studentNo: string
  className: string
  majorName: string
  enrollmentYear: number
  semesterId: number | null
  semesterName: string | null
  cumulativeGpa: number
  semesterGpa: number
  totalCredits: number
  earnedCredits: number
  failCount: number
  semesterFailCount: number
  /** 等级分布：优/良/中/及格/不及格 -> 数量 */
  levelDistribution: Record<string, number>
  semesterTrend: SemesterGpaTrend[]
  subjects: SubjectPerformance[]
  classRank: number | null
  classSize: number | null
}

// ---- #2 学业预警 ----

export interface WarningConfigDto {
  id: number
  level: WarningLevel | string
  gpaThreshold: number
  failCountThreshold: number
  semesterFailThreshold: number
  /** 0 禁用 / 1 启用 */
  enabled: number
}

export interface WarningConfigItem {
  level: WarningLevelCode | string
  gpaThreshold: number
  failCountThreshold: number
  semesterFailThreshold: number
  enabled: number
}

export interface WarningConfigRequest {
  configs: WarningConfigItem[]
}

export interface WarningScanResultDto {
  scannedCount: number
  warnedCount: number
  resolvedCount: number
  /** 黄色预警/橙色预警/红色预警 -> 当前生效人数 */
  byLevel: Record<string, number>
}

export interface WarningItemDto {
  id: number
  studentUserId: number
  studentName: string
  studentNo: string
  className: string
  level: WarningLevel | string
  reason: string
  gpa: number
  failCount: number
  semesterFailCount: number
  semesterId: number
  semesterName: string
  status: WarningStatus | string
  createTime: string
}

export interface WarningQuery {
  semesterId?: number
  level?: WarningLevelCode | string
}

// ---- #3 评教（模板驱动） ----

/** 模板状态 code（请求时传） */
export type TemplateStatusCode = 'ENABLED' | 'DISABLED'
/** 模板状态（响应中文描述） */
export type TemplateStatus = '启用' | '停用'

/** 评教指标库（教务共享指标） */
export interface EvaluationItemDto {
  id: number
  name: string
  description: string | null
  maxScore: number
  /** 被多少模板引用 */
  usedCount: number
  createTime: string
}

/** 新增指标请求 */
export interface EvaluationItemRequest {
  name: string
  description?: string
  /** 默认 5，范围 1-100 */
  maxScore?: number
}

/** 更新指标请求（字段均可选，传谁改谁） */
export interface EvaluationItemUpdateRequest {
  name?: string
  description?: string
  maxScore?: number
  /** true: 同步刷新引用本指标的模板快照；false/不传: 模板保留旧快照 */
  updateTemplates?: boolean
}

/** 模板-指标关联（含快照） */
export interface EvaluationTemplateItemDto {
  itemId: number
  itemName: string
  maxScore: number
  sortOrder: number
  /** 0 选填 / 1 必填 */
  required: number
}

/** 模板指标请求（新建/更新模板时传） */
export interface EvaluationTemplateItemRequest {
  itemId: number
  sortOrder?: number
  required?: number
}

/** 评教模板 */
export interface EvaluationTemplateDto {
  id: number
  name: string
  description: string | null
  status: TemplateStatus | string
  /** 1 = 全局默认模板 */
  isDefault: number
  items: EvaluationTemplateItemDto[]
  createTime: string
  updateTime: string | null
}

/** 新建模板请求 */
export interface EvaluationTemplateRequest {
  name: string
  description?: string
  items: EvaluationTemplateItemRequest[]
}

/** 更新模板请求（items 传入则整体替换） */
export interface EvaluationTemplateUpdateRequest {
  name?: string
  description?: string
  items?: EvaluationTemplateItemRequest[]
}

/** 课程级模板覆盖请求（templateId=null 清除覆盖） */
export interface EvaluationOverrideRequest {
  templateId: number | null
}

/** 评教表单结构（GET /evaluations/form） */
export interface EvaluationFormItem {
  itemId: number
  itemName: string
  maxScore: number
  sortOrder: number
  required: number
}

export interface EvaluationFormDto {
  templateId: number
  templateName: string
  items: EvaluationFormItem[]
}

/** 提交评教单项评分 */
export interface EvaluationScoreInput {
  itemId: number
  score: number
}

/** 提交评教请求 */
export interface EvaluationSubmitRequest {
  teachInfoId: number
  scores: EvaluationScoreInput[]
  comment?: string
}

/** 评教明细单项（含得分快照） */
export interface EvaluationScoreItem {
  itemId: number
  itemName: string
  maxScore: number
  score: number
}

/** 评教记录视图（提交响应 / 我的评教列表元素） */
export interface TeachingEvaluationView {
  id: number
  teachInfoId: number
  courseId: number
  courseName: string
  teacherId: number
  teacherName: string
  semesterId: number
  semesterName: string
  templateId: number
  templateName: string
  items: EvaluationScoreItem[]
  avgScore: number
  comment: string | null
  createTime: string
}

/** 评教周期状态（学生评教页据此判断是否展示「暂无评教」） */
export interface EvaluationStatusDto {
  open: boolean
  /** 未开放时的提示文案，如「暂无评教」；开放时为 null */
  message: string | null
  semesterId: number | null
  semesterName: string | null
  openTime: string | null
  closeTime: string | null
}

export interface TeacherQualityDto {
  teacherId: number
  teacherName: string
  department: string
  avgEvaluationScore: number
  evalCount: number
  /** 按指标名分组的原始分均值（替代旧 dimensionAverages） */
  itemAverages: Record<string, number>
  courseCount: number
  courseAvgScore: number
  coursePassRate: number
  studentCount: number
}

// ---- #6 学习进度（融入「课表」） ----

export interface CourseProgress {
  teachInfoId: number
  courseId: number
  courseName: string
  teacherName: string
  startWeek: number
  endWeek: number
  progressPercent: number
  status: ProgressStatus | string
  examStatus: ExamStatus | string
  scoreEntered: boolean
  totalScore: number | null
}

export interface LearningProgressDto {
  studentUserId: number
  studentName: string
  semesterName: string | null
  currentWeek: number | null
  courses: CourseProgress[]
}
