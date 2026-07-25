import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { Grade, GradeForm } from './types'

export function fetchGrades(): Promise<Result<Grade[]>> {
  return api.get('/grades')
}

export function fetchGrade(id: number): Promise<Result<Grade>> {
  return api.get(`/grades/${id}`)
}

export function createGrade(body: GradeForm): Promise<Result<Grade>> {
  return api.post('/grades', body)
}

export function updateGrade(id: number, body: Partial<GradeForm>): Promise<Result<Grade>> {
  return api.put(`/grades/${id}`, body)
}

export function deleteGrade(id: number): Promise<Result<null>> {
  return api.delete(`/grades/${id}`)
}
