import type { CourseSource } from '@/modules/course/types'

/** 成绩类型（响应为中文描述） */
export type ScoreType = '正常' | '补考' | '重修'
/** 成绩类型 code（请求时传） */
export type ScoreTypeCode = 'REGULAR' | 'MAKEUP' | 'RETAKE'

/** 复核状态（响应为中文描述） */
export type ReviewStatus = '待教师处理' | '教师已回复' | '已升级教务' | '已解决' | '已驳回'
/** 复核状态 code（请求过滤时传） */
export type ReviewStatusCode = 'PENDING' | 'TEACHER_REPLIED' | 'ESCALATED' | 'RESOLVED' | 'REJECTED'

/** 成绩等级（派生） */
export type ScoreLevel = '优' | '良' | '中' | '及格' | '不及格'

/** 成绩视图（同后端 ScoreView） */
export interface ScoreView {
  id: number
  teachInfoId: number
  /** 公选课成绩行为 null（公选课无 course.id），courseName 仍正常返回 */
  courseId: number | null
  courseName: string
  teacherId: number
  teacherName: string
  studentUserId: number
  studentName: string
  studentNo: string
  semesterId: number
  regularScore: number
  finalScore: number
  /** 录入时平时占比(%) */
  regularRatio: number
  totalScore: number
  scoreLevel: ScoreLevel
  scoreType: ScoreType
  /** 0 可改 / 1 已锁定 */
  locked: number
  createTime: string
}

/** 平时分占比配置（同后端 ScoreConfig / GradeConfig） */
export interface ScoreConfig {
  id: number
  teachInfoId: number
  regularRatio: number
  createUserId: number
  createTime: string
  updateTime: string
}

/** 录入名单学生 */
export interface ScoreRosterDto {
  studentUserId: number
  studentName: string
  studentNo: string
}

/** 单条成绩录入请求 */
export interface ScoreEntryRequest {
  studentUserId: number
  regularScore: number
  finalScore: number
}

/** 批量录入请求 */
export interface ScoreBatchRequest {
  teachInfoId: number
  /** 可选：按考试排考班级限定可录入学生（合班时仅允许该考试班级） */
  examId?: number
  entries: ScoreEntryRequest[]
}

/** 成绩统计（按课程聚合） */
export interface ScoreStatisticsDto {
  courseId: number
  courseName: string
  totalCount: number
  excellentCount: number
  goodCount: number
  mediumCount: number
  passCount: number
  failCount: number
  avgScore: number
  maxScore: number
  minScore: number
  passRate: number
}

export interface ScoreStatisticsQuery {
  courseId?: number
  /** 公选课须传 SELECTION_CAMPAIGN，否则按 course_id 过滤查不到公选课成绩 */
  source?: CourseSource
  className?: string
  semesterId?: number
}

// ---- 成绩复核 ----

/** 复核视图（同后端 ReviewView） */
export interface ReviewView {
  id: number
  scoreId: number
  studentUserId: number
  studentName: string
  studentNo: string
  courseId: number
  courseName: string
  teacherId: number
  teacherName: string
  currentTotalScore: number
  reason: string
  status: ReviewStatus
  teacherReply: string | null
  adminReply: string | null
  escalateTime: string | null
  resolvedTime: string | null
  createTime: string
}

/** 提交复核申请 */
export interface ReviewApplyRequest {
  scoreId: number
  reason: string
}

/** 教师回复 */
export interface ReviewReplyRequest {
  reply: string
  newTotalScore?: number | null
}

/** 教务终审 */
export interface ReviewResolveRequest {
  reply: string
  newTotalScore?: number | null
  resolved: boolean
}
