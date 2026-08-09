import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type { ClassName, ClassNameForm } from './types'

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

export function fetchClassName(id: number): Promise<Result<ClassName>> {
  return api.get(`/class-names/${id}`)
}

export function createClassName(body: ClassNameForm): Promise<Result<ClassName>> {
  return api.post('/class-names', body)
}

export function updateClassName(id: number, body: ClassNameForm): Promise<Result<ClassName>> {
  return api.put(`/class-names/${id}`, body)
}

export function deleteClassName(id: number): Promise<Result<null>> {
  return api.delete(`/class-names/${id}`)
}
