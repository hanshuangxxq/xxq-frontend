import type { ScoreView } from '@/modules/score/types'
import type { CourseSource } from '@/modules/course/types'

/** 考试类型（响应为中文描述） */
export type ExamType = '期末考试' | '期中考试' | '补考' | '重修'
/** 考试类型 code（请求时传） */
export type ExamTypeCode = 'FINAL' | 'MIDTERM' | 'MAKEUP' | 'RETAKE'

/** 考试状态（响应为中文描述） */
export type ExamStatus = '已安排' | '已取消' | '已完成'
/** 考试状态 code */
export type ExamStatusCode = 'SCHEDULED' | 'CANCELED' | 'COMPLETED'

/** 考试视图（同后端 ExamView） */
export interface ExamView {
  id: number
  examName: string
  /** 公选课考试行为 null（公选课无 course.id），courseName 仍正常返回 */
  courseId: number | null
  courseName: string
  /** 期末/期中绑授课安排；补考/重修为 null */
  teachInfoId: number | null
  /** 排考班级（单班级名）；补考/重修为 null */
  className: string | null
  examType: ExamType
  semesterId: number
  examDate: string
  startTime: string
  endTime: string
  localId: number | null
  localName: string | null
  notes: string | null
  status: ExamStatus
  createTime: string
}

/** 创建/修改考试请求 */
export interface ExamCreateRequest {
  examName: string
  courseId: number
  teachInfoId?: number | null
  /** 期末/期中必填：排考的单班级名；补考/重修为 null */
  className?: string | null
  examType: ExamTypeCode
  semesterId: number
  examDate: string
  startTime: string
  /** 考试时长（分钟），后端据此计算 endTime 落库 */
  durationMinutes: number
  localId?: number | null
  notes?: string
  status?: ExamStatusCode | null
}

export interface ExamQuery {
  semesterId?: number
  courseId?: number
  /** 公选课须传 SELECTION_CAMPAIGN，按 exam.campaign_id 过滤 */
  source?: CourseSource
  examType?: ExamTypeCode
  /** 页码（从 1 开始） */
  page?: number
  /** 每页条数（上限 100） */
  pageSize?: number
}

/** 按班级查询可排考课程的选项（建考用，含 teachInfoId/courseId）。 */
export interface ClassCourseOptionDto {
  teachInfoId: number
  courseId: number
  courseName: string
  teacherName: string | null
  /** teach_info 的合班全名（如 "计科2301,计科2302"），便于前端提示该课为合班 */
  className: string
  semesterId: number
  semesterName: string
}

// ---- 补考 / 重修 ----

/** 不及格名单（补考候选） */
export interface MakeupCandidateDto {
  studentUserId: number
  studentName: string
  studentNo: string
  scoreId: number
  totalScore: number
  scoreLevel: string
  semesterId: number
}

export interface MakeupCandidateQuery {
  courseId: number
  /** 公选课须传 SELECTION_CAMPAIGN，按 score.campaign_id 查不及格名单 */
  source?: CourseSource
  semesterId?: number
}

/** 创建补考/重修考试请求 */
export interface MakeupExamCreateRequest {
  examName: string
  courseId: number
  examType: 'MAKEUP' | 'RETAKE'
  semesterId: number
  sourceSemesterId?: number
  examDate: string
  startTime: string
  /** 考试时长（分钟），后端据此计算 endTime 落库 */
  durationMinutes: number
  localId?: number | null
  notes?: string
}

/** 录入补考/重修成绩请求 */
export interface MakeupScoreEntryRequest {
  studentUserId: number
  score: number
}

/** 录入补考成绩返回生成的成绩记录 */
export type MakeupScoreResult = ScoreView[]
