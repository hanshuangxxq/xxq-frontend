export interface ClassName {
  id: number
  className: string
  /** 所属院系 id（-> college.id） */
  collegeId: number | null
}

export interface ClassNameForm {
  className: string
  collegeId: number | null
}
