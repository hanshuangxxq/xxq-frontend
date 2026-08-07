/**
 * 课程类别（后端 CourseDto 多态标识，Jackson 按 category 字段区分子类）。
 * 与 courseType（中文描述）一一对应：REQUIRE 必修 / ELECTIVE 选修 / PRACTICE 实践 / PUBLIC 公选。
 * category 适合分支判断，courseType 适合直接展示。
 */
export type CourseCategory = 'REQUIRE' | 'ELECTIVE' | 'PRACTICE' | 'PUBLIC'

/**
 * 选课活动状态（与后端 CampaignStatus 枚举对应）。
 * 公选课（PUBLIC）课表视图内联返回，前端无需再调 selection 接口合并。
 */
export type CampaignStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'FINALIZED'

/**
 * 课表课程视图（后端 CourseDto）的公共字段。
 * 涵盖 GET /api/teach-info（list）、/api/teach-info/{id}、/api/teach-info/week-schedule 的返回。
 */
export interface TeachInfoBase {
  /** 授课安排 id（成绩录入/考试按此关联；课表视图可能不返回） */
  id?: number
  courseId?: number
  semesterId?: number
  courseName: string
  credit: number
  courseHour: number
  courseType: string
  teacherName: string
  department: string | null
  className: string
  college: string
  dayOfWeek: number
  startWeek: number
  endWeek: number
  timeId: number
  building: string
  classroom: string
}

/** 必修课 */
export interface RequiredCourseDto extends TeachInfoBase {
  category: 'REQUIRE'
}

/** 选修课 */
export interface ElectiveCourseDto extends TeachInfoBase {
  category: 'ELECTIVE'
}

/** 实践课 */
export interface PracticeCourseDto extends TeachInfoBase {
  category: 'PRACTICE'
}

/**
 * 公选课（选课活动）视图。
 * 解耦后 selection_campaign 不再冗余课程字段，统一通过 course_id 关联 course 表；
 * 课表查询时后端将选课活动信息内联到 CourseDto 返回。
 */
export interface PublicCourseDto extends TeachInfoBase {
  category: 'PUBLIC'
  /** 关联的选课活动 id */
  campaignId: number
  /** 选课活动状态 */
  campaignStatus: CampaignStatus
  /** 容量上限 */
  capacity: number
  /** 已选人数 */
  selectedCount: number
  /** 教学班号（finalize 分班后的班次） */
  classNo: number
}

/**
 * 课表课程（后端 CourseDto 多态序列化，按 category 区分子类）。
 * 按 category 收敛到对应子类型后可访问其专属字段（如公选课的选课活动信息）。
 */
export type TeachInfo =
  | RequiredCourseDto
  | ElectiveCourseDto
  | PracticeCourseDto
  | PublicCourseDto

export interface ClassCourse {
  courseName: string
  teacherName: string
  dayOfWeek: number
  startWeek: number
  endWeek: number
  timeId: number
  building: string
  classroom: string
}

export interface ClassCourseResponse {
  mondayDate: string
  courses: ClassCourse[]
}

export interface TeachInfoListResponse {
  mondayDate: string
  courses: TeachInfo[]
}

export interface WeekSchedule {
  weekNumber: number
  scheduleByDay: Record<string, TeachInfo[]>
}

export interface TimeSlot {
  id: number
  startPeriod: string
  endPeriod: string
}

export interface TeachInfoQuery {
  teacherId?: number
  courseId?: number
  week?: number
}

export interface TeachInfoForm {
  courseId: number
  teacherId: number
  className: string
  timeId?: number
  localId?: number
  dayOfWeek?: number
  startWeek?: number
  endWeek?: number
  semesterId?: number
}

export interface TimeForm {
  startPeriod: string
  endPeriod: string
}

export interface TeachInfoDraft {
  courseId: number
  teacherId: number
  className: string
  startWeek?: number
  endWeek?: number
  semesterId?: number
}

export interface Teacher {
  id: number
  name: string
  teacherNo: string
  title: string
  department: string
}

export interface DraftClassSummary {
  classes: string[]
  countByClass: Record<string, number>
  totalDrafts: number
}

export interface DraftItem {
  id: number | null
  courseId: number
  courseName: string
  teacherId: number
  teacherName: string
  className: string
  college: string
  timeId: number | null
  localId: number | null
  dayOfWeek: number | null
  startWeek: number
  endWeek: number
  semesterId: number | null
}

export interface Semester {
  id: number
  name: string
  startWeek: number
  endWeek: number
  startDate: string
  endDate: string
  status: 'CURRENT' | 'HISTORICAL' | 'FUTURE'
}

export interface SemesterForm {
  name: string
  startWeek?: number
  endWeek?: number
  startDate?: string
  endDate?: string
  status: 'CURRENT' | 'HISTORICAL' | 'FUTURE'
}
