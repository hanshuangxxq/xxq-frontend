import { api } from '@/shared/api'
import type { PreparedSubmitFile } from '@/modules/file/types'
import type { PageResult, Result } from '@/shared/types'
import type {
  InternshipCreateRequest,
  InternshipUpdateRequest,
  InternshipResponse,
  InternshipQuery,
  InternshipApplyRequest,
  InternshipApplicationResponse,
  InternshipReviewRequest,
  InternshipReportSubmitRequest,
  InternshipReportResponse,
  InternshipReportReviewRequest,
  InternshipReportQuery,
  TrainingCreateRequest,
  TrainingUpdateRequest,
  TrainingResponse,
  TrainingQuery,
  TrainingEnrollmentResponse,
  CompetitionCreateRequest,
  CompetitionUpdateRequest,
  CompetitionResponse,
  CompetitionQuery,
  RegistrationRequest,
  RegistrationResponse,
  RegistrationReviewRequest,
  CompetitionResultRequest,
  CompetitionResultResponse,
  SocialPracticeCreateRequest,
  SocialPracticeUpdateRequest,
  SocialPracticeResponse,
  SocialPracticeQuery,
  SocialPracticeApplyRequest,
  SocialPracticeApplicationResponse,
  SocialPracticeReviewRequest,
  SocialPracticeReportSubmitRequest,
  SocialPracticeReportResponse,
  SocialPracticeReportReviewRequest,
  SocialPracticeReportQuery,
} from './types'

// 实践模块统一前缀
const BASE = '/practice'

// ===== 实习与培训 =====

// ---- 实习项目 ----

/** 创建实习项目 POST /practice/internships */
export function createInternship(
  body: InternshipCreateRequest,
): Promise<Result<InternshipResponse>> {
  return api.post(`${BASE}/internships`, body)
}

/** 更新实习项目 PUT /practice/internships/{id} */
export function updateInternship(
  id: number,
  body: InternshipUpdateRequest,
): Promise<Result<InternshipResponse>> {
  return api.put(`${BASE}/internships/${id}`, body)
}

/** 变更实习项目状态 PUT /practice/internships/{id}/status?status=code */
export function updateInternshipStatus(id: number, status: string): Promise<Result<null>> {
  return api.put(`${BASE}/internships/${id}/status?status=${status}`)
}

/** 分页查询实习项目列表,支持指导教师/状态筛选,返回 PageResult GET /practice/internships */
export function fetchInternships(
  query?: InternshipQuery,
): Promise<Result<PageResult<InternshipResponse>>> {
  const params = new URLSearchParams()
  if (query?.supervisorId != null) params.set('supervisorId', String(query.supervisorId))
  if (query?.status) params.set('status', query.status)
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/internships${qs ? `?${qs}` : ''}`)
}

/** 查询单个实习项目详情 GET /practice/internships/{id} */
export function fetchInternship(id: number): Promise<Result<InternshipResponse>> {
  return api.get(`${BASE}/internships/${id}`)
}

/** 学生端:查询开放报名的实习项目 GET /practice/internships/available */
export function fetchAvailableInternships(): Promise<Result<InternshipResponse[]>> {
  return api.get(`${BASE}/internships/available`)
}

/** 删除实习项目 DELETE /practice/internships/{id} */
export function deleteInternship(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/internships/${id}`)
}

/** 学生报名实习 POST /practice/internships/applications */
export function applyInternship(
  body: InternshipApplyRequest,
): Promise<Result<InternshipApplicationResponse>> {
  return api.post(`${BASE}/internships/applications`, body)
}

