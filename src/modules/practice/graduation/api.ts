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

const BASE = '/practice/graduation'

// ===== 毕设活动 =====

export function createCampaign(body: CampaignCreateRequest): Promise<Result<CampaignResponse>> {
  return api.post(`${BASE}/campaigns`, body)
}

export function updateCampaign(
  id: number,
  body: CampaignUpdateRequest,
): Promise<Result<CampaignResponse>> {
  return api.put(`${BASE}/campaigns/${id}`, body)
}

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

export function submitProposal(body: ProposalDeclareRequest): Promise<Result<ProposalResponse>> {
  return api.post(`${BASE}/proposals`, body)
}

export function reviewProposalDept(
  id: number,
  body: ProposalReviewRequest,
): Promise<Result<ProposalResponse>> {
  return api.put(`${BASE}/proposals/${id}/review/dept`, body)
}

export function reviewProposalAcademic(
  id: number,
  body: ProposalReviewRequest,
): Promise<Result<ProposalResponse>> {
  return api.put(`${BASE}/proposals/${id}/review/academic`, body)
}

export function fetchMyProposals(): Promise<Result<ProposalResponse[]>> {
  return api.get(`${BASE}/proposals/my`)
}

export function fetchPendingDeptProposals(campaignId: number): Promise<Result<ProposalResponse[]>> {
  return api.get(`${BASE}/proposals/pending/dept?campaignId=${campaignId}`)
}

export function fetchPendingAcademicProposals(
  campaignId: number,
): Promise<Result<ProposalResponse[]>> {
  return api.get(`${BASE}/proposals/pending/academic?campaignId=${campaignId}`)
}

// ===== 师生匹配 =====

export function pickStudent(body: PickRequest): Promise<Result<AssignmentResponse>> {
  return api.post(`${BASE}/assignments/picks`, body)
}

