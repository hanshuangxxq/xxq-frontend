import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type { ClassName, ClassNameForm } from './types'

// ---- 班级 CRUD ----

/** 分页查询班级列表 GET /class-names,返回 PageResult */
export function fetchClassNames(
  page?: number,
  pageSize?: number,
): Promise<Result<PageResult<ClassName>>> {
  const params = new URLSearchParams()
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  const qs = params.toString()
  return api.get(`/class-names${qs ? `?${qs}` : ''}`)
}

/** 按 id 查询单个班级 GET /class-names/{id} */
export function fetchClassName(id: number): Promise<Result<ClassName>> {
  return api.get(`/class-names/${id}`)
}

/** 创建班级 POST /class-names */
export function createClassName(body: ClassNameForm): Promise<Result<ClassName>> {
  return api.post('/class-names', body)
}

/** 更新班级 PUT /class-names/{id} */
export function updateClassName(id: number, body: ClassNameForm): Promise<Result<ClassName>> {
  return api.put(`/class-names/${id}`, body)
}

/** 删除班级 DELETE /class-names/{id} */
export function deleteClassName(id: number): Promise<Result<null>> {
  return api.delete(`/class-names/${id}`)
}