/** 学生撤销实习报名 DELETE /practice/internships/applications/{id} */
export function revokeInternshipApplication(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/internships/applications/${id}`)
}

/** 审核实习报名(通过/驳回) POST /practice/internships/applications/{id}/review */
export function reviewInternshipApplication(
  id: number,
  body: InternshipReviewRequest,
): Promise<Result<InternshipApplicationResponse>> {
  return api.post(`${BASE}/internships/applications/${id}/review`, body)
}

/** 学生:我的实习报名列表 GET /practice/internships/applications/my */
export function fetchMyInternshipApplications(): Promise<Result<InternshipApplicationResponse[]>> {
  return api.get(`${BASE}/internships/applications/my`)
}

/** 分页查询某实习项目的报名列表,返回 PageResult GET /practice/internships/{id}/applications */
export function fetchInternshipApplications(
  internshipId: number,
  page?: number,
  pageSize?: number,
): Promise<Result<PageResult<InternshipApplicationResponse>>> {
  const params = new URLSearchParams()
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/internships/${internshipId}/applications${qs ? `?${qs}` : ''}`)
}

// ---- 实习报告 ----

/**
 * 提交实习报告:multipart 表单,data 为 JSON Blob、file 为附件。
 * 附件二选一:≤20MB 走 file 部分整传,>20MB 走 data.filePath 分片产物 ——
 * 同时给会被后端 400 拒绝。
 */
export function submitInternshipReport(
  data: InternshipReportSubmitRequest,
  file: PreparedSubmitFile,
): Promise<Result<InternshipReportResponse>> {
  const payload: InternshipReportSubmitRequest = file.filePath
    ? { ...data, filePath: file.filePath, fileOriginal: file.fileOriginal ?? undefined }
    : data
  const fd = new FormData()
  // 不要手动设置 Content-Type:必须让浏览器补上 multipart 的 boundary
  fd.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
  if (file.file) fd.append('file', file.file)
  return api.postForm(`${BASE}/internship-reports`, fd)
}

/** 学生:我的实习报告列表 GET /practice/internship-reports/my */
export function fetchMyInternshipReports(): Promise<Result<InternshipReportResponse[]>> {
  return api.get(`${BASE}/internship-reports/my`)
}

/** 分页查询实习报告列表,支持状态筛选,返回 PageResult GET /practice/internship-reports */
export function fetchInternshipReports(
  query?: InternshipReportQuery,
): Promise<Result<PageResult<InternshipReportResponse>>> {
  const params = new URLSearchParams()
  if (query?.status) params.set('status', query.status)
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/internship-reports${qs ? `?${qs}` : ''}`)
}

/** 评审实习报告(打分+评语) POST /practice/internship-reports/{id}/review */
export function reviewInternshipReport(
  id: number,
  body: InternshipReportReviewRequest,
): Promise<Result<InternshipReportResponse>> {
  return api.post(`${BASE}/internship-reports/${id}/review`, body)
}

/** 删除实习报告 DELETE /practice/internship-reports/{id} */
export function deleteInternshipReport(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/internship-reports/${id}`)
}

// ---- 培训课程 ----

/** 创建培训课程 POST /practice/trainings */
export function createTraining(body: TrainingCreateRequest): Promise<Result<TrainingResponse>> {
  return api.post(`${BASE}/trainings`, body)
}

/** 更新培训课程 PUT /practice/trainings/{id} */
export function updateTraining(
  id: number,
  body: TrainingUpdateRequest,
): Promise<Result<TrainingResponse>> {
  return api.put(`${BASE}/trainings/${id}`, body)
}

/** 变更培训课程状态 PUT /practice/trainings/{id}/status?status=code */
export function updateTrainingStatus(id: number, status: string): Promise<Result<null>> {
  return api.put(`${BASE}/trainings/${id}/status?status=${status}`)
}

