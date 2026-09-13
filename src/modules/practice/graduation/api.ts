import { api } from '@/shared/api'
import { downloadPracticeFile } from '@/modules/practice/utils'
import type { PageResult, Result } from '@/shared/types'
import type {
  CampaignCreateRequest,
  CampaignUpdateRequest,
  CampaignResponse,
  CampaignQuery,
  CampaignStatusCode,
  ProposalDeclareRequest,
  ProposalReviewRequest,
  ProposalResponse,
  PickRequest,
  AllocationRequest,
  ReassignRequest,
  AssignmentResponse,
  TeacherPickPoolRow,
  AssignmentOverviewRow,
  DashboardRow,
  DashboardStatusFilter,
  OperationLogResponse,
  OpeningReportSubmitRequest,
  OpeningReportReviewRequest,
  OpeningReportResponse,
  MidtermSubmitRequest,
  MidtermReviewRequest,
  MidtermResponse,
  GuidanceLogCreateRequest,
  GuidanceLogResponse,
  ThesisSubmitRequest,
  ThesisReviewRequest,
  ThesisResponse,
  DuplicateCheckRegisterRequest,
  DuplicateCheckResponse,
  ThesisStatusCode,
  DefenseArrangeRequest,
  DefenseResponse,
  ScoreSubmitRequest,
  ScoreConfirmRequest,
  ScoreResponse,
} from './types'

// 毕业设计(论文)管理模块统一前缀,接口依据《毕业设计与论文 接口文档》2026-08-11 版(53 接口)
const BASE = '/practice/graduation'

// ===== 毕设活动 =====

/** 创建毕设活动 POST /practice/graduation/campaigns */
export function createCampaign(body: CampaignCreateRequest): Promise<Result<CampaignResponse>> {
  return api.post(`${BASE}/campaigns`, body)
}

/** 更新毕设活动基本信息 PUT /practice/graduation/campaigns/{id} */
export function updateCampaign(
  id: number,
  body: CampaignUpdateRequest,
): Promise<Result<CampaignResponse>> {
  return api.put(`${BASE}/campaigns/${id}`, body)
}

/** 流转活动状态(草稿/进行中/已结束) PUT /practice/graduation/campaigns/{id}/status */
export function updateCampaignStatus(
  id: number,
  status: CampaignStatusCode,
): Promise<Result<null>> {
  return api.put(`${BASE}/campaigns/${id}/status?status=${status}`)
}

