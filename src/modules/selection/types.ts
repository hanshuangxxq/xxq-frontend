/** 活动状态：DRAFT 草稿 / OPEN 开放选课 / CLOSED 已关闭 / FINALIZED 已结束（已生成选课结果） */
export type CampaignStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'FINALIZED'

/** 选课记录状态：SELECTED 已选 / DROPPED 已退 */
export type SelectionRecordStatus = 'SELECTED' | 'DROPPED'

/**
 * 课程类型（CurseEnum 经 @JsonValue 序列化为描述文本）。
 */
export type CourseType = '必修' | '选修' | '公选' | '实践'

/**
 * 选课活动（管理员视角）。
 * 重构后活动即课程：campaign 直接携带课程字段，不再有独立的 selection_course。
 */
export interface Campaign {
  id: number
  name: string
  semesterId: number
  semesterName: string
  /** 解耦后公选课不再关联 course 表，courseId 置 null；改用 id 标识公选课 */
  courseId: number | null
  startWeek: number
  endWeek: number
  startTime: string
  endTime: string
  status: CampaignStatus
  courseCode: string
  credit: number
  courseHour: number | null
  description: string | null
  courseType: string | null
  allowedGradeIds: number[]
  allowedMajors: number[]
  timeRestrictionIds: number[]
  capacity: number
  groupId: number | null
  groupName: string | null
  createTime: string
  /**
   * 该活动当前绑定的选课组 ID。
   * 仅在「按组查可绑定活动」接口（fetchBindableCampaigns）的返回中填充，
   * 其它接口（fetchCampaigns / fetchCampaign）保持为 null。
   */
  boundGroupId?: number | null
}

/**
 * 新建/修改选课活动表单。
 * 创建时 name/courseCode/credit/capacity 必填；修改时支持部分更新。
 * name 字段同时作为活动名称与课程名称。
 */
export interface CampaignForm {
  name: string
  semesterId: number | null
  startTime?: string
  endTime?: string
  startWeek?: number
  endWeek?: number
  /**
   * 选课组 ID。
   * - 创建时：非空则在创建活动的同时绑定到该组
   * - 修改时：非空且与当前绑定不同时触发换绑；不传或为 null 时不修改绑定（除非 unbindGroup=true）
   * 与 unbindGroup 互斥。
   */
  groupId?: number | null
  /**
   * 是否解绑当前选课组，默认 false。
   * 为 true 时清除绑定（要求 DRAFT 状态、原组内无课程）。
   * 与 groupId 互斥。
   */
  unbindGroup?: boolean
  courseCode: string
  credit: number
  courseHour?: number | null
  description?: string | null
  courseType?: string | null
  allowedGradeIds?: number[]
  allowedMajors?: number[]
  timeRestrictionIds?: number[]
  capacity: number
}

/** 选课组：将活动分组，并限制组内最多可选课程数 */
export interface SelectionGroup {
  id: number
  name: string
  /** 组内最多可选课程数 */
  maxCourses: number
  /** 当前绑定活动数（大于 0 时不可删除） */
  campaignCount: number
  createTime: string
}

/** 新建/修改选课组表单 */
export interface SelectionGroupForm {
  name: string
  maxCourses: number
}

/**
 * 学生端选课活动视图。
 * 在 Campaign 基础上附加组上下文与实时选课状态。
 */
export interface StudentCampaign extends Campaign {
  /** 所属组可选上限，未分组活动为 null（不显示组进度） */
  groupMax: number | null
  /** 本组内已选总数（跨活动累计） */
  selectedInGroup: number
  /** 本活动已选人数 */
  selectedCount: number
  /** 剩余名额 */
  remaining: number
  /** 本人是否已选该活动 */
  selectedByMe: boolean
}

/** 选课记录（学生视角） */
export interface SelectionRecord {
  id: number
  campaignId: number
  courseName: string
  courseCode: string
  credit: number
  courseType: string | null
  status: SelectionRecordStatus
  selectTime: string
  /** 退课时间，未退课时为 null */
  dropTime: string | null
}

/** 选课请求：仅需活动 ID */
export interface SelectionRecordForm {
  campaignId: number
}

/** 选课结果班级成员 */
export interface StudentSelectionMember {
  studentId: number
  studentName: string
  studentNo: string
  className: string
}

/** 选课结果班级：活动结束（finalize）后按容量拆分生成，可为每个班分配授课教师 */
export interface SelectionClass {
  classId: number
  courseName: string
  classNo: number
  studentCount: number
  /** 分配的授课教师，未分配时为 null */
  teacherId: number | null
  /** 分配的授课教师姓名，未分配时为 null */
  teacherName: string | null
  members: StudentSelectionMember[]
}
