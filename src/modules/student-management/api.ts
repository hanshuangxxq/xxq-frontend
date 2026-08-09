import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type { Student, StudentQuery, StudentUpdateForm, Major } from './types'

export function fetchStudents(query?: StudentQuery): Promise<Result<PageResult<Student>>> {
  const params = new URLSearchParams()
  if (query?.gradeId != null) params.set('gradeId', String(query.gradeId))
  if (query?.className) params.set('className', query.className)
  if (query?.major) params.set('major', query.major)
  if (query?.unassigned !== undefined) params.set('unassigned', String(query.unassigned))
  if (query?.name) params.set('name', query.name)
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`/students${qs ? `?${qs}` : ''}`)
}

export function updateStudent(
  studentId: number,
  body: StudentUpdateForm,
): Promise<Result<boolean>> {
  return api.put(`/students/${studentId}`, body)
}

export function fetchMajors(): Promise<Result<Major[]>> {
  return api.get('/majors')
}
