// ===== 毕业设计与论文管理模块 类型定义 =====
// 对接依据：《毕业设计与论文 接口文档》2026-08-11 版（53 接口）
// 约定：响应中枚举为中文描述，请求/查询参数用英文枚举名 code

// ===== 枚举（中文 = 响应值，Code = 请求/查询值）=====

/** 活动状态（中文） */
export type CampaignStatus = '草稿' | '进行中' | '已结束'
/** 活动状态 code */
export type CampaignStatusCode = 'DRAFT' | 'OPEN' | 'CLOSED'

/** 选题状态（中文） */
export type ProposalStatus = '待院系初审' | '待教务终审' | '审批完毕' | '已驳回'
/** 选题状态 code */
export type ProposalStatusCode = 'PENDING_DEPT' | 'DEPT_APPROVED' | 'APPROVED' | 'REJECTED'

/** 匹配来源（中文） */
export type AssignmentSource = '教师自选' | '院系指定'
/** 匹配来源 code */
export type AssignmentSourceCode = 'TEACHER_PICK' | 'DEPT_ALLOCATE'

/** 开题状态（中文） */
export type OpeningReportStatus = '已提交' | '已通过' | '需修改'
/** 开题状态 code */
export type OpeningReportStatusCode = 'SUBMITTED' | 'APPROVED' | 'REVISION'

/** 中期结论（中文） */
export type MidtermConclusion = '正常' | '警告' | '严重滞后'
/** 中期结论 code */
export type MidtermConclusionCode = 'NORMAL' | 'WARNING' | 'SEVERE_LAGGING'

/** 指导形式（中文） */
export type GuidanceForm = '线上' | '线下' | '电话'
/** 指导形式 code */
export type GuidanceFormCode = 'ONLINE' | 'OFFLINE' | 'PHONE'

/** 论文状态（中文） */
export type ThesisStatus =
  | '待形式审查'
  | '形式审查通过'
  | '形式审查退回'
  | '查重通过'
  | '查重不通过'
/** 论文状态 code */
export type ThesisStatusCode =
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REVISION'
  | 'DUPLICATE_PASSED'
  | 'DUPLICATE_FAILED'

/** 查重结论（中文） */
export type DuplicateResult = '通过' | '不通过'
/** 查重结论 code */
export type DuplicateResultCode = 'PASS' | 'FAIL'

/** 成绩状态（中文） */
export type GraduationScoreStatus = '分项未齐备' | '已合成总评' | '已发布'
/** 成绩状态 code */
export type GraduationScoreStatusCode = 'INCOMPLETE' | 'COMPLETE' | 'PUBLISHED'

// ===== 毕设活动 =====

export interface CampaignCreateRequest {
  name: string
  allowedGradeIds: number[]
  topicStartTime: string
  topicEndTime: string
  supervisorCapacity: number
  freeSelectCapacity: number
  openingStartTime?: string | null
  openingEndTime?: string | null
  midtermStartTime?: string | null
  midtermEndTime?: string | null
  thesisStartTime?: string | null
  thesisEndTime?: string | null
  advisorWeight?: number
  reviewerWeight?: number
  defenseWeight?: number
}

export interface CampaignUpdateRequest {
  name?: string
  allowedGradeIds?: number[]
  topicStartTime?: string
  topicEndTime?: string
  supervisorCapacity?: number
  freeSelectCapacity?: number
  openingStartTime?: string | null
  openingEndTime?: string | null
  midtermStartTime?: string | null
  midtermEndTime?: string | null
  thesisStartTime?: string | null
  thesisEndTime?: string | null
  advisorWeight?: number
  reviewerWeight?: number
  defenseWeight?: number
}

export interface CampaignResponse {
  id: number
  name: string
  allowedGradeIds: number[]
  topicStartTime: string
  topicEndTime: string
  supervisorCapacity: number
  freeSelectCapacity: number
  openingStartTime: string | null
  openingEndTime: string | null
  midtermStartTime: string | null
  midtermEndTime: string | null
  thesisStartTime: string | null
  thesisEndTime: string | null
  advisorWeight: number
  reviewerWeight: number
  defenseWeight: number
  status: CampaignStatus
  createTime: string
}

export interface CampaignQuery {
  status?: CampaignStatusCode
  page?: number
  pageSize?: number
}

// ===== 选题申报 =====

export interface ProposalDeclareRequest {
  campaignId: number
  title: string
  content: string
}

export interface ProposalReviewRequest {
  approve: boolean
  comment?: string
}

export interface ProposalReviewView {
  stage: string
  action: string
  reviewerId: number
  reviewerName: string
  reviewTime: string
  comment: string | null
}

export interface ProposalResponse {
  id: number
  campaignId: number
  studentId: number
  studentName: string
  studentNo: string
  title: string
  content: string
  status: ProposalStatus
  rejectReason: string | null
  submitTime: string
  reviews: ProposalReviewView[]
}

// ===== 师生匹配 =====

export interface PickRequest {
  campaignId: number
  studentId: number
}

export interface AllocationRequest {
  campaignId: number
  studentId: number
  teacherId: number
}

export interface ReassignRequest {
  campaignId: number
  studentId: number
  newTeacherId: number
  reason: string
}

export interface AssignmentResponse {
  id: number
  campaignId: number
  studentId: number
  studentName: string
  studentNo: string
  teacherId: number
  teacherName: string
  source: AssignmentSource
  assignTime: string
  prevTeacherId: number | null
  prevTeacherName: string | null
  reassignReason: string | null
  reassignTime: string | null
}

