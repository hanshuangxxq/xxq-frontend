/**
 * 课程来源：常规课来自 course 表（MANUAL），公选课来自 selection_campaign 表（SELECTION_CAMPAIGN）。
 * 两表 id 各自自增、数值可能重复，必须用 (id, source) 复合标识一门课。
 */
export type CourseSource = 'MANUAL' | 'SELECTION_CAMPAIGN'

/** 课程;常规课与公选课共用此结构,靠 source 区分来源 */
export interface Course {
  id: number
  courseName: string
  courseCode: string
  /** 学分 */
  credit: number
  /** 课时数 */
  courseHour: number
  courseType: string
  /** 后端对常规课可能返回 null，按 MANUAL 处理；公选课为 SELECTION_CAMPAIGN */
  source?: CourseSource | null
}

/** 课程表单,新建/编辑常规课共用;credit/courseHour 为 null 表示未填写,交由后端校验 */
export interface CourseForm {
  courseName: string
  courseCode: string
  credit: number | null
  courseHour: number | null
  courseType: string
}
