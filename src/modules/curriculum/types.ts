export interface TeachInfo {
  id: number
  courseId: number
  courseName: string
  courseCode: string
  credit: number
  courseHour: number
  courseType: string
  teacherId: number
  teacherName: string
  teacherNo: string
  title: string
  department: string
  className: string
  college: string
  timeId: number
  dayOfWeek: number
  startPeriod: number
  endPeriod: number
  localId: number
  building: string
  classroom: string
}

export interface TeachInfoQuery {
  teacherId?: number
  courseId?: number
}
