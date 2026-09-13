import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type { Local, LocalForm, LocalQuery } from './types'

/** 分页查询教室列表 GET /locals，支持按类型筛选，返回 PageResult */
export function fetchLocals(query?: LocalQuery): Promise<Result<PageResult<Local>>> {
  const params = new URLSearchParams()
  if (query?.type) params.set('type', query.type)
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`/locals${qs ? `?${qs}` : ''}`)
}

/** 查询教室详情 GET /locals/{id} */
export function fetchLocal(id: number): Promise<Result<Local>> {
  return api.get(`/locals/${id}`)
}

/** 创建教室 POST /locals（实验室/机房必须指定管理者） */
export function createLocal(body: LocalForm): Promise<Result<Local>> {
  return api.post('/locals', body)
}

/** 更新教室 PUT /locals/{id} */
export function updateLocal(id: number, body: LocalForm): Promise<Result<Local>> {
  return api.put(`/locals/${id}`, body)
}

/** 删除教室 DELETE /locals/{id} */
export function deleteLocal(id: number): Promise<Result<null>> {
  return api.delete(`/locals/${id}`)
}
