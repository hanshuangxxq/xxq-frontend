import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type {
  ExamView,
  ExamCreateRequest,
  ClassCourseOptionDto,
  ExamQuery,
  MakeupCandidateDto,
  MakeupCandidateQuery,
  MakeupExamCreateRequest,
  MakeupScoreEntryRequest,
  MakeupScoreResult,
} from './types'

// ---- 考试 CRUD ----

export function createExam(body: ExamCreateRequest): Promise<Result<ExamView>> {
  return api.post('/exams', body)
}

export function updateExam(id: number, body: ExamCreateRequest): Promise<Result<ExamView>> {
  return api.put(`/exams/${id}`, body)
}

export function deleteExam(id: number): Promise<Result<null>> {
  return api.delete(`/exams/${id}`)
}

export function fetchExams(query?: ExamQuery): Promise<Result<ExamView[]>> {
  const params = new URLSearchParams()
  if (query?.semesterId != null) params.set('semesterId', String(query.semesterId))
  if (query?.courseId != null) params.set('courseId', String(query.courseId))
  if (query?.source) params.set('source', query.source)
  if (query?.examType) params.set('examType', query.examType)
  const qs = params.toString()
  return api.get(`/exams${qs ? `?${qs}` : ''}`)
}

/** 教务按班级查询可排考的课程（建考用，合班自动命中，后端按 class_id 在库中查询）。 */
export function fetchClassCourseOptions(classId: number): Promise<Result<ClassCourseOptionDto[]>> {
  return api.get(`/exams/class-courses?classId=${classId}`)
}

export function fetchTeacherExams(): Promise<Result<ExamView[]>> {
  return api.get('/exams/teacher')
}

export function fetchMyExams(): Promise<Result<ExamView[]>> {
  return api.get('/exams/my')
}

// ---- 补考 / 重修 ----

export function fetchMakeupCandidates(
  query: MakeupCandidateQuery,
): Promise<Result<MakeupCandidateDto[]>> {
  const params = new URLSearchParams()
  params.set('courseId', String(query.courseId))
  if (query.source) params.set('source', query.source)
  if (query.semesterId != null) params.set('semesterId', String(query.semesterId))
  return api.get(`/exams/makeup/candidates?${params.toString()}`)
}

export function createMakeupExam(body: MakeupExamCreateRequest): Promise<Result<ExamView>> {
  return api.post('/exams/makeup', body)
}

export function fetchMakeupExams(semesterId?: number): Promise<Result<ExamView[]>> {
  const qs = semesterId != null ? `?semesterId=${semesterId}` : ''
  return api.get(`/exams/makeup${qs}`)
}

export function enterMakeupGrades(
  examId: number,
  body: MakeupScoreEntryRequest[],
): Promise<Result<MakeupScoreResult>> {
  return api.post(`/exams/${examId}/grades`, body)
}