/** 分页查询培训课程列表,支持授课教师/状态筛选,返回 PageResult GET /practice/trainings */
export function fetchTrainings(
  query?: TrainingQuery,
): Promise<Result<PageResult<TrainingResponse>>> {
  const params = new URLSearchParams()
  if (query?.teacherId != null) params.set('teacherId', String(query.teacherId))
  if (query?.status) params.set('status', query.status)
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/trainings${qs ? `?${qs}` : ''}`)
}

/** 查询单个培训课程详情 GET /practice/trainings/{id} */
export function fetchTraining(id: number): Promise<Result<TrainingResponse>> {
  return api.get(`${BASE}/trainings/${id}`)
}

/** 学生端:查询开放报名的培训课程 GET /practice/trainings/available */
export function fetchAvailableTrainings(): Promise<Result<TrainingResponse[]>> {
  return api.get(`${BASE}/trainings/available`)
}

/** 删除培训课程 DELETE /practice/trainings/{id} */
export function deleteTraining(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/trainings/${id}`)
}

/** 学生报名培训课程 POST /practice/trainings/{id}/enrollments */
export function enrollTraining(courseId: number): Promise<Result<TrainingEnrollmentResponse>> {
  return api.post(`${BASE}/trainings/${courseId}/enrollments`)
}

/** 学生取消培训报名 DELETE /practice/trainings/enrollments/{id} */
export function cancelTrainingEnrollment(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/trainings/enrollments/${id}`)
}

/** 学生:我的培训报名列表 GET /practice/trainings/enrollments/my */
export function fetchMyTrainingEnrollments(): Promise<Result<TrainingEnrollmentResponse[]>> {
  return api.get(`${BASE}/trainings/enrollments/my`)
}

/** 分页查询某培训课程的报名名单,返回 PageResult GET /practice/trainings/{id}/enrollments */
export function fetchTrainingEnrollments(
  courseId: number,
  page?: number,
  pageSize?: number,
): Promise<Result<PageResult<TrainingEnrollmentResponse>>> {
  const params = new URLSearchParams()
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/trainings/${courseId}/enrollments${qs ? `?${qs}` : ''}`)
}

// ===== 竞赛管理 =====

// ---- 竞赛项目 ----

/** 创建竞赛 POST /practice/competitions */
export function createCompetition(
  body: CompetitionCreateRequest,
): Promise<Result<CompetitionResponse>> {
  return api.post(`${BASE}/competitions`, body)
}

/** 更新竞赛 PUT /practice/competitions/{id} */
export function updateCompetition(
  id: number,
  body: CompetitionUpdateRequest,
): Promise<Result<CompetitionResponse>> {
  return api.put(`${BASE}/competitions/${id}`, body)
}

/** 变更竞赛状态 PUT /practice/competitions/{id}/status?status=code */
export function updateCompetitionStatus(id: number, status: string): Promise<Result<null>> {
  return api.put(`${BASE}/competitions/${id}/status?status=${status}`)
}

/** 分页查询竞赛列表,支持状态筛选,返回 PageResult GET /practice/competitions */
export function fetchCompetitions(
  query?: CompetitionQuery,
): Promise<Result<PageResult<CompetitionResponse>>> {
  const params = new URLSearchParams()
  if (query?.status) params.set('status', query.status)
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/competitions${qs ? `?${qs}` : ''}`)
}

/** 查询单个竞赛详情 GET /practice/competitions/{id} */
export function fetchCompetition(id: number): Promise<Result<CompetitionResponse>> {
  return api.get(`${BASE}/competitions/${id}`)
}

/** 学生端:查询开放报名的竞赛 GET /practice/competitions/available */
export function fetchAvailableCompetitions(): Promise<Result<CompetitionResponse[]>> {
  return api.get(`${BASE}/competitions/available`)
}

/** 删除竞赛 DELETE /practice/competitions/{id} */
export function deleteCompetition(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/competitions/${id}`)
}

// ---- 竞赛报名 ----

/** 学生报名竞赛(个人/团队) POST /practice/competitions/registrations */
export function registerCompetition(
  body: RegistrationRequest,
): Promise<Result<RegistrationResponse>> {
  return api.post(`${BASE}/competitions/registrations`, body)
}

