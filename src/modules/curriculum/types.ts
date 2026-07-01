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
  teacherName: string
  dayOfWeek: number
  week: number
  timeId: number
  building: string
  classroom: string
}

export interface TimeSlot {
  id: number
  startPeriod: string
  endPeriod: string
}

export interface TeachInfoQuery {
  teacherId?: number
  courseId?: number
}
