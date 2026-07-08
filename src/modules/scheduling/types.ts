export type SolveStatus = 'NOT_SOLVING' | 'SOLVING' | 'FINISHED'

export interface ScheduledLesson {
  id: number
  courseId: number
  courseName: string
  teacherId: number
  teacherName: string
  startWeek: number
  endWeek: number
  studentGroups: { id: number; name: string; college: string; studentCount: number }[]
  timeslot: {
    id: number
    dayOfWeek: string
    startTime: string
    endTime: string
    reservedCourseId: number | null
  }
  room: {
    id: number
    building: string
    roomName: string
  }
}

export interface ScheduleSolution {
  id: number
  solverStatus: SolveStatus
  score: string
  lessonList: ScheduledLesson[]
}
