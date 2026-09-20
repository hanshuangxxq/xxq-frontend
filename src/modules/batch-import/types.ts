/**
 * 批量导入的单个用户。
 *
 * 字段名沿用后端 UserImportItem 的历史命名,与语义并不一致,改动前请先对照后端:
 * `className` 实为**年级名**、`department` 对学生是**班级名**、对教师是**院系名**。
 * 学生的专业与院系不落库,读取时由班级推导。
 */
export interface BatchImportUser {
  username: string
  password: string
  userType: 'student' | 'teacher'
  /** 学号(学生)或工号(教师) */
  identifier?: string
  /** 年级名称,仅学生填写,须为后端已存在的年级 */
  className?: string
  /** 性别,中文枚举值(男/女);缺省表示未知 */
  gender?: string
  /** 学生填班级名称(须已存在且已挂专业)、教师填院系名称,均须为后端已存在的记录 */
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
