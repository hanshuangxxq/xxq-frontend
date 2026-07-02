export interface TeachInfo {
  courseName: string
  credit: number
  courseHour: number
  courseType: string
  teacherName: string
  department: string | null
  className: string
  college: string
  dayOfWeek: number
  week: number
  timeId: number
  building: string
  classroom: string
}

export interface ClassCourse {
  courseName: string
}

export interface TimeSlot {
  id: number
  startPeriod: string
  endPeriod: string
}

export interface TeachInfoQuery {
  courseId?: number
}

export interface TeachInfoForm {
  courseId: number
  teacherId: number
  className: string
  week: number
  timeId?: number
  localId?: number
  dayOfWeek?: number
}

export interface TimeForm {
  startPeriod: string
  endPeriod: string
}

export interface TeachInfoDraft {
  courseId: number
  teacherId: number
  className: string
  week?: number
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
