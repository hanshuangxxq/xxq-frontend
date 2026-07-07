import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { Major, MajorForm } from './types'

export function fetchMajors(): Promise<Result<Major[]>> {
  return api.get('/majors')
}

export function createMajor(body: MajorForm): Promise<Result<Major>> {
  return api.post('/majors', body)
}

export function updateMajor(id: number, body: MajorForm): Promise<Result<Major>> {
  return api.put(`/majors/${id}`, body)
}

export function deleteMajor(id: number): Promise<Result<boolean>> {
  return api.delete(`/majors/${id}`)
}
