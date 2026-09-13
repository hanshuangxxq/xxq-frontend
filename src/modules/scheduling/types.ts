/** 求解器状态：空闲 / 求解中 / 已完成 */
export type SolveStatus = 'NOT_SOLVING' | 'SOLVING' | 'FINISHED'

/** 求解结果中的一条排课（课程 + 上课时段 + 教室） */
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
    /** 预留该时段的课程 id（time-restrictions 预留规则），无预留为 null */
    reservedCourseId: number | null
  }
  room: {
    id: number
    building: string
    roomName: string
  }
}

/** 一次排课求解的方案（轮询返回；solverStatus=FINISHED 时 lessonList 为最终结果） */
export interface ScheduleSolution {
  id: number
  solverStatus: SolveStatus
  /** 求解器得分文本（硬/软约束扣分情况，用于评估方案质量） */
  score: string
  lessonList: ScheduledLesson[]
}
