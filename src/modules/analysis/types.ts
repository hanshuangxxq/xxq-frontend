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

/** 单学期 GPA 走势点 */
export interface SemesterGpaTrend {
  semesterId: number
  semesterName: string
  gpa: number
  avgScore: number
  failCount: number
}

/** 单门课程成绩表现 */
export interface SubjectPerformance {
  courseId: number
  courseName: string
  courseType: CourseType | string
  credit: number
  totalScore: number
  scoreLevel: ScoreLevel | string
  gradePoint: number
}

/** 学生个人画像（GPA、学分、排名、科目明细与学期走势） */
export interface StudentProfileDto {
  studentUserId: number
  studentName: string
  studentNo: string
  className: string
  majorName: string
  enrollmentYear: number
  /** 当前学期，无在读学期数据时为 null */
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
  /** 班级排名，无排名数据时为 null */
  classRank: number | null
  /** 班级人数，无排名数据时为 null */
  classSize: number | null
}

// ---- #2 学业预警 ----

/** 单级预警阈值配置（响应，level 为中文描述） */
export interface WarningConfigDto {
  id: number
  level: WarningLevel | string
  gpaThreshold: number
  failCountThreshold: number
  semesterFailThreshold: number
  /** 0 禁用 / 1 启用 */
  enabled: number
}

/** 单级预警阈值配置（请求体单项，level 传 code） */
export interface WarningConfigItem {
  level: WarningLevelCode | string
  gpaThreshold: number
  failCountThreshold: number
  semesterFailThreshold: number
  enabled: number
}

/** 预警阈值保存请求（三级配置整体提交） */
export interface WarningConfigRequest {
  configs: WarningConfigItem[]
}

/** 预警扫描结果统计（扫描/新增/解除人数，按级别分布） */
export interface WarningScanResultDto {
  scannedCount: number
  warnedCount: number
  resolvedCount: number
  /** 黄色预警/橙色预警/红色预警 -> 当前生效人数 */
  byLevel: Record<string, number>
}

/** 单条预警记录（学生维度） */
export interface WarningItemDto {
  id: number
  studentUserId: number
  studentName: string
  studentNo: string
  className: string
  level: WarningLevel | string
  /** 触发预警的原因说明（由后端按阈值生成，如 GPA 低于阈值） */
  reason: string
  gpa: number
  failCount: number
  semesterFailCount: number
  semesterId: number
  semesterName: string
  status: WarningStatus | string
  createTime: string
}

/** 预警名单分页查询参数 */
export interface WarningQuery {
  semesterId?: number
  level?: WarningLevelCode | string
  /** 页码（从 1 开始） */
  page?: number
  /** 每页条数（上限 100） */
  pageSize?: number
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

/** 学生对某门课看到的评教表单（解析课程覆盖优先，否则全局默认模板） */
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

/** 教师教学质量统计（评教均分 + 教学运行指标） */
export interface TeacherQualityDto {
  teacherId: number
  teacherName: string
  /** 所属院系 */
  department: string
  /** 评教加权均分（来自学生逐项评分） */
  avgEvaluationScore: number
  /** 收到的评教份数 */
  evalCount: number
  /** 按指标名分组的原始分均值（替代旧 dimensionAverages） */
  itemAverages: Record<string, number>
  /** 授课门数 */
  courseCount: number
  /** 所授课程平均分 */
  courseAvgScore: number
  /** 所授课程及格率（单位 %） */
  coursePassRate: number
  /** 授课覆盖学生总数 */
  studentCount: number
}

// ---- #6 学习进度（融入「课表」） ----

/** 单门课程学习进度 */
export interface CourseProgress {
  teachInfoId: number
  courseId: number
  courseName: string
  teacherName: string
  startWeek: number
  endWeek: number
  /** 进度百分比（0-100） */
  progressPercent: number
  status: ProgressStatus | string
  examStatus: ExamStatus | string
  /** 成绩是否已录入 */
  scoreEntered: boolean
  /** 课程总评成绩，未出分为 null */
  totalScore: number | null
}

/** 学生本学期学习进度总览 */
export interface LearningProgressDto {
  studentUserId: number
  studentName: string
  /** 学期名，无在读学期数据时为 null */
  semesterName: string | null
  /** 当前教学周，不在学期内为 null */
  currentWeek: number | null
  courses: CourseProgress[]
}
