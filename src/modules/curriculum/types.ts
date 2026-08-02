export interface TeachInfo {
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
