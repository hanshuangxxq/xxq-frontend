import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { College, CollegeCreateRequest, CollegeUpdateRequest } from './types'

export function fetchColleges(): Promise<Result<College[]>> {
  return api.get('/colleges')
}

export function createCollege(body: CollegeCreateRequest): Promise<Result<College>> {
  return api.post('/colleges', body)
}

export function updateCollege(id: number, body: CollegeUpdateRequest): Promise<Result<College>> {
  return api.put(`/colleges/${id}`, body)
}

export function deleteCollege(id: number): Promise<Result<null>> {
  return api.delete(`/colleges/${id}`)
}
