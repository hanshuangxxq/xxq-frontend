/** 统一响应包装类型 */
export interface Result<T> {
  code: number
  message: string
  data: T
}

/** 分页结果（后端 PageResult<T>）：列表分页接口的 data 即此结构 */
export interface PageResult<T> {
  /** 当前页数据列表 */
  records: T[]
  /** 符合查询条件的总记录数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pageSize: number
  /** 总页数 */
  pages: number
}

/** 分页请求参数（与各接口自身查询条件并列传递） */
export interface PageQuery {
  /** 页码，从 1 开始 */
  page?: number
  /** 每页条数，上限 100 */
  pageSize?: number
}
