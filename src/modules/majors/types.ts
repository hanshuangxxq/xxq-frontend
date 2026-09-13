/** 专业视图 */
export interface Major {
  id: number
  majorName: string
  /** 所属院系 id（-> college.id） */
  collegeId: number | null
}

/** 专业创建/编辑表单 */
export interface MajorForm {
  majorName: string
  collegeId: number | null
}
