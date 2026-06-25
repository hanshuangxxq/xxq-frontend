/** 统一响应包装类型 */
export interface Result<T> {
  code: number
  message: string
  data: T
}
