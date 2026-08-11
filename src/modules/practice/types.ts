// ===== 枚举（响应为中文描述，请求/查询传英文 code）=====

/** 实习项目状态（中文） */
export type InternshipStatus = '草稿' | '开放' | '关闭'
/** 实习项目状态 code */
export type InternshipStatusCode = 'DRAFT' | 'OPEN' | 'CLOSED'

/** 培训课程状态（中文） */
export type TrainingStatus = '草稿' | '开放' | '关闭'
/** 培训课程状态 code */
export type TrainingStatusCode = 'DRAFT' | 'OPEN' | 'CLOSED'

/** 培训报名状态（中文） */
export type EnrollStatus = '已报名' | '已取消'
/** 培训报名状态 code */
export type EnrollStatusCode = 'ENROLLED' | 'CANCELLED'

/** 审核状态（共享：实习报名/竞赛报名/社会实践申报）（中文） */
export type AuditStatus = '待审核' | '已通过' | '已驳回'
/** 审核状态 code */
export type AuditStatusCode = 'PENDING' | 'APPROVED' | 'REJECTED'

/** 报告状态（共享：实习报告/社会实践报告）（中文） */
export type ReportStatus = '已提交' | '已评审'
/** 报告状态 code */
export type ReportStatusCode = 'SUBMITTED' | 'REVIEWED'

/** 竞赛状态（中文） */
export type CompetitionStatus = '草稿' | '开放报名' | '报名关闭' | '已结束'
/** 竞赛状态 code */
export type CompetitionStatusCode = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ENDED'

/** 竞赛级别（中文） */
export type CompetitionLevel = '国家级' | '省级' | '校级'
/** 竞赛级别 code */
export type CompetitionLevelCode = 'NATIONAL' | 'PROVINCIAL' | 'SCHOOL'

/** 获奖等级（中文） */
export type Award = '一等奖' | '二等奖' | '三等奖' | '优秀奖' | '参与奖'
/** 获奖等级 code */
export type AwardCode = 'FIRST' | 'SECOND' | 'THIRD' | 'EXCELLENCE' | 'PARTICIPATION'

/** 社会实践项目状态（中文） */
export type SocialPracticeStatus = '草稿' | '开放' | '关闭'
/** 社会实践项目状态 code */
export type SocialPracticeStatusCode = 'DRAFT' | 'OPEN' | 'CLOSED'

// ===== 实习与培训 =====

export interface InternshipCreateRequest {
  semesterId?: number | null
  title: string
  company?: string
  description?: string
  supervisorId?: number | null
  startTime?: string | null
  endTime?: string | null
  capacity: number
}

export interface InternshipUpdateRequest {
  title?: string
  company?: string
  description?: string
  supervisorId?: number | null
  startTime?: string | null
  endTime?: string | null
  capacity?: number
}

export interface InternshipApplyRequest {
  internshipId: number
  applyReason?: string
}

export interface InternshipReviewRequest {
  approved: boolean
  reviewComment?: string
}

export interface InternshipReportSubmitRequest {
  internshipId: number
  title: string
  summary?: string
}

export interface InternshipReportReviewRequest {
  score?: number
  feedback?: string
}

export interface TrainingCreateRequest {
  semesterId?: number | null
  title: string
  description?: string
  teacherId?: number | null
  startTime?: string | null
  endTime?: string | null
  capacity: number
}

export interface TrainingUpdateRequest {
  title?: string
  description?: string
  teacherId?: number | null
  startTime?: string | null
  endTime?: string | null
  capacity?: number
}

export interface InternshipResponse {
  id: number
  semesterId: number
  title: string
  company: string | null
  description: string | null
  supervisorId: number
  supervisorName: string
  startTime: string | null
  endTime: string | null
  capacity: number
  selectedCount: number
  status: InternshipStatus
  createTime: string
}

export interface InternshipApplicationResponse {
  id: number
  internshipId: number
  internshipTitle: string
  studentId: number
  studentName: string
  status: AuditStatus
  applyReason: string | null
  applyTime: string
  reviewTime: string | null
  reviewComment: string | null
}

export interface InternshipReportResponse {
  id: number
  internshipId: number
  internshipTitle: string
  studentId: number
  studentName: string
  title: string
  summary: string | null
  fileOriginal: string | null
  submitTime: string
  score: number | null
  feedback: string | null
  reviewTime: string | null
  status: ReportStatus
}

