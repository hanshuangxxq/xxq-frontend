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

/** 创建毕设活动请求;opening/midterm/thesis 时间窗留空表示该阶段不启用,三项 weight 为总评合成权重 */
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

/** 更新毕设活动,全字段可选;时间窗传 null 表示停用该阶段 */
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

/** 毕设活动详情/列表行;status 为中文描述,流转操作传 CampaignStatusCode */
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

/** 教务活动分页查询;status 用 code 过滤 */
export interface CampaignQuery {
  status?: CampaignStatusCode
  page?: number
  pageSize?: number
}

// ===== 选题申报 =====

/** 学生选题申报(在活动选题时间窗内提交,先经院系初审再教务终审) */
export interface ProposalDeclareRequest {
  campaignId: number
  title: string
  content: string
}

/** 选题审核请求,院系初审/教务终审通用;comment 为审核意见 */
export interface ProposalReviewRequest {
  approve: boolean
  comment?: string
}

/** 单条审核记录(一次院系初审或一次教务终审) */
export interface ProposalReviewView {
  stage: string
  action: string
  reviewerId: number
  reviewerName: string
  reviewTime: string
  comment: string | null
}

/** 选题详情;status 为中文描述,reviews 记录两级审核流水 */
export interface ProposalResponse {
  id: number
  campaignId: number
  studentId: number
  studentName: string
  studentNo: string
  title: string
  content: string
  status: ProposalStatus
  /** 驳回原因,仅已驳回时有值 */
  rejectReason: string | null
  submitTime: string
  reviews: ProposalReviewView[]
}

// ===== 师生匹配 =====

/** 教师从学生池选定学生,建立指导关系 */
export interface PickRequest {
  campaignId: number
  studentId: number
}

/** 院系把学生直接指派给指导教师 */
export interface AllocationRequest {
  campaignId: number
  studentId: number
  teacherId: number
}

/** 院系改派指导教师;reason 必填,用于改派留痕 */
export interface ReassignRequest {
  campaignId: number
  studentId: number
  newTeacherId: number
  reason: string
}

/** 师生匹配记录;source 区分教师自选/院系指定,prevTeacher* 与 reassign* 记录最近一次改派 */
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
  /** 改派前原指导教师 id,无改派历史为 null */
  prevTeacherId: number | null
  /** 改派前原指导教师姓名 */
  prevTeacherName: string | null
  /** 最近一次改派原因,无改派为 null */
  reassignReason: string | null
  /** 最近一次改派时间 */
  reassignTime: string | null
}

/** 教师学生池行;proposalStatus 为 null 表示该生未申报选题,assigned 表示已被匹配 */
export interface TeacherPickPoolRow {
  studentId: number
  studentNo: string
  studentName: string
  className: string
  proposalTitle: string | null
  proposalContent: string | null
  proposalStatus: ProposalStatus | null
  /** 是否已被匹配(被某位教师选定或院系指派) */
  assigned: boolean
  assignmentSource: AssignmentSource | null
}

/** 分配总览行(按指导教师聚合);pickedCount 为教师自选数,allocatedCount 为院系指派数 */
export interface AssignmentOverviewRow {
  teacherId: number
  teacherName: string
  teacherNo: string
  pickedCount: number
  allocatedCount: number
  /** 指导名额上限(来自活动 supervisorCapacity) */
  capacity: number
  /** 剩余可分配名额 */
  freeCount: number
}

// ===== 看板与日志 =====

/** 看板状态筛选 code（含聚合值 NOT_SUBMITTED / PENDING） */
export type DashboardStatusFilter = 'NOT_SUBMITTED' | 'PENDING' | ProposalStatusCode

/** 看板行(学生粒度聚合各环节进展);proposal 相关字段为 null 表示未提交选题,assignment/teacher 相关字段为 null 表示未匹配教师,midterm 相关字段为 null 表示未提交中期 */
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

/** 活动操作日志;action 为操作描述文本,detail 为业务详情 */
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

/** 学生提交开题报告;附件走 multipart 表单,此处仅 JSON 字段 */
export interface OpeningReportSubmitRequest {
  campaignId: number
  title: string
  content: string
  /** 分片上传产物路径(objects/...),与 multipart 的 file 部分二选一;>20MB 时走这里 */
  filePath?: string
  /** 展示文件名,配合 filePath 使用 */
  fileOriginal?: string
}

/** 教师审核开题报告;approve=false 表示需修改 */
export interface OpeningReportReviewRequest {
  approve: boolean
  comment?: string
}

/** 开题报告详情;fileOriginal 为附件原始文件名,review* 为 null 表示未审核 */
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

