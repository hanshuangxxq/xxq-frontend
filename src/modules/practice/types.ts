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

/** 创建实习项目请求 */
export interface InternshipCreateRequest {
  /** 所属学期,缺省表示不关联 */
  semesterId?: number | null
  title: string
  company?: string
  description?: string
  /** 负责教师 user.id,可选 */
  supervisorId?: number | null
  startTime?: string | null
  endTime?: string | null
  capacity: number
}

/** 更新实习项目请求,字段均可选 */
export interface InternshipUpdateRequest {
  title?: string
  company?: string
  description?: string
  /** 负责教师 user.id,可选 */
  supervisorId?: number | null
  startTime?: string | null
  endTime?: string | null
  capacity?: number
}

/** 学生报名实习请求 */
export interface InternshipApplyRequest {
  internshipId: number
  applyReason?: string
}

/** 报名审核请求(approved=true 通过,false 驳回) */
export interface InternshipReviewRequest {
  approved: boolean
  reviewComment?: string
}

/** 提交实习报告请求(附件单独作为文件上传) */
export interface InternshipReportSubmitRequest {
  internshipId: number
  title: string
  summary?: string
  /** 分片上传产物路径(objects/...),与 multipart 的 file 部分二选一;>20MB 时走这里 */
  filePath?: string
  /** 展示文件名,配合 filePath 使用 */
  fileOriginal?: string
}

/** 实习报告评审请求(分数+评语,均可选) */
export interface InternshipReportReviewRequest {
  score?: number
  feedback?: string
}

/** 创建培训课程请求 */
export interface TrainingCreateRequest {
  /** 所属学期,缺省表示不关联 */
  semesterId?: number | null
  title: string
  description?: string
  /** 授课教师 user.id,可选 */
  teacherId?: number | null
  startTime?: string | null
  endTime?: string | null
  capacity: number
}

/** 更新培训课程请求,字段均可选 */
export interface TrainingUpdateRequest {
  title?: string
  description?: string
  /** 授课教师 user.id,可选 */
  teacherId?: number | null
  startTime?: string | null
  endTime?: string | null
  capacity?: number
}

/** 实习项目详情 */
export interface InternshipResponse {
  id: number
  semesterId: number
  title: string
  company: string | null
  description: string | null
  /** 负责教师 user.id */
  supervisorId: number
  supervisorName: string
  startTime: string | null
  endTime: string | null
  capacity: number
  /** 已选人数:仅统计审核通过的报名,待审核不占容量 */
  selectedCount: number
  status: InternshipStatus
  createTime: string
}

/** 实习报名记录 */
export interface InternshipApplicationResponse {
  id: number
  internshipId: number
  internshipTitle: string
  studentId: number
  studentName: string
  status: AuditStatus
  applyReason: string | null
  applyTime: string
  /** 审核/评审时间,待审核为 null */
  reviewTime: string | null
  reviewComment: string | null
}

/** 实习报告(含评审结果) */
export interface InternshipReportResponse {
  id: number
  internshipId: number
  internshipTitle: string
  studentId: number
  studentName: string
  title: string
  summary: string | null
  /** 附件原始文件名,下载时展示 */
  fileOriginal: string | null
  submitTime: string
  score: number | null
  feedback: string | null
  /** 审核/评审时间,待审核为 null */
  reviewTime: string | null
  status: ReportStatus
}

/** 培训课程详情 */
export interface TrainingResponse {
  id: number
  semesterId: number
  title: string
  description: string | null
  /** 授课教师 user.id */
  teacherId: number
  teacherName: string
  startTime: string | null
  endTime: string | null
  capacity: number
  /** 已报名人数(报名即占用名额,无审核环节) */
  enrolledCount: number
  status: TrainingStatus
  createTime: string
}

/** 培训报名记录 */
export interface TrainingEnrollmentResponse {
  id: number
  courseId: number
  courseTitle: string
  studentId: number
  studentName: string
  enrollTime: string
  status: EnrollStatus
}

/** 实习项目分页查询条件,status 传英文 code */
export interface InternshipQuery {
  supervisorId?: number
  status?: InternshipStatusCode
  page?: number
  pageSize?: number
}

/** 实习报告分页查询条件,status 传英文 code */
export interface InternshipReportQuery {
  status?: ReportStatusCode
  page?: number
  pageSize?: number
}

/** 培训课程分页查询条件,status 传英文 code */
export interface TrainingQuery {
  teacherId?: number
  status?: TrainingStatusCode
  page?: number
  pageSize?: number
}

// ===== 竞赛管理 =====

/** 创建竞赛请求 */
export interface CompetitionCreateRequest {
  /** 所属学期,缺省表示不关联 */
  semesterId?: number | null
  name: string
  description?: string
  organizer?: string
  level?: CompetitionLevelCode
  regStartTime?: string | null
  regEndTime?: string | null
  contestTime?: string | null
}