export interface TrainingResponse {
  id: number
  semesterId: number
  title: string
  description: string | null
  teacherId: number
  teacherName: string
  startTime: string | null
  endTime: string | null
  capacity: number
  enrolledCount: number
  status: TrainingStatus
  createTime: string
}

export interface TrainingEnrollmentResponse {
  id: number
  courseId: number
  courseTitle: string
  studentId: number
  studentName: string
  enrollTime: string
  status: EnrollStatus
}

export interface InternshipQuery {
  supervisorId?: number
  status?: InternshipStatusCode
  page?: number
  pageSize?: number
}

export interface InternshipReportQuery {
  status?: ReportStatusCode
  page?: number
  pageSize?: number
}

export interface TrainingQuery {
  teacherId?: number
  status?: TrainingStatusCode
  page?: number
  pageSize?: number
}

// ===== 竞赛管理 =====

export interface CompetitionCreateRequest {
  semesterId?: number | null
  name: string
  description?: string
  organizer?: string
  level?: CompetitionLevelCode
  regStartTime?: string | null
  regEndTime?: string | null
  contestTime?: string | null
}

export interface CompetitionUpdateRequest {
  name?: string
  description?: string
  organizer?: string
  level?: CompetitionLevelCode
  regStartTime?: string | null
  regEndTime?: string | null
  contestTime?: string | null
}

export interface RegistrationRequest {
  competitionId: number
  teamName?: string
  members?: string
}

export interface RegistrationReviewRequest {
  approved: boolean
  reviewComment?: string
}

export interface CompetitionResultRequest {
  competitionId: number
  registrationId: number
  award: AwardCode
  score?: number
  comment?: string
}

export interface CompetitionResponse {
  id: number
  semesterId: number
  name: string
  description: string | null
  organizer: string | null
  level: CompetitionLevel
  regStartTime: string | null
  regEndTime: string | null
  contestTime: string | null
  status: CompetitionStatus
  createTime: string
}

export interface RegistrationResponse {
  id: number
  competitionId: number
  competitionName: string
  studentId: number
  studentName: string
  teamName: string | null
  members: string | null
  status: AuditStatus
  registerTime: string
  reviewTime: string | null
  reviewComment: string | null
}

export interface CompetitionResultResponse {
  id: number
  competitionId: number
  competitionName: string
  registrationId: number
  studentId: number
  studentName: string
  award: Award
  score: number | null
  comment: string | null
  awardTime: string
}

export interface CompetitionQuery {
  status?: CompetitionStatusCode
  page?: number
  pageSize?: number
}

// ===== 社会实践 =====

export interface SocialPracticeCreateRequest {
  semesterId?: number | null
  title: string
  description?: string
  organizer?: string
  startTime?: string | null
  endTime?: string | null
  capacity: number
}

export interface SocialPracticeUpdateRequest {
  title?: string
  description?: string
  organizer?: string
  startTime?: string | null
  endTime?: string | null
  capacity?: number
}

export interface SocialPracticeApplyRequest {
  practiceId: number
  teamName?: string
  members?: string
  applyReason?: string
}

export interface SocialPracticeReviewRequest {
  approved: boolean
  reviewComment?: string
}

export interface SocialPracticeReportSubmitRequest {
  practiceId: number
  title: string
  summary?: string
}

export interface SocialPracticeReportReviewRequest {
  score?: number
  feedback?: string
}

export interface SocialPracticeResponse {
  id: number
  semesterId: number
  title: string
  description: string | null
  organizer: string | null
  startTime: string | null
  endTime: string | null
  capacity: number
  selectedCount: number
  status: SocialPracticeStatus
  createTime: string
}

export interface SocialPracticeApplicationResponse {
  id: number
  practiceId: number
  practiceTitle: string
  studentId: number
  studentName: string
  teamName: string | null
  members: string | null
  status: AuditStatus
  applyReason: string | null
  applyTime: string
  reviewTime: string | null
  reviewComment: string | null
}

export interface SocialPracticeReportResponse {
  id: number
  practiceId: number
  practiceTitle: string
  studentId: number
  studentName: string
  title: string
  summary: string | null
  fileOriginal: string | null
  submitTime: string
  score: number | null
  feedback: string | null
  reviewTime: string | null
  status: ReportStatus
}

export interface SocialPracticeQuery {
  status?: SocialPracticeStatusCode
  page?: number
  pageSize?: number
}

export interface SocialPracticeReportQuery {
  status?: ReportStatusCode
  page?: number
  pageSize?: number
}
