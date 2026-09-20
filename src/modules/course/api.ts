import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type { Course, CourseForm, CourseSource } from './types'

/**
 * 分页查询课程列表 GET /courses,返回 PageResult;常规课与公选课同表混排,公选课以 source 标识。
 *
 * 传 `source: 'MANUAL'` 只返回 course 表常规课,不追加合成的公选课条目 ——
 * 任何会把 course.id 当外键写入的场景(排课草稿/补考考试/时段预留)都必须用它:
 * 公选课 id 实为 campaignId,选了必然校验失败。过滤交给服务端做,total/pages
 * 才与实际可选条数一致;客户端按页过滤会让页码与内容脱节。
 */
export function fetchCourses(
  page?: number,
  pageSize?: number,
  source?: CourseSource,
): Promise<Result<PageResult<Course>>> {
  const params = new URLSearchParams()
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  if (source) params.set('source', source)
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

/** 创建常规课 POST /courses(公选课由选课活动模块创建,不走此接口) */
export function createCourse(body: CourseForm): Promise<Result<Course>> {
  return api.post('/courses', body)
}

/** 更新常规课 PUT /courses/{id}(公选课不可走此接口,须到选课活动下维护) */
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
