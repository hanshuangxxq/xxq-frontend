import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type { Course, CourseForm, CourseSource } from './types'

export function fetchCourses(
  page?: number,
  pageSize?: number,
): Promise<Result<PageResult<Course>>> {
  const params = new URLSearchParams()
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  const qs = params.toString()
  return api.get(`/courses${qs ? `?${qs}` : ''}`)
}

/**
 * 课程详情。公选课的 id 实为 campaignId，查询时须传 `source=SELECTION_CAMPAIGN`，
 * 否则按 course.id 查会 404 或命中错误的常规课。
 */
export function fetchCourse(id: number, source?: CourseSource): Promise<Result<Course>> {
  const qs = source ? `?source=${source}` : ''
  return api.get(`/courses/${id}${qs}`)
}

export function createCourse(body: CourseForm): Promise<Result<Course>> {
  return api.post('/courses', body)
}

export function updateCourse(id: number, body: CourseForm): Promise<Result<Course>> {
  return api.put(`/courses/${id}`, body)
}

/**
 * 删除课程。公选课**必须**传 `source=SELECTION_CAMPAIGN`，否则后端按 course.id 删除，
 * 可能误删同 id 的常规课（或删空而公选课未删）。
 */
export function deleteCourse(id: number, source?: CourseSource): Promise<Result<null>> {
  const qs = source ? `?source=${source}` : ''
  return api.delete(`/courses/${id}${qs}`)
}
