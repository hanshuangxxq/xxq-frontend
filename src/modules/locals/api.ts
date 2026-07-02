import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { Local, LocalForm } from './types'

export function fetchLocals(): Promise<Result<Local[]>> {
  return api.get('/locals')
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
