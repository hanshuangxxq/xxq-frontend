import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { ClassName, ClassNameForm } from './types'

export function fetchClassNames(): Promise<Result<ClassName[]>> {
  return api.get('/class-names')
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
