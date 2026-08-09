import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type {
  TeachInfo,
  TeachInfoQuery,
  TeachInfoForm,
  TeachInfoDraft,
  DraftClassSummary,
  DraftItem,
  ClassCourse,
  TeachInfoListResponse,
  WeekSchedule,
  TimeSlot,
  TimeForm,
  Teacher,
  Semester,
  SemesterForm,
} from './types'

export function fetchTeachInfoList(query?: TeachInfoQuery): Promise<Result<TeachInfoListResponse>> {
  const params = new URLSearchParams()
  if (query?.teacherId !== undefined) params.set('teacherId', String(query.teacherId))
  if (query?.courseId !== undefined) params.set('courseId', String(query.courseId))
  if (query?.week !== undefined) params.set('week', String(query.week))
  const qs = params.toString()
  return api.get(`/teach-info${qs ? `?${qs}` : ''}`)
}

export function fetchWeekSchedule(week: number): Promise<Result<WeekSchedule>> {
  return api.get(`/teach-info/week-schedule?week=${week}`)
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

export function fetchTeachers(
  page?: number,
  pageSize?: number,
): Promise<Result<PageResult<Teacher>>> {
  const params = new URLSearchParams()
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  const qs = params.toString()
  return api.get(`/teachers${qs ? `?${qs}` : ''}`)
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

export function deleteSingleDraft(
  courseId: number,
  teacherId: number,
  className: string,
): Promise<Result<null>> {
  const params = new URLSearchParams()
  params.set('courseId', String(courseId))
  params.set('teacherId', String(teacherId))
  params.set('className', className)
  return api.delete(`/teach-info/draft/item?${params.toString()}`)
}

// ---- Semester APIs ----
export function fetchAllSemesters(): Promise<Result<Semester[]>> {
  return api.get('/semester')
}

export function fetchCurrentSemester(): Promise<Result<Semester>> {
  return api.get('/semester/current')
}

export function createSemester(body: SemesterForm): Promise<Result<Semester>> {
  return api.post('/semester', body)
}

export function updateSemester(id: number, body: SemesterForm): Promise<Result<Semester>> {
  return api.put(`/semester/${id}`, body)
}

export function deleteSemester(id: number): Promise<Result<null>> {
  return api.delete(`/semester/${id}`)
}
