import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { Local, LocalForm, LocalQuery } from './types'

export function fetchLocals(query?: LocalQuery): Promise<Result<Local[]>> {
  const params = new URLSearchParams()
  if (query?.type) params.set('type', query.type)
  const qs = params.toString()
  return api.get(`/locals${qs ? `?${qs}` : ''}`)
}

export function fetchLocal(id: number): Promise<Result<Local>> {
  return api.get(`/locals/${id}`)
}

export function createLocal(body: LocalForm): Promise<Result<Local>> {
  return api.post('/locals', body)
}

export function updateLocal(id: number, body: LocalForm): Promise<Result<Local>> {
  return api.put(`/locals/${id}`, body)
}

export function deleteLocal(id: number): Promise<Result<null>> {
  return api.delete(`/locals/${id}`)
}