/** 学生提交中期检查内容;附件走 multipart 表单 */
export interface MidtermSubmitRequest {
  campaignId: number
  content: string
  /** 分片上传产物路径(objects/...),与 multipart 的 file 部分二选一;>20MB 时走这里 */
  filePath?: string
  /** 展示文件名,配合 filePath 使用 */
  fileOriginal?: string
}

/** 教师评审中期检查;conclusion 用 code,对应中文见 MidtermConclusion */
export interface MidtermReviewRequest {
  conclusion: MidtermConclusionCode
  comment?: string
}

/** 中期检查详情;conclusion 为 null 表示未评审 */
export interface MidtermResponse {
  id: number
  campaignId: number
  assignmentId: number
  studentId: number
  studentName: string
  content: string
  fileOriginal: string | null
  status: '已提交' | '已评审'
  /** 评审结论,未评审为 null */
  conclusion: MidtermConclusion | null
  submitTime: string
  reviewTeacherId: number | null
  reviewTeacherName: string | null
  reviewComment: string | null
  reviewTime: string | null
}

/** 教师登记指导日志;logTime 为指导发生时间,form 用 code */
export interface GuidanceLogCreateRequest {
  campaignId: number
  studentId: number
  logTime: string
  /** 指导形式 code,对应中文见 GuidanceForm */
  form: GuidanceFormCode
  summary: string
}

/** 指导日志;form 为中文描述 */
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

/** 学生提交论文;论文文件走 multipart 表单,此处仅 JSON 字段 */
export interface ThesisSubmitRequest {
  campaignId: number
  title: string
  /** 分片上传产物路径(objects/...),与 multipart 的 file 部分二选一;>20MB 时走这里 */
  filePath?: string
  /** 展示文件名,配合 filePath 使用 */
  fileOriginal?: string
}

/** 教师形式审查;approve=false 表示退回修改 */
export interface ThesisReviewRequest {
  approve: boolean
  comment?: string
}

/** 论文版本记录;学生每次提交生成一个新版本,isLatest 标记最新,duplicateChecks 嵌套查重记录 */
export interface ThesisResponse {
  id: number
  campaignId: number
  assignmentId: number
  studentId: number
  studentName: string
  title: string
  /** 存储文件名(下载接口使用) */
  fileName: string
  /** 原始文件名(界面展示用) */
  fileOriginal: string
  /** 版本号,每次提交递增 */
  version: number
  /** 是否最新版本:1 最新,0 历史版本 */
  isLatest: number
  status: ThesisStatus
  submitTime: string
  reviewTeacherId: number | null
  reviewTeacherName: string | null
  reviewComment: string | null
  reviewTime: string | null
  duplicateChecks: DuplicateCheckResponse[]
}

/** 教务登记查重结果;duplicateRate 为重复率百分数,checkTime 为查重时间 */
export interface DuplicateCheckRegisterRequest {
  thesisId: number
  duplicateRate: number
  platform?: string
  checkTime: string
  result: DuplicateResultCode
  comment?: string
}

/** 查重记录;result 为中文描述 */
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

/** 论文分页查询(预留类型,当前列表接口直接展开传参) */
export interface ThesisQuery {
  status?: ThesisStatusCode
  page?: number
  pageSize?: number
}

// ===== 答辩与成绩 =====

/** 答辩安排请求;reviewerId 为评阅教师,defenseTeacherIds 为答辩组教师 */
export interface DefenseArrangeRequest {
  campaignId: number
  studentId: number
  groupName?: string
  defenseTime?: string | null
  location?: string
  reviewerId?: number | null
  defenseTeacherIds?: number[]
}

/** 答辩安排详情;未安排的字段为 null */
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

/** 单项成绩录入请求;指导/评阅/答辩三个环节共用同一结构 */
export interface ScoreSubmitRequest {
  campaignId: number
  studentId: number
  score: number
}

/** 成绩确认请求;后端校验三项分项齐备后合成总评 */
export interface ScoreConfirmRequest {
  campaignId: number
  studentId: number
}

/** 成绩;advisor/reviewer/defense 分项为 null 表示未录入,totalScore 为 null 表示未合成,confirm 与 publish 相关字段记录确认/发布留痕 */
export interface ScoreResponse {
  id: number
  campaignId: number
  studentId: number
  studentName: string
  /** 学号：仅教师录入列表（/scores/advisor、/scores/reviewer GET）填充 */
  studentNo: string | null
  /** 答辩组：仅评阅录入列表填充 */
  groupName: string | null
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
  /** 合成总评,未合成为 null */
  totalScore: number | null
  status: GraduationScoreStatus
  confirmBy: number | null
  confirmName: string | null
  confirmTime: string | null
  /** 成绩发布时间,未发布为 null */
  publishTime: string | null
}
