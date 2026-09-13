/** 批量导入的单个用户 */
export interface BatchImportUser {
  username: string
  password: string
  userType: 'student' | 'teacher'
  /** 学号(学生)或工号(教师) */
  identifier?: string
  /** 班级名称,仅学生填写,须为后端已存在的班级 */
  className?: string
  /** 性别,中文枚举值(男/女);缺省表示未知 */
  gender?: string
  /** 院系名称,须为后端已存在的院系 */
  department?: string
}

/** 批量导入请求 */
export interface BatchImportRequest {
  users: BatchImportUser[]
}

/** 单条导入结果 */
export interface BatchImportDetail {
  /** 在提交批次中的序号(从 0 开始) */
  index: number
  username: string
  success: boolean
  /** 失败原因说明;成功时无实质内容 */
  message: string
}

/** 批量导入响应 */
export interface BatchImportResult {
  total: number
  successCount: number
  failCount: number
  details: BatchImportDetail[]
}