/** 教务分页活动列表 */
export function fetchCampaigns(
  query?: CampaignQuery,
): Promise<Result<PageResult<CampaignResponse>>> {
  const params = new URLSearchParams()
  if (query?.status) params.set('status', query.status)
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/campaigns${qs ? `?${qs}` : ''}`)
}

/** 活动详情 GET /practice/graduation/campaigns/{id} */
export function fetchCampaign(id: number): Promise<Result<CampaignResponse>> {
  return api.get(`${BASE}/campaigns/${id}`)
}

/** 学生可见活动（OPEN 且年级匹配） */
export function fetchAvailableCampaigns(): Promise<Result<CampaignResponse[]>> {
  return api.get(`${BASE}/campaigns/available`)
}

/**
 * 教师/院系活动选择器列表（返回所有非草稿活动）。
 * 学生用 fetchAvailableCampaigns；教务用 fetchCampaigns 分页拉全量。
 */
export function fetchSelectorCampaigns(): Promise<Result<CampaignResponse[]>> {
  return api.get(`${BASE}/campaigns/selector`)
}

// ===== 选题申报 =====

/** 学生提交选题申报 POST /practice/graduation/proposals */
export function submitProposal(body: ProposalDeclareRequest): Promise<Result<ProposalResponse>> {
  return api.post(`${BASE}/proposals`, body)
}

/** 院系初审选题(通过则进入教务终审) PUT /practice/graduation/proposals/{id}/review/dept */
export function reviewProposalDept(
  id: number,
  body: ProposalReviewRequest,
): Promise<Result<ProposalResponse>> {
  return api.put(`${BASE}/proposals/${id}/review/dept`, body)
}

/** 教务终审选题(通过则审批完毕) PUT /practice/graduation/proposals/{id}/review/academic */
export function reviewProposalAcademic(
  id: number,
  body: ProposalReviewRequest,
): Promise<Result<ProposalResponse>> {
  return api.put(`${BASE}/proposals/${id}/review/academic`, body)
}

/** 学生:我的选题列表(含两级审核记录) GET /practice/graduation/proposals/my */
export function fetchMyProposals(): Promise<Result<ProposalResponse[]>> {
  return api.get(`${BASE}/proposals/my`)
}

/** 院系:待初审选题列表 GET /practice/graduation/proposals/pending/dept */
export function fetchPendingDeptProposals(campaignId: number): Promise<Result<ProposalResponse[]>> {
  return api.get(`${BASE}/proposals/pending/dept?campaignId=${campaignId}`)
}

/** 教务:待终审选题列表 GET /practice/graduation/proposals/pending/academic */
export function fetchPendingAcademicProposals(
  campaignId: number,
): Promise<Result<ProposalResponse[]>> {
  return api.get(`${BASE}/proposals/pending/academic?campaignId=${campaignId}`)
}

// ===== 师生匹配 =====

/** 教师从学生池选定学生(建立指导关系) POST /practice/graduation/assignments/picks */
export function pickStudent(body: PickRequest): Promise<Result<AssignmentResponse>> {
  return api.post(`${BASE}/assignments/picks`, body)
}

/** 教师取消已选定的学生 DELETE /practice/graduation/assignments/picks/{id} */
export function unpickStudent(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/assignments/picks/${id}`)
}

/** 院系把学生直接分配给指导教师 POST /practice/graduation/assignments/allocations */
export function allocateStudent(body: AllocationRequest): Promise<Result<AssignmentResponse>> {
  return api.post(`${BASE}/assignments/allocations`, body)
}

/** 院系改派指导教师(必须填写改派原因,保留原教师记录) POST /practice/graduation/assignments/reassigns */
export function reassignStudent(body: ReassignRequest): Promise<Result<AssignmentResponse>> {
  return api.post(`${BASE}/assignments/reassigns`, body)
}

/** 教师学生池:本院系学生的选题与匹配情况,供教师挑选 GET /practice/graduation/assignments/teacher/pool */
export function fetchTeacherPool(campaignId: number): Promise<Result<TeacherPickPoolRow[]>> {
  return api.get(`${BASE}/assignments/teacher/pool?campaignId=${campaignId}`)
}

/** 我的匹配（学生本人 / 教师名下，campaignId 可空） */
export function fetchMyAssignments(
  campaignId?: number | null,
): Promise<Result<AssignmentResponse[]>> {
  const qs = campaignId != null ? `?campaignId=${campaignId}` : ''
  return api.get(`${BASE}/assignments/my${qs}`)
}

/** 分配总览:各指导教师的选定/指派人数、容量与余量 GET /practice/graduation/assignments/overview */
export function fetchAssignmentOverview(
  campaignId: number,
): Promise<Result<AssignmentOverviewRow[]>> {
  return api.get(`${BASE}/assignments/overview?campaignId=${campaignId}`)
}

/** 未分配学生 id 列表（院系强制本院系；教务可传 collegeId 过滤） */
export function fetchUnassignedStudentIds(
  campaignId: number,
  collegeId?: number | null,
): Promise<Result<number[]>> {
  const params = new URLSearchParams({ campaignId: String(campaignId) })
  if (collegeId != null) params.set('collegeId', String(collegeId))
  return api.get(`${BASE}/assignments/unassigned?${params.toString()}`)
}

// ===== 看板与导出 =====

/** 看板查询参数:状态聚合筛选、关键字、院系过滤与分页 */
export interface DashboardQuery {
  status?: DashboardStatusFilter
  keyword?: string
  collegeId?: number
  page?: number
  pageSize?: number
}

