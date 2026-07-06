/** 批量导入的单个用户 */
export interface BatchImportUser {
  username: string
  password: string
  userType: 'student' | 'teacher'
  identifier?: string
  className?: string
  gender?: string
  department?: string
}

/** 批量导入请求 */
export interface BatchImportRequest {
  users: BatchImportUser[]
}

/** 单条导入结果 */
export interface BatchImportDetail {
  index: number
  username: string
  success: boolean
  message: string
}

/** 批量导入响应 */
export interface BatchImportResult {
  total: number
  successCount: number
  failCount: number
  details: BatchImportDetail[]
}
