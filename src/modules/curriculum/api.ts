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

// ---- 授课安排（课表） ----

/** 查询授课安排列表 GET /teach-info，支持按教师/课程/周次过滤；返回当周周一日期与课程列表 */
export function fetchTeachInfoList(query?: TeachInfoQuery): Promise<Result<TeachInfoListResponse>> {
  const params = new URLSearchParams()
  if (query?.teacherId !== undefined) params.set('teacherId', String(query.teacherId))
  if (query?.courseId !== undefined) params.set('courseId', String(query.courseId))
  if (query?.week !== undefined) params.set('week', String(query.week))
  const qs = params.toString()
  return api.get(`/teach-info${qs ? `?${qs}` : ''}`)
}

/** 查询指定周次的周课表 GET /teach-info/week-schedule */
export function fetchWeekSchedule(week: number): Promise<Result<WeekSchedule>> {
  return api.get(`/teach-info/week-schedule?week=${week}`)
}

/** 查询授课安排详情 GET /teach-info/{id} */
export function fetchTeachInfoDetail(id: number): Promise<Result<TeachInfo>> {
  return api.get(`/teach-info/${id}`)
}

/** 创建授课安排 POST /teach-info */
export function createTeachInfo(body: TeachInfoForm): Promise<Result<TeachInfo>> {
  return api.post('/teach-info', body)
}

/** 更新授课安排 PUT /teach-info/{id} */
export function updateTeachInfo(id: number, body: TeachInfoForm): Promise<Result<TeachInfo>> {
  return api.put(`/teach-info/${id}`, body)
}

/** 删除授课安排 DELETE /teach-info/{id} */
export function deleteTeachInfo(id: number): Promise<Result<null>> {
  return api.delete(`/teach-info/${id}`)
}

/** 查询学生本班课程列表 GET /teach-info/class-courses（学生班级课表卡片视图） */
export function fetchClassCourses(): Promise<Result<ClassCourse[]>> {
  return api.get('/teach-info/class-courses')
}

// ---- 节次（上课时间段） ----

/** 查询全部节次 GET /time（课表行头与时段展示用） */
export function fetchAllTimes(): Promise<Result<TimeSlot[]>> {
  return api.get('/time')
}

/** 查询节次详情 GET /time/{id} */
export function fetchTime(id: number): Promise<Result<TimeSlot>> {
  return api.get(`/time/${id}`)
}

/** 创建节次 POST /time */
export function createTime(body: TimeForm): Promise<Result<TimeSlot>> {
  return api.post('/time', body)
}

/** 更新节次 PUT /time/{id} */
export function updateTime(id: number, body: TimeForm): Promise<Result<TimeSlot>> {
  return api.put(`/time/${id}`, body)
}

/** 删除节次 DELETE /time/{id} */
export function deleteTime(id: number): Promise<Result<null>> {
  return api.delete(`/time/${id}`)
}

/** 分页查询教师 GET /teachers，返回 PageResult（下拉选择数据源） */
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
/** 批量提交排课草稿 POST /teach-info/draft，返回成功条数 */
export function submitDrafts(body: TeachInfoDraft[]): Promise<Result<number>> {
  return api.post('/teach-info/draft', body)
}

/** 查询全部排课草稿 GET /teach-info/draft */
export function fetchDrafts(): Promise<Result<DraftItem[]>> {
  return api.get('/teach-info/draft')
}

/** 按班级统计草稿概况 GET /teach-info/draft/classes */
export function fetchDraftClassSummary(): Promise<Result<DraftClassSummary>> {
  return api.get('/teach-info/draft/classes')
}

/** 清空全部排课草稿 DELETE /teach-info/draft */
export function clearAllDrafts(): Promise<Result<null>> {
  return api.delete('/teach-info/draft')
}

/** 按班级清空草稿 DELETE /teach-info/draft/{className}（班级名经 URL 编码） */
export function clearDraftsByClass(className: string): Promise<Result<null>> {
  return api.delete(`/teach-info/draft/${encodeURIComponent(className)}`)
}

/** 删除单条草稿 DELETE /teach-info/draft/item，按 courseId+teacherId+className 三元组定位 */
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
/** 查询全部学期 GET /semester */
export function fetchAllSemesters(): Promise<Result<Semester[]>> {
  return api.get('/semester')
}

/** 查询当前学期 GET /semester/current */
export function fetchCurrentSemester(): Promise<Result<Semester>> {
  return api.get('/semester/current')
}

/** 创建学期 POST /semester */
export function createSemester(body: SemesterForm): Promise<Result<Semester>> {
  return api.post('/semester', body)
}

/** 更新学期 PUT /semester/{id} */
export function updateSemester(id: number, body: SemesterForm): Promise<Result<Semester>> {
  return api.put(`/semester/${id}`, body)
}

/** 删除学期 DELETE /semester/{id} */
export function deleteSemester(id: number): Promise<Result<null>> {
  return api.delete(`/semester/${id}`)
}
