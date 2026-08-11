import { api } from '@/shared/api'
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

const BASE = '/practice'

// ===== 实习与培训 =====

// ---- 实习项目 ----

export function createInternship(
  body: InternshipCreateRequest,
): Promise<Result<InternshipResponse>> {
  return api.post(`${BASE}/internships`, body)
}

export function updateInternship(
  id: number,
  body: InternshipUpdateRequest,
): Promise<Result<InternshipResponse>> {
  return api.put(`${BASE}/internships/${id}`, body)
}

export function updateInternshipStatus(id: number, status: string): Promise<Result<null>> {
  return api.put(`${BASE}/internships/${id}/status?status=${status}`)
}

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

export function fetchInternship(id: number): Promise<Result<InternshipResponse>> {
  return api.get(`${BASE}/internships/${id}`)
}

export function fetchAvailableInternships(): Promise<Result<InternshipResponse[]>> {
  return api.get(`${BASE}/internships/available`)
}

export function deleteInternship(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/internships/${id}`)
}

export function applyInternship(
  body: InternshipApplyRequest,
): Promise<Result<InternshipApplicationResponse>> {
  return api.post(`${BASE}/internships/applications`, body)
}

export function revokeInternshipApplication(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/internships/applications/${id}`)
}

export function reviewInternshipApplication(
  id: number,
  body: InternshipReviewRequest,
): Promise<Result<InternshipApplicationResponse>> {
  return api.post(`${BASE}/internships/applications/${id}/review`, body)
}

export function fetchMyInternshipApplications(): Promise<Result<InternshipApplicationResponse[]>> {
  return api.get(`${BASE}/internships/applications/my`)
}

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

export function submitInternshipReport(
  data: InternshipReportSubmitRequest,
  file: File,
): Promise<Result<InternshipReportResponse>> {
  const fd = new FormData()
  fd.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  fd.append('file', file)
  return api.postForm(`${BASE}/internship-reports`, fd)
}

export function fetchMyInternshipReports(): Promise<Result<InternshipReportResponse[]>> {
  return api.get(`${BASE}/internship-reports/my`)
}

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

export function reviewInternshipReport(
  id: number,
  body: InternshipReportReviewRequest,
): Promise<Result<InternshipReportResponse>> {
  return api.post(`${BASE}/internship-reports/${id}/review`, body)
}

export function deleteInternshipReport(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/internship-reports/${id}`)
}

// ---- 培训课程 ----

export function createTraining(body: TrainingCreateRequest): Promise<Result<TrainingResponse>> {
  return api.post(`${BASE}/trainings`, body)
}

export function updateTraining(
  id: number,
  body: TrainingUpdateRequest,
): Promise<Result<TrainingResponse>> {
  return api.put(`${BASE}/trainings/${id}`, body)
}

export function updateTrainingStatus(id: number, status: string): Promise<Result<null>> {
  return api.put(`${BASE}/trainings/${id}/status?status=${status}`)
}

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

export function fetchTraining(id: number): Promise<Result<TrainingResponse>> {
  return api.get(`${BASE}/trainings/${id}`)
}

export function fetchAvailableTrainings(): Promise<Result<TrainingResponse[]>> {
  return api.get(`${BASE}/trainings/available`)
}

export function deleteTraining(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/trainings/${id}`)
}

export function enrollTraining(courseId: number): Promise<Result<TrainingEnrollmentResponse>> {
  return api.post(`${BASE}/trainings/${courseId}/enrollments`)
}

export function cancelTrainingEnrollment(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/trainings/enrollments/${id}`)
}

export function fetchMyTrainingEnrollments(): Promise<Result<TrainingEnrollmentResponse[]>> {
  return api.get(`${BASE}/trainings/enrollments/my`)
}

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

export function createCompetition(
  body: CompetitionCreateRequest,
): Promise<Result<CompetitionResponse>> {
  return api.post(`${BASE}/competitions`, body)
}

export function updateCompetition(
  id: number,
  body: CompetitionUpdateRequest,
): Promise<Result<CompetitionResponse>> {
  return api.put(`${BASE}/competitions/${id}`, body)
}

export function updateCompetitionStatus(id: number, status: string): Promise<Result<null>> {
  return api.put(`${BASE}/competitions/${id}/status?status=${status}`)
}

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

export function fetchCompetition(id: number): Promise<Result<CompetitionResponse>> {
  return api.get(`${BASE}/competitions/${id}`)
}

export function fetchAvailableCompetitions(): Promise<Result<CompetitionResponse[]>> {
  return api.get(`${BASE}/competitions/available`)
}

export function deleteCompetition(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/competitions/${id}`)
}

