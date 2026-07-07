import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { Student, StudentQuery, StudentUpdateForm, Major } from './types'

export function fetchStudents(query?: StudentQuery): Promise<Result<Student[]>> {
  const params = new URLSearchParams()
  if (query?.grade) params.set('grade', query.grade)
  if (query?.className) params.set('className', query.className)
  if (query?.major) params.set('major', query.major)
  if (query?.unassigned !== undefined) params.set('unassigned', String(query.unassigned))
  if (query?.name) params.set('name', query.name)
  const qs = params.toString()
  return api.get(`/students${qs ? `?${qs}` : ''}`)
}

export function updateStudent(studentId: number, body: StudentUpdateForm): Promise<Result<boolean>> {
  return api.put(`/students/${studentId}`, body)
}

export function fetchMajors(): Promise<Result<Major[]>> {
  return api.get('/majors')
}