/** 学生撤销竞赛报名 DELETE /practice/competitions/registrations/{id} */
export function revokeCompetitionRegistration(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/competitions/registrations/${id}`)
}

/** 审核竞赛报名(通过/驳回) POST /practice/competitions/registrations/{id}/review */
export function reviewCompetitionRegistration(
  id: number,
  body: RegistrationReviewRequest,
): Promise<Result<RegistrationResponse>> {
  return api.post(`${BASE}/competitions/registrations/${id}/review`, body)
}

/** 学生:我的竞赛报名列表 GET /practice/competitions/registrations/my */
export function fetchMyCompetitionRegistrations(): Promise<Result<RegistrationResponse[]>> {
  return api.get(`${BASE}/competitions/registrations/my`)
}

/** 分页查询某竞赛的报名列表,返回 PageResult GET /practice/competitions/{id}/registrations */
export function fetchCompetitionRegistrations(
  competitionId: number,
  page?: number,
  pageSize?: number,
): Promise<Result<PageResult<RegistrationResponse>>> {
  const params = new URLSearchParams()
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/competitions/${competitionId}/registrations${qs ? `?${qs}` : ''}`)
}

// ---- 竞赛结果 ----

/** 录入/更新竞赛获奖结果,按报名覆盖(同一报名重复提交即更新) POST /practice/competitions/results */
export function saveCompetitionResult(
  body: CompetitionResultRequest,
): Promise<Result<CompetitionResultResponse>> {
  return api.post(`${BASE}/competitions/results`, body)
}

/** 查询某竞赛的获奖结果列表 GET /practice/competitions/{id}/results */
export function fetchCompetitionResults(
  competitionId: number,
): Promise<Result<CompetitionResultResponse[]>> {
  return api.get(`${BASE}/competitions/${competitionId}/results`)
}

/** 学生:查询本人在某竞赛的获奖结果,未获奖时返回 null GET /practice/competitions/{id}/results/my */
export function fetchMyCompetitionResult(
  competitionId: number,
): Promise<Result<CompetitionResultResponse | null>> {
  return api.get(`${BASE}/competitions/${competitionId}/results/my`)
}

/** 删除竞赛获奖结果 DELETE /practice/competitions/results/{id} */
export function deleteCompetitionResult(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/competitions/results/${id}`)
}

// ===== 社会实践 =====

// ---- 实践项目 ----

/** 创建社会实践项目 POST /practice/social-practices */
export function createSocialPractice(
  body: SocialPracticeCreateRequest,
): Promise<Result<SocialPracticeResponse>> {
  return api.post(`${BASE}/social-practices`, body)
}

/** 更新社会实践项目 PUT /practice/social-practices/{id} */
export function updateSocialPractice(
  id: number,
  body: SocialPracticeUpdateRequest,
): Promise<Result<SocialPracticeResponse>> {
  return api.put(`${BASE}/social-practices/${id}`, body)
}

/** 变更社会实践项目状态 PUT /practice/social-practices/{id}/status?status=code */
export function updateSocialPracticeStatus(id: number, status: string): Promise<Result<null>> {
  return api.put(`${BASE}/social-practices/${id}/status?status=${status}`)
}

/** 分页查询社会实践项目列表,支持状态筛选,返回 PageResult GET /practice/social-practices */
export function fetchSocialPractices(
  query?: SocialPracticeQuery,
): Promise<Result<PageResult<SocialPracticeResponse>>> {
  const params = new URLSearchParams()
  if (query?.status) params.set('status', query.status)
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/social-practices${qs ? `?${qs}` : ''}`)
}

/** 查询单个社会实践项目详情 GET /practice/social-practices/{id} */
export function fetchSocialPractice(id: number): Promise<Result<SocialPracticeResponse>> {
  return api.get(`${BASE}/social-practices/${id}`)
}

/** 学生端:查询开放申报的社会实践项目 GET /practice/social-practices/available */
export function fetchAvailableSocialPractices(): Promise<Result<SocialPracticeResponse[]>> {
  return api.get(`${BASE}/social-practices/available`)
}

