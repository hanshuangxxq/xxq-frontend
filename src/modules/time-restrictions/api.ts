import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { TimeRestriction, TimeRestrictionForm } from './types'

export function fetchTimeRestrictions(): Promise<Result<TimeRestriction[]>> {
  return api.get('/time-restrictions')
}

export function fetchTimeRestriction(id: number): Promise<Result<TimeRestriction>> {
  return api.get(`/time-restrictions/${id}`)
}

export function createTimeRestriction(body: TimeRestrictionForm): Promise<Result<TimeRestriction>> {
  return api.post('/time-restrictions', body)
}

export function updateTimeRestriction(
  id: number,
  body: TimeRestrictionForm,
): Promise<Result<TimeRestriction>> {
  return api.put(`/time-restrictions/${id}`, body)
}

export function deleteTimeRestriction(id: number): Promise<Result<null>> {
  return api.delete(`/time-restrictions/${id}`)
}
