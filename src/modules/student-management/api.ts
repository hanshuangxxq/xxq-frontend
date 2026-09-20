import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type { Student, StudentQuery, StudentUpdateForm } from './types'

/** 分页查询学生列表，支持年级/班级/专业/姓名/未分配过滤 GET /students */
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

/** 更新学生档案（学号/班级/年级/入学年份） PUT /students/{studentId} */
export function updateStudent(
  studentId: number,
  body: StudentUpdateForm,
): Promise<Result<boolean>> {
  return api.put(`/students/${studentId}`, body)
}