export interface TeacherPickPoolRow {
  studentId: number
  studentNo: string
  studentName: string
  className: string
  proposalTitle: string | null
  proposalContent: string | null
  proposalStatus: ProposalStatus | null
  assigned: boolean
  assignmentSource: AssignmentSource | null
}

export interface AssignmentOverviewRow {
  teacherId: number
  teacherName: string
  teacherNo: string
  pickedCount: number
  allocatedCount: number
  capacity: number
  freeCount: number
}

// ===== 看板与日志 =====

/** 看板状态筛选 code（含聚合值 NOT_SUBMITTED / PENDING） */
export type DashboardStatusFilter = 'NOT_SUBMITTED' | 'PENDING' | ProposalStatusCode

export interface DashboardRow {
  studentId: number
  studentNo: string
  studentName: string
  className: string
  collegeId: number
  collegeName: string
  gradeName: string
  proposalId: number | null
  proposalTitle: string | null
  proposalContent: string | null
  proposalStatus: ProposalStatus | null
  proposalSubmitTime: string | null
  proposalApprovedTime: string | null
  assignmentId: number | null
  teacherId: number | null
  teacherName: string | null
  assignmentSource: AssignmentSource | null
  midtermId: number | null
  midtermConclusion: MidtermConclusion | null
}

export interface OperationLogResponse {
  id: number
  campaignId: number
  operatorId: number
  operatorName: string
  operatorType: string
  action: string
  targetType: string
  targetId: number
  detail: string
  createTime: string
}

// ===== 过程管理 =====

export interface OpeningReportSubmitRequest {
  campaignId: number
  title: string
  content: string
}

export interface OpeningReportReviewRequest {
  approve: boolean
  comment?: string
}

export interface OpeningReportResponse {
  id: number
  campaignId: number
  assignmentId: number
  studentId: number
  studentName: string
  title: string
  content: string
  fileOriginal: string | null
  status: OpeningReportStatus
  submitTime: string
  reviewTeacherId: number | null
  reviewTeacherName: string | null
  reviewComment: string | null
  reviewTime: string | null
}

export interface MidtermSubmitRequest {
  campaignId: number
  content: string
}

export interface MidtermReviewRequest {
  conclusion: MidtermConclusionCode
  comment?: string
}

export interface MidtermResponse {
  id: number
  campaignId: number
  assignmentId: number
  studentId: number
  studentName: string
  content: string
  fileOriginal: string | null
  status: '已提交' | '已评审'
  conclusion: MidtermConclusion | null
  submitTime: string
  reviewTeacherId: number | null
  reviewTeacherName: string | null
  reviewComment: string | null
  reviewTime: string | null
}

export interface GuidanceLogCreateRequest {
  campaignId: number
  studentId: number
  logTime: string
  form: GuidanceFormCode
  summary: string
}

export interface GuidanceLogResponse {
  id: number
  campaignId: number
  studentId: number
  studentName: string
  logTime: string
  form: GuidanceForm
  summary: string
  createTime: string
}

// ===== 论文与查重 =====

export interface ThesisSubmitRequest {
  campaignId: number
  title: string
}

export interface ThesisReviewRequest {
  approve: boolean
  comment?: string
}

export interface ThesisResponse {
  id: number
  campaignId: number
  assignmentId: number
  studentId: number
  studentName: string
  title: string
  fileName: string
  fileOriginal: string
  version: number
  isLatest: number
  status: ThesisStatus
  submitTime: string
  reviewTeacherId: number | null
  reviewTeacherName: string | null
  reviewComment: string | null
  reviewTime: string | null
  duplicateChecks: DuplicateCheckResponse[]
}

export interface DuplicateCheckRegisterRequest {
  thesisId: number
  duplicateRate: number
  platform?: string
  checkTime: string
  result: DuplicateResultCode
  comment?: string
}

export interface DuplicateCheckResponse {
  id: number
  thesisId: number
  duplicateRate: number
  platform: string | null
  checkTime: string
  result: DuplicateResult
  comment: string | null
  operatorId: number
  operatorName: string
  createTime: string
}

export interface ThesisQuery {
  status?: ThesisStatusCode
  page?: number
  pageSize?: number
}

// ===== 答辩与成绩 =====

export interface DefenseArrangeRequest {
  campaignId: number
  studentId: number
  groupName?: string
  defenseTime?: string | null
  location?: string
  reviewerId?: number | null
  defenseTeacherIds?: number[]
}

export interface DefenseResponse {
  id: number
  campaignId: number
  studentId: number
  studentName: string
  studentNo: string
  groupName: string | null
  defenseTime: string | null
  location: string | null
  reviewerId: number | null
  reviewerName: string | null
  defenseTeacherIds: number[]
  defenseTeacherNames: string[]
}

export interface ScoreSubmitRequest {
  campaignId: number
  studentId: number
  score: number
}

export interface ScoreConfirmRequest {
  campaignId: number
  studentId: number
}

export interface ScoreResponse {
  id: number
  campaignId: number
  studentId: number
  studentName: string
  advisorScore: number | null
  advisorBy: number | null
  advisorName: string | null
  advisorTime: string | null
  reviewerScore: number | null
  reviewerBy: number | null
  reviewerName: string | null
  reviewerTime: string | null
  defenseScore: number | null
  defenseBy: number | null
  defenseName: string | null
  defenseTime: string | null
  totalScore: number | null
  status: GraduationScoreStatus
  confirmBy: number | null
  confirmName: string | null
  confirmTime: string | null
  publishTime: string | null
}
