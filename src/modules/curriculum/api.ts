import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { TeachInfo, TeachInfoQuery, ClassCourse, TimeSlot } from './types'

export function fetchTeachInfoList(query?: TeachInfoQuery): Promise<Result<TeachInfo[]>> {
  const params = new URLSearchParams()
  if (query?.teacherId !== undefined) params.set('teacherId', String(query.teacherId))
  if (query?.courseId !== undefined) params.set('courseId', String(query.courseId))
  const qs = params.toString()
  return api.get(`/teach-info${qs ? `?${qs}` : ''}`)
}

export function fetchClassCourses(): Promise<Result<ClassCourse[]>> {
  return api.get('/teach-info/class-courses')
}

export function fetchAllTimes(): Promise<Result<TimeSlot[]>> {
  return api.get('/time')
}

export function fetchTime(id: number): Promise<Result<TimeSlot>> {
  return api.get(`/time/${id}`)
}