/** 全局看板分页数据 GET /practice/graduation/dashboard/{campaignId},返回 PageResult */
export function fetchDashboard(
  campaignId: number,
  query?: DashboardQuery,
): Promise<Result<PageResult<DashboardRow>>> {
  const params = new URLSearchParams()
  if (query?.status) params.set('status', query.status)
  if (query?.keyword) params.set('keyword', query.keyword)
  if (query?.collegeId != null) params.set('collegeId', String(query.collegeId))
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/dashboard/${campaignId}${qs ? `?${qs}` : ''}`)
}

/** 导出看板(xlsx/csv),筛选条件与列表查询一致,直接触发浏览器下载 */
export function exportDashboard(
  campaignId: number,
  format: 'xlsx' | 'csv',
  query?: { status?: DashboardStatusFilter; keyword?: string; collegeId?: number },
): Promise<void> {
  const params = new URLSearchParams({ format })
  if (query?.status) params.set('status', query.status)
  if (query?.keyword) params.set('keyword', query.keyword)
  if (query?.collegeId != null) params.set('collegeId', String(query.collegeId))
  return downloadPracticeFile(`${BASE}/dashboard/${campaignId}/export?${params.toString()}`)
}

/** 活动操作日志分页 GET /practice/graduation/dashboard/{campaignId}/logs,返回 PageResult */
export function fetchOperationLogs(
  campaignId: number,
  page: number,
  pageSize: number,
): Promise<Result<PageResult<OperationLogResponse>>> {
  return api.get(`${BASE}/dashboard/${campaignId}/logs?page=${page}&pageSize=${pageSize}`)
}

// ===== 过程管理（开题/中期/指导日志）=====

/** 学生提交开题报告(data JSON + 可选附件 file 的 multipart 表单) POST /practice/graduation/process/opening-reports */
export function submitOpeningReport(
  data: OpeningReportSubmitRequest,
  file: File | null,
): Promise<Result<OpeningReportResponse>> {
  const fd = new FormData()
  fd.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  if (file) fd.append('file', file)
  return api.postForm(`${BASE}/process/opening-reports`, fd)
}

/** 教师审核开题报告(通过/需修改) PUT /practice/graduation/process/opening-reports/{id}/review */
export function reviewOpeningReport(
  id: number,
  body: OpeningReportReviewRequest,
): Promise<Result<OpeningReportResponse>> {
  return api.put(`${BASE}/process/opening-reports/${id}/review`, body)
}

/** 学生:我的开题报告,未提交时返回 null GET /practice/graduation/process/opening-reports/my */
export function fetchMyOpeningReport(
  campaignId: number,
): Promise<Result<OpeningReportResponse | null>> {
  return api.get(`${BASE}/process/opening-reports/my?campaignId=${campaignId}`)
}

/** 教师:名下学生的开题报告列表 GET /practice/graduation/process/opening-reports/teacher */
export function fetchTeacherOpeningReports(
  campaignId: number,
): Promise<Result<OpeningReportResponse[]>> {
  return api.get(`${BASE}/process/opening-reports/teacher?campaignId=${campaignId}`)
}

/** 下载开题报告附件 */
export function downloadOpeningReport(id: number): Promise<void> {
  return downloadPracticeFile(`${BASE}/process/opening-reports/${id}/download`)
}

/** 学生提交中期检查(data JSON + 可选附件 file 的 multipart 表单) POST /practice/graduation/process/midterms */
export function submitMidterm(
  data: MidtermSubmitRequest,
  file: File | null,
): Promise<Result<MidtermResponse>> {
  const fd = new FormData()
  fd.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  if (file) fd.append('file', file)
  return api.postForm(`${BASE}/process/midterms`, fd)
}

/** 教师评审中期检查(结论:正常/警告/严重滞后) PUT /practice/graduation/process/midterms/{id}/review */
export function reviewMidterm(
  id: number,
  body: MidtermReviewRequest,
): Promise<Result<MidtermResponse>> {
  return api.put(`${BASE}/process/midterms/${id}/review`, body)
}

/** 学生:我的中期检查,未提交时返回 null GET /practice/graduation/process/midterms/my */
export function fetchMyMidterm(campaignId: number): Promise<Result<MidtermResponse | null>> {
  return api.get(`${BASE}/process/midterms/my?campaignId=${campaignId}`)
}

/** 教师:名下学生的中期检查列表 GET /practice/graduation/process/midterms/teacher */
export function fetchTeacherMidterms(campaignId: number): Promise<Result<MidtermResponse[]>> {
  return api.get(`${BASE}/process/midterms/teacher?campaignId=${campaignId}`)
}

/** 下载中期检查附件 */
export function downloadMidterm(id: number): Promise<void> {
  return downloadPracticeFile(`${BASE}/process/midterms/${id}/download`)
}

/** 教师登记指导日志(时间/形式/内容) POST /practice/graduation/process/guidance-logs */
export function createGuidanceLog(
  body: GuidanceLogCreateRequest,
): Promise<Result<GuidanceLogResponse>> {
  return api.post(`${BASE}/process/guidance-logs`, body)
}

/** 指导日志列表,可按活动/学生过滤;教师查名下,学生查本人 */
export function fetchGuidanceLogs(
  campaignId?: number | null,
  studentId?: number | null,
): Promise<Result<GuidanceLogResponse[]>> {
  const params = new URLSearchParams()
  if (campaignId != null) params.set('campaignId', String(campaignId))
  if (studentId != null) params.set('studentId', String(studentId))
  const qs = params.toString()
  return api.get(`${BASE}/process/guidance-logs${qs ? `?${qs}` : ''}`)
}

// ===== 论文与查重 =====

/** 学生提交论文(data JSON + 必传论文文件 的 multipart 表单,每次提交生成新版本) POST /practice/graduation/theses */
export function submitThesis(
  data: ThesisSubmitRequest,
  file: File,
): Promise<Result<ThesisResponse>> {
  const fd = new FormData()
  fd.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  fd.append('file', file)
  return api.postForm(`${BASE}/theses`, fd)
}

/** 教师形式审查论文(通过/退回) PUT /practice/graduation/theses/{id}/review */
export function reviewThesis(
  id: number,
  body: ThesisReviewRequest,
): Promise<Result<ThesisResponse>> {
  return api.put(`${BASE}/theses/${id}/review`, body)
}

/** 学生:我的论文(含历史版本与嵌套查重记录) GET /practice/graduation/theses/my */
export function fetchMyTheses(campaignId?: number | null): Promise<Result<ThesisResponse[]>> {
  const qs = campaignId != null ? `?campaignId=${campaignId}` : ''
  return api.get(`${BASE}/theses/my${qs}`)
}

/** 教师:名下学生的论文列表 GET /practice/graduation/theses/teacher */
export function fetchTeacherTheses(campaignId: number): Promise<Result<ThesisResponse[]>> {
  return api.get(`${BASE}/theses/teacher?campaignId=${campaignId}`)
}

/** 活动内全部论文(可按状态过滤,供教务查重/形式审查管理) GET /practice/graduation/theses/campaign */
export function fetchCampaignTheses(
  campaignId: number,
  status?: ThesisStatusCode | null,
): Promise<Result<ThesisResponse[]>> {
  const params = new URLSearchParams({ campaignId: String(campaignId) })
  if (status) params.set('status', status)
  return api.get(`${BASE}/theses/campaign?${params.toString()}`)
}

/** 教务登记论文查重结果(重复率/平台/结论),一篇论文可登记多次 POST /practice/graduation/theses/duplicate-checks */
export function registerDuplicateCheck(
  body: DuplicateCheckRegisterRequest,
): Promise<Result<DuplicateCheckResponse>> {
  return api.post(`${BASE}/theses/duplicate-checks`, body)
}

/** 论文的历次查重记录(最新在前由后端保证) GET /practice/graduation/theses/{thesisId}/duplicate-checks */
export function fetchDuplicateChecks(thesisId: number): Promise<Result<DuplicateCheckResponse[]>> {
  return api.get(`${BASE}/theses/${thesisId}/duplicate-checks`)
}

/** 下载论文文件 */
export function downloadThesis(id: number): Promise<void> {
  return downloadPracticeFile(`${BASE}/theses/${id}/download`)
}

/** 打包导出活动内论文(可按状态过滤),直接触发浏览器下载 */
export function exportThesisPackage(
  campaignId: number,
  status?: ThesisStatusCode | null,
): Promise<void> {
  const params = new URLSearchParams({ campaignId: String(campaignId) })
  if (status) params.set('status', status)
  return downloadPracticeFile(`${BASE}/theses/export-package?${params.toString()}`)
}

// ===== 答辩与成绩 =====

/** 院系安排/调整答辩(答辩组、时间地点、评阅人、答辩教师) POST /practice/graduation/defense/arrange */
export function arrangeDefense(body: DefenseArrangeRequest): Promise<Result<DefenseResponse>> {
  return api.post(`${BASE}/defense/arrange`, body)
}

/** 活动内答辩安排列表 GET /practice/graduation/defense/list */
export function fetchDefenseList(campaignId: number): Promise<Result<DefenseResponse[]>> {
  return api.get(`${BASE}/defense/list?campaignId=${campaignId}`)
}

/** 指导教师录入指导成绩 POST /practice/graduation/defense/scores/advisor */
export function submitAdvisorScore(body: ScoreSubmitRequest): Promise<Result<ScoreResponse>> {
  return api.post(`${BASE}/defense/scores/advisor`, body)
}

/** 指导评分录入列表：教师名下学生（含未生成成绩记录的骨架行） */
export function fetchAdvisorScoreEntries(campaignId: number): Promise<Result<ScoreResponse[]>> {
  return api.get(`${BASE}/defense/scores/advisor?campaignId=${campaignId}`)
}

/** 评阅教师录入评阅成绩 POST /practice/graduation/defense/scores/reviewer */
export function submitReviewerScore(body: ScoreSubmitRequest): Promise<Result<ScoreResponse>> {
  return api.post(`${BASE}/defense/scores/reviewer`, body)
}

/** 评阅评分录入列表：本人为评阅人的学生（含答辩组） */
export function fetchReviewerScoreEntries(campaignId: number): Promise<Result<ScoreResponse[]>> {
  return api.get(`${BASE}/defense/scores/reviewer?campaignId=${campaignId}`)
}

/** 录入答辩成绩(院系/答辩组在答辩后录入) POST /practice/graduation/defense/scores/defense */
export function submitDefenseScore(body: ScoreSubmitRequest): Promise<Result<ScoreResponse>> {
  return api.post(`${BASE}/defense/scores/defense`, body)
}

/** 三项分项齐备后合成总评并确认 POST /practice/graduation/defense/scores/confirm */
export function confirmScore(body: ScoreConfirmRequest): Promise<Result<ScoreResponse>> {
  return api.post(`${BASE}/defense/scores/confirm`, body)
}

/** 活动内成绩列表(成绩总览用) GET /practice/graduation/defense/scores */
export function fetchScores(campaignId: number): Promise<Result<ScoreResponse[]>> {
  return api.get(`${BASE}/defense/scores?campaignId=${campaignId}`)
}

/** 学生:我的总评成绩,未生成时返回 null GET /practice/graduation/defense/scores/my */
export function fetchMyScore(campaignId: number): Promise<Result<ScoreResponse | null>> {
  return api.get(`${BASE}/defense/scores/my?campaignId=${campaignId}`)
}

/** 导出活动成绩表,直接触发浏览器下载 */
export function exportScores(campaignId: number): Promise<void> {
  return downloadPracticeFile(`${BASE}/defense/scores/export?campaignId=${campaignId}`)
}