/** 删除社会实践项目 DELETE /practice/social-practices/{id} */
export function deleteSocialPractice(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/social-practices/${id}`)
}

// ---- 实践申报 ----

/** 学生申报社会实践(个人/团队) POST /practice/social-practices/applications */
export function applySocialPractice(
  body: SocialPracticeApplyRequest,
): Promise<Result<SocialPracticeApplicationResponse>> {
  return api.post(`${BASE}/social-practices/applications`, body)
}

/** 学生撤销社会实践申报 DELETE /practice/social-practices/applications/{id} */
export function revokeSocialPracticeApplication(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/social-practices/applications/${id}`)
}

/** 审核社会实践申报(通过/驳回) POST /practice/social-practices/applications/{id}/review */
export function reviewSocialPracticeApplication(
  id: number,
  body: SocialPracticeReviewRequest,
): Promise<Result<SocialPracticeApplicationResponse>> {
  return api.post(`${BASE}/social-practices/applications/${id}/review`, body)
}

/** 学生:我的社会实践申报列表 GET /practice/social-practices/applications/my */
export function fetchMySocialPracticeApplications(): Promise<
  Result<SocialPracticeApplicationResponse[]>
> {
  return api.get(`${BASE}/social-practices/applications/my`)
}

/** 分页查询某社会实践项目的申报列表,返回 PageResult GET /practice/social-practices/{id}/applications */
export function fetchSocialPracticeApplications(
  practiceId: number,
  page?: number,
  pageSize?: number,
): Promise<Result<PageResult<SocialPracticeApplicationResponse>>> {
  const params = new URLSearchParams()
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/social-practices/${practiceId}/applications${qs ? `?${qs}` : ''}`)
}

// ---- 社会实践报告 ----

/**
 * 提交社会实践报告:multipart 表单,data 为 JSON Blob、file 为附件。
 * 附件二选一:≤20MB 走 file 部分整传,>20MB 走 data.filePath 分片产物。
 */
export function submitSocialPracticeReport(
  data: SocialPracticeReportSubmitRequest,
  file: PreparedSubmitFile,
): Promise<Result<SocialPracticeReportResponse>> {
  const payload: SocialPracticeReportSubmitRequest = file.filePath
    ? { ...data, filePath: file.filePath, fileOriginal: file.fileOriginal ?? undefined }
    : data
  const fd = new FormData()
  // 不要手动设置 Content-Type:必须让浏览器补上 multipart 的 boundary
  fd.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
  if (file.file) fd.append('file', file.file)
  return api.postForm(`${BASE}/social-practice-reports`, fd)
}

/** 学生:我的社会实践报告列表 GET /practice/social-practice-reports/my */
export function fetchMySocialPracticeReports(): Promise<Result<SocialPracticeReportResponse[]>> {
  return api.get(`${BASE}/social-practice-reports/my`)
}

/** 分页查询社会实践报告列表,支持状态筛选,返回 PageResult GET /practice/social-practice-reports */
export function fetchSocialPracticeReports(
  query?: SocialPracticeReportQuery,
): Promise<Result<PageResult<SocialPracticeReportResponse>>> {
  const params = new URLSearchParams()
  if (query?.status) params.set('status', query.status)
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/social-practice-reports${qs ? `?${qs}` : ''}`)
}

/** 评审社会实践报告(打分+评语) POST /practice/social-practice-reports/{id}/review */
export function reviewSocialPracticeReport(
  id: number,
  body: SocialPracticeReportReviewRequest,
): Promise<Result<SocialPracticeReportResponse>> {
  return api.post(`${BASE}/social-practice-reports/${id}/review`, body)
}

/** 删除社会实践报告 DELETE /practice/social-practice-reports/{id} */
export function deleteSocialPracticeReport(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/social-practice-reports/${id}`)
}
