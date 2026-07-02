import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { TeachInfo, TeachInfoQuery, TeachInfoForm, TeachInfoDraft, DraftClassSummary, DraftItem, ClassCourse, TimeSlot, TimeForm, Teacher } from './types'

export function fetchTeachInfoList(query?: TeachInfoQuery): Promise<Result<TeachInfo[]>> {
  const params = new URLSearchParams()
  if (query?.courseId !== undefined) params.set('courseId', String(query.courseId))
  const qs = params.toString()
  return api.get(`/teach-info${qs ? `?${qs}` : ''}`)
}

export function fetchTeachInfoDetail(id: number): Promise<Result<TeachInfo>> {
  return api.get(`/teach-info/${id}`)
}

export function createTeachInfo(body: TeachInfoForm): Promise<Result<TeachInfo>> {
  return api.post('/teach-info', body)
}

export function updateTeachInfo(id: number, body: TeachInfoForm): Promise<Result<TeachInfo>> {
  return api.put(`/teach-info/${id}`, body)
}

export function deleteTeachInfo(id: number): Promise<Result<null>> {
  return api.delete(`/teach-info/${id}`)
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

export function createTime(body: TimeForm): Promise<Result<TimeSlot>> {
  return api.post('/time', body)
}

export function updateTime(id: number, body: TimeForm): Promise<Result<TimeSlot>> {
  return api.put(`/time/${id}`, body)
}

export function deleteTime(id: number): Promise<Result<null>> {
  return api.delete(`/time/${id}`)
}

export function fetchTeachers(): Promise<Result<Teacher[]>> {
  return api.get('/teachers')
}

// ---- Draft APIs ----
export function submitDrafts(body: TeachInfoDraft[]): Promise<Result<number>> {
  return api.post('/teach-info/draft', body)
}

export function fetchDrafts(): Promise<Result<DraftItem[]>> {
  return api.get('/teach-info/draft')
}

export function fetchDraftClassSummary(): Promise<Result<DraftClassSummary>> {
  return api.get('/teach-info/draft/classes')
}

export function clearAllDrafts(): Promise<Result<null>> {
  return api.delete('/teach-info/draft')
}

export function clearDraftsByClass(className: string): Promise<Result<null>> {
  return api.delete(`/teach-info/draft/${encodeURIComponent(className)}`)
}

export function deleteSingleDraft(courseId: number, teacherId: number, className: string): Promise<Result<null>> {
  const params = new URLSearchParams()
  params.set('courseId', String(courseId))
  params.set('teacherId', String(teacherId))
  params.set('className', className)
  return api.delete(`/teach-info/draft/item?${params.toString()}`)
}
