/** 院系 */
export interface College {
  id: number
  collegeName: string
  collegeCode: string | null
  collegeNo: string | null
  createTime: string
  updateTime: string
}

export interface CollegeCreateRequest {
  collegeName: string
  collegeCode?: string
  collegeNo?: string
}

/** 部分更新：非空字段才更新 */
export interface CollegeUpdateRequest {
  collegeName?: string
  collegeCode?: string
  collegeNo?: string
}
