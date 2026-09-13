import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
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

/** 创建考试 POST /exams */
export function createExam(body: ExamCreateRequest): Promise<Result<ExamView>> {
  return api.post('/exams', body)
}

/** 更新考试 PUT /exams/{id} */
export function updateExam(id: number, body: ExamCreateRequest): Promise<Result<ExamView>> {
  return api.put(`/exams/${id}`, body)
}

/** 删除考试 DELETE /exams/{id} */
export function deleteExam(id: number): Promise<Result<null>> {
  return api.delete(`/exams/${id}`)
}

/** 分页查询考试列表 GET /exams，支持学期/课程/来源/类型过滤，返回 PageResult */
export function fetchExams(query?: ExamQuery): Promise<Result<PageResult<ExamView>>> {
  const params = new URLSearchParams()
  if (query?.semesterId != null) params.set('semesterId', String(query.semesterId))
  if (query?.courseId != null) params.set('courseId', String(query.courseId))
  if (query?.source) params.set('source', query.source)
  if (query?.examType) params.set('examType', query.examType)
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`/exams${qs ? `?${qs}` : ''}`)
}

/** 教务按班级查询可排考的课程（建考用，合班自动命中，后端按 class_id 在库中查询）。 */
export function fetchClassCourseOptions(classId: number): Promise<Result<ClassCourseOptionDto[]>> {
  return api.get(`/exams/class-courses?classId=${classId}`)
}

/** 查询教师任课课程的考试安排 GET /exams/teacher（教师视角） */
export function fetchTeacherExams(): Promise<Result<ExamView[]>> {
  return api.get('/exams/teacher')
}

/** 查询当前学生的考试安排 GET /exams/my（含正考/补考/重修） */
export function fetchMyExams(): Promise<Result<ExamView[]>> {
  return api.get('/exams/my')
}

// ---- 补考 / 重修 ----

/** 查询补考候选名单（课程不及格学生）GET /exams/makeup/candidates */
export function fetchMakeupCandidates(
  query: MakeupCandidateQuery,
): Promise<Result<MakeupCandidateDto[]>> {
  const params = new URLSearchParams()
  params.set('courseId', String(query.courseId))
  if (query.source) params.set('source', query.source)
  if (query.semesterId != null) params.set('semesterId', String(query.semesterId))
  return api.get(`/exams/makeup/candidates?${params.toString()}`)
}

/** 创建补考/重修考试 POST /exams/makeup */
export function createMakeupExam(body: MakeupExamCreateRequest): Promise<Result<ExamView>> {
  return api.post('/exams/makeup', body)
}

/** 查询补考/重修考试列表 GET /exams/makeup，可按学期过滤 */
export function fetchMakeupExams(semesterId?: number): Promise<Result<ExamView[]>> {
  const qs = semesterId != null ? `?semesterId=${semesterId}` : ''
  return api.get(`/exams/makeup${qs}`)
}

/** 录入补考/重修成绩 POST /exams/{examId}/grades，返回生成的成绩记录 */
export function enterMakeupGrades(
  examId: number,
  body: MakeupScoreEntryRequest[],
): Promise<Result<MakeupScoreResult>> {
  return api.post(`/exams/${examId}/grades`, body)
}
