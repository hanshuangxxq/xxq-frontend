/** 年级视图（如 2023 级，学生入学年份维度） */
export interface Grade {
  id: number
  name: string
  /** 描述，可为空 */
  description: string | null
  createTime: string
  updateTime: string
}

/** 年级创建/编辑表单 */
export interface GradeForm {
  name: string
  description?: string
}
