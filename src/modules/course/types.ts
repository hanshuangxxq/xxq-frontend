/**
 * 课程来源：常规课来自 course 表（MANUAL），公选课来自 selection_campaign 表（SELECTION_CAMPAIGN）。
 * 两表 id 各自自增、数值可能重复，必须用 (id, source) 复合标识一门课。
 */
export type CourseSource = 'MANUAL' | 'SELECTION_CAMPAIGN'

export interface Course {
  id: number
  courseName: string
  courseCode: string
  credit: number
  courseHour: number
  courseType: string
  /** 后端对常规课可能返回 null，按 MANUAL 处理；公选课为 SELECTION_CAMPAIGN */
  source?: CourseSource | null
}

export interface CourseForm {
  courseName: string
  courseCode: string
  credit: number | null
  courseHour: number | null
  courseType: string
}
