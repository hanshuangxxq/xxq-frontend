export interface Major {
  id: number
  majorName: string
  /** 所属院系 id（-> college.id） */
  collegeId: number | null
}

export interface MajorForm {
  majorName: string
  collegeId: number | null
}