export function registerCompetition(
  body: RegistrationRequest,
): Promise<Result<RegistrationResponse>> {
  return api.post(`${BASE}/competitions/registrations`, body)
}

export function revokeCompetitionRegistration(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/competitions/registrations/${id}`)
}

export function reviewCompetitionRegistration(
  id: number,
  body: RegistrationReviewRequest,
): Promise<Result<RegistrationResponse>> {
  return api.post(`${BASE}/competitions/registrations/${id}/review`, body)
}

export function fetchMyCompetitionRegistrations(): Promise<Result<RegistrationResponse[]>> {
  return api.get(`${BASE}/competitions/registrations/my`)
}

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

export function saveCompetitionResult(
  body: CompetitionResultRequest,
): Promise<Result<CompetitionResultResponse>> {
  return api.post(`${BASE}/competitions/results`, body)
}

export function fetchCompetitionResults(
  competitionId: number,
): Promise<Result<CompetitionResultResponse[]>> {
  return api.get(`${BASE}/competitions/${competitionId}/results`)
}

export function fetchMyCompetitionResult(
  competitionId: number,
): Promise<Result<CompetitionResultResponse | null>> {
  return api.get(`${BASE}/competitions/${competitionId}/results/my`)
}

export function deleteCompetitionResult(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/competitions/results/${id}`)
}

// ===== 社会实践 =====

export function createSocialPractice(
  body: SocialPracticeCreateRequest,
): Promise<Result<SocialPracticeResponse>> {
  return api.post(`${BASE}/social-practices`, body)
}

export function updateSocialPractice(
  id: number,
  body: SocialPracticeUpdateRequest,
): Promise<Result<SocialPracticeResponse>> {
  return api.put(`${BASE}/social-practices/${id}`, body)
}

export function updateSocialPracticeStatus(id: number, status: string): Promise<Result<null>> {
  return api.put(`${BASE}/social-practices/${id}/status?status=${status}`)
}

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

export function fetchSocialPractice(id: number): Promise<Result<SocialPracticeResponse>> {
  return api.get(`${BASE}/social-practices/${id}`)
}

export function fetchAvailableSocialPractices(): Promise<Result<SocialPracticeResponse[]>> {
  return api.get(`${BASE}/social-practices/available`)
}

export function deleteSocialPractice(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/social-practices/${id}`)
}

export function applySocialPractice(
  body: SocialPracticeApplyRequest,
): Promise<Result<SocialPracticeApplicationResponse>> {
  return api.post(`${BASE}/social-practices/applications`, body)
}

export function revokeSocialPracticeApplication(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/social-practices/applications/${id}`)
}

export function reviewSocialPracticeApplication(
  id: number,
  body: SocialPracticeReviewRequest,
): Promise<Result<SocialPracticeApplicationResponse>> {
  return api.post(`${BASE}/social-practices/applications/${id}/review`, body)
}

export function fetchMySocialPracticeApplications(): Promise<
  Result<SocialPracticeApplicationResponse[]>
> {
  return api.get(`${BASE}/social-practices/applications/my`)
}

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

export function submitSocialPracticeReport(
  data: SocialPracticeReportSubmitRequest,
  file: File,
): Promise<Result<SocialPracticeReportResponse>> {
  const fd = new FormData()
  fd.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  fd.append('file', file)
  return api.postForm(`${BASE}/social-practice-reports`, fd)
}

export function fetchMySocialPracticeReports(): Promise<Result<SocialPracticeReportResponse[]>> {
  return api.get(`${BASE}/social-practice-reports/my`)
}

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

export function reviewSocialPracticeReport(
  id: number,
  body: SocialPracticeReportReviewRequest,
): Promise<Result<SocialPracticeReportResponse>> {
  return api.post(`${BASE}/social-practice-reports/${id}/review`, body)
}

export function deleteSocialPracticeReport(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/social-practice-reports/${id}`)
}
