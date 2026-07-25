export interface Grade {
  id: number
  name: string
  description: string | null
  createTime: string
  updateTime: string
}

export interface GradeForm {
  name: string
  description?: string
}
