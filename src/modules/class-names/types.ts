/** 班级(行政班) */
export interface ClassName {
  id: number
  className: string
  /** 所属院系 id（-> college.id） */
  collegeId: number | null
}

/** 班级表单,新建/编辑共用;collegeId 为 null 表示不挂院系 */
export interface ClassNameForm {
  className: string
  collegeId: number | null
}
