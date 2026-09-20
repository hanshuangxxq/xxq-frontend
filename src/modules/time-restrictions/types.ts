/** 限制类型：BLOCKED 禁排（该时段不可排课） / RESERVED 预留（为指定课程保留时段） */
export type RestrictionType = 'BLOCKED' | 'RESERVED'

/** 时段限制记录（一周内某时段的禁排/预留规则） */
export interface TimeRestriction {
  id: number
  /** 关联的上课时段 id（curriculum 模块的 TimeSlot） */
  timeId: number
  /** 星期几（1-7，周一为 1） */
  dayOfWeek: number
  restrictionType: RestrictionType
  /** 预留课程 id，仅 RESERVED 时有意义；BLOCKED 为 null */
  courseId: number | null
  /**
   * 认领该时段的选课活动 id（仅 RESERVED 时有意义）。
   * courseId 与 campaignId 至多一个非空：谁先绑定谁占用，选课活动字段组据此
   * 排除已被别的课程/活动占用的时段。
   */
  campaignId: number | null
  /** 限制原因说明 */
  reason: string
}

/** 时段限制表单（新建/编辑共用；timeId/dayOfWeek/courseId 为 null 表示未选择） */
export interface TimeRestrictionForm {
  timeId: number | null
  dayOfWeek: number | null
  restrictionType: RestrictionType
  courseId: number | null
  reason: string
}
