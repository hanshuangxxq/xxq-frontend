export type SolveStatus = 'NOT_SOLVING' | 'SOLVING' | 'FINISHED'

export interface ScheduledLesson {
  id: number
  courseId: number
  courseName: string
  teacherId: number
  teacherName: string
  studentGroups: { id: number; name: string; college: string | null }[]
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