export function unpickStudent(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/assignments/picks/${id}`)
}

export function allocateStudent(body: AllocationRequest): Promise<Result<AssignmentResponse>> {
  return api.post(`${BASE}/assignments/allocations`, body)
}

export function reassignStudent(body: ReassignRequest): Promise<Result<AssignmentResponse>> {
  return api.post(`${BASE}/assignments/reassigns`, body)
}

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

export interface DashboardQuery {
  status?: DashboardStatusFilter
  keyword?: string
  collegeId?: number
  page?: number
  pageSize?: number
}

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

export function fetchOperationLogs(
  campaignId: number,
  page: number,
  pageSize: number,
): Promise<Result<PageResult<OperationLogResponse>>> {
  return api.get(`${BASE}/dashboard/${campaignId}/logs?page=${page}&pageSize=${pageSize}`)
}

// ===== 过程管理（开题/中期/指导日志）=====

export function submitOpeningReport(
  data: OpeningReportSubmitRequest,
  file: File | null,
): Promise<Result<OpeningReportResponse>> {
  const fd = new FormData()
  fd.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  if (file) fd.append('file', file)
  return api.postForm(`${BASE}/process/opening-reports`, fd)
}

export function reviewOpeningReport(
  id: number,
  body: OpeningReportReviewRequest,
): Promise<Result<OpeningReportResponse>> {
  return api.put(`${BASE}/process/opening-reports/${id}/review`, body)
}

export function fetchMyOpeningReport(
  campaignId: number,
): Promise<Result<OpeningReportResponse | null>> {
  return api.get(`${BASE}/process/opening-reports/my?campaignId=${campaignId}`)
}

export function fetchTeacherOpeningReports(
  campaignId: number,
): Promise<Result<OpeningReportResponse[]>> {
  return api.get(`${BASE}/process/opening-reports/teacher?campaignId=${campaignId}`)
}

export function downloadOpeningReport(id: number): Promise<void> {
  return downloadPracticeFile(`${BASE}/process/opening-reports/${id}/download`)
}

export function submitMidterm(
  data: MidtermSubmitRequest,
  file: File | null,
): Promise<Result<MidtermResponse>> {
  const fd = new FormData()
  fd.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  if (file) fd.append('file', file)
  return api.postForm(`${BASE}/process/midterms`, fd)
}

export function reviewMidterm(
  id: number,
  body: MidtermReviewRequest,
): Promise<Result<MidtermResponse>> {
  return api.put(`${BASE}/process/midterms/${id}/review`, body)
}

export function fetchMyMidterm(campaignId: number): Promise<Result<MidtermResponse | null>> {
  return api.get(`${BASE}/process/midterms/my?campaignId=${campaignId}`)
}

export function fetchTeacherMidterms(campaignId: number): Promise<Result<MidtermResponse[]>> {
  return api.get(`${BASE}/process/midterms/teacher?campaignId=${campaignId}`)
}

export function downloadMidterm(id: number): Promise<void> {
  return downloadPracticeFile(`${BASE}/process/midterms/${id}/download`)
}

export function createGuidanceLog(
  body: GuidanceLogCreateRequest,
): Promise<Result<GuidanceLogResponse>> {
  return api.post(`${BASE}/process/guidance-logs`, body)
}

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

export function submitThesis(
  data: ThesisSubmitRequest,
  file: File,
): Promise<Result<ThesisResponse>> {
  const fd = new FormData()
  fd.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  fd.append('file', file)
  return api.postForm(`${BASE}/theses`, fd)
}

export function reviewThesis(
  id: number,
  body: ThesisReviewRequest,
): Promise<Result<ThesisResponse>> {
  return api.put(`${BASE}/theses/${id}/review`, body)
}

export function fetchMyTheses(campaignId?: number | null): Promise<Result<ThesisResponse[]>> {
  const qs = campaignId != null ? `?campaignId=${campaignId}` : ''
  return api.get(`${BASE}/theses/my${qs}`)
}

export function fetchTeacherTheses(campaignId: number): Promise<Result<ThesisResponse[]>> {
  return api.get(`${BASE}/theses/teacher?campaignId=${campaignId}`)
}

export function fetchCampaignTheses(
  campaignId: number,
  status?: ThesisStatusCode | null,
): Promise<Result<ThesisResponse[]>> {
  const params = new URLSearchParams({ campaignId: String(campaignId) })
  if (status) params.set('status', status)
  return api.get(`${BASE}/theses/campaign?${params.toString()}`)
}

export function registerDuplicateCheck(
  body: DuplicateCheckRegisterRequest,
): Promise<Result<DuplicateCheckResponse>> {
  return api.post(`${BASE}/theses/duplicate-checks`, body)
}

export function fetchDuplicateChecks(thesisId: number): Promise<Result<DuplicateCheckResponse[]>> {
  return api.get(`${BASE}/theses/${thesisId}/duplicate-checks`)
}

export function downloadThesis(id: number): Promise<void> {
  return downloadPracticeFile(`${BASE}/theses/${id}/download`)
}

export function exportThesisPackage(
  campaignId: number,
  status?: ThesisStatusCode | null,
): Promise<void> {
  const params = new URLSearchParams({ campaignId: String(campaignId) })
  if (status) params.set('status', status)
  return downloadPracticeFile(`${BASE}/theses/export-package?${params.toString()}`)
}

// ===== 答辩与成绩 =====

export function arrangeDefense(body: DefenseArrangeRequest): Promise<Result<DefenseResponse>> {
  return api.post(`${BASE}/defense/arrange`, body)
}

export function fetchDefenseList(campaignId: number): Promise<Result<DefenseResponse[]>> {
  return api.get(`${BASE}/defense/list?campaignId=${campaignId}`)
}

export function submitAdvisorScore(body: ScoreSubmitRequest): Promise<Result<ScoreResponse>> {
  return api.post(`${BASE}/defense/scores/advisor`, body)
}

export function submitReviewerScore(body: ScoreSubmitRequest): Promise<Result<ScoreResponse>> {
  return api.post(`${BASE}/defense/scores/reviewer`, body)
}

export function submitDefenseScore(body: ScoreSubmitRequest): Promise<Result<ScoreResponse>> {
  return api.post(`${BASE}/defense/scores/defense`, body)
}

export function confirmScore(body: ScoreConfirmRequest): Promise<Result<ScoreResponse>> {
  return api.post(`${BASE}/defense/scores/confirm`, body)
}

export function fetchScores(campaignId: number): Promise<Result<ScoreResponse[]>> {
  return api.get(`${BASE}/defense/scores?campaignId=${campaignId}`)
}

export function fetchMyScore(campaignId: number): Promise<Result<ScoreResponse | null>> {
  return api.get(`${BASE}/defense/scores/my?campaignId=${campaignId}`)
}

export function exportScores(campaignId: number): Promise<void> {
  return downloadPracticeFile(`${BASE}/defense/scores/export?campaignId=${campaignId}`)
}