/** 更新竞赛请求,字段均可选 */
export interface CompetitionUpdateRequest {
  name?: string
  description?: string
  organizer?: string
  level?: CompetitionLevelCode
  regStartTime?: string | null
  regEndTime?: string | null
  contestTime?: string | null
}

/** 学生报名竞赛请求,个人赛不传 teamName/members */
export interface RegistrationRequest {
  competitionId: number
  teamName?: string
  /** 团队成员 user.id 逗号分隔串,个人赛不传 */
  members?: string
}

/** 竞赛报名审核请求 */
export interface RegistrationReviewRequest {
  approved: boolean
  reviewComment?: string
}

/** 竞赛获奖结果录入请求,同一报名重复提交即覆盖更新 */
export interface CompetitionResultRequest {
  competitionId: number
  registrationId: number
  award: AwardCode
  score?: number
  comment?: string
}

/** 竞赛详情 */
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

/** 竞赛报名记录 */
export interface RegistrationResponse {
  id: number
  competitionId: number
  competitionName: string
  studentId: number
  studentName: string
  teamName: string | null
  /** 团队成员 user.id 逗号分隔,个人赛为 null */
  members: string | null
  status: AuditStatus
  registerTime: string
  /** 审核/评审时间,待审核为 null */
  reviewTime: string | null
  reviewComment: string | null
}

/** 竞赛获奖结果 */
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

/** 竞赛分页查询条件,status 传英文 code */
export interface CompetitionQuery {
  status?: CompetitionStatusCode
  page?: number
  pageSize?: number
}

// ===== 社会实践 =====

/** 创建社会实践项目请求 */
export interface SocialPracticeCreateRequest {
  /** 所属学期,缺省表示不关联 */
  semesterId?: number | null
  title: string
  description?: string
  organizer?: string
  startTime?: string | null
  endTime?: string | null
  capacity: number
}

/** 更新社会实践项目请求,字段均可选 */
export interface SocialPracticeUpdateRequest {
  title?: string
  description?: string
  organizer?: string
  startTime?: string | null
  endTime?: string | null
  capacity?: number
}

/** 学生申报社会实践请求,个人申报不传 teamName/members */
export interface SocialPracticeApplyRequest {
  practiceId: number
  teamName?: string
  /** 团队成员 user.id 逗号分隔串,个人申报不传 */
  members?: string
  applyReason?: string
}

/** 社会实践申报审核请求 */
export interface SocialPracticeReviewRequest {
  approved: boolean
  reviewComment?: string
}

/** 提交社会实践报告请求(附件单独作为文件上传) */
export interface SocialPracticeReportSubmitRequest {
  practiceId: number
  title: string
  summary?: string
  /** 分片上传产物路径(objects/...),与 multipart 的 file 部分二选一;>20MB 时走这里 */
  filePath?: string
  /** 展示文件名,配合 filePath 使用 */
  fileOriginal?: string
}

/** 社会实践报告评审请求(分数+评语,均可选) */
export interface SocialPracticeReportReviewRequest {
  score?: number
  feedback?: string
}

/** 社会实践项目详情 */
export interface SocialPracticeResponse {
  id: number
  semesterId: number
  title: string
  description: string | null
  organizer: string | null
  startTime: string | null
  endTime: string | null
  capacity: number
  /** 已申报人数(含待审核),用于容量控制 */
  selectedCount: number
  status: SocialPracticeStatus
  createTime: string
}

/** 社会实践申报记录 */
export interface SocialPracticeApplicationResponse {
  id: number
  practiceId: number
  practiceTitle: string
  studentId: number
  studentName: string
  teamName: string | null
  /** 团队成员 user.id 逗号分隔,个人申报为 null */
  members: string | null
  status: AuditStatus
  applyReason: string | null
  applyTime: string
  /** 审核/评审时间,待审核为 null */
  reviewTime: string | null
  reviewComment: string | null
}

/** 社会实践报告(含评审结果) */
export interface SocialPracticeReportResponse {
  id: number
  practiceId: number
  practiceTitle: string
  studentId: number
  studentName: string
  title: string
  summary: string | null
  /** 附件原始文件名,下载时展示 */
  fileOriginal: string | null
  submitTime: string
  score: number | null
  feedback: string | null
  /** 审核/评审时间,待审核为 null */
  reviewTime: string | null
  status: ReportStatus
}

/** 社会实践项目分页查询条件,status 传英文 code */
export interface SocialPracticeQuery {
  status?: SocialPracticeStatusCode
  page?: number
  pageSize?: number
}

/** 社会实践报告分页查询条件,status 传英文 code */
export interface SocialPracticeReportQuery {
  status?: ReportStatusCode
  page?: number
  pageSize?: number
}
