import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { TeachInfo, TeachInfoQuery } from './types'

export function fetchTeachInfoList(query?: TeachInfoQuery): Promise<Result<TeachInfo[]>> {
  const params = new URLSearchParams()
  if (query?.teacherId !== undefined) params.set('teacherId', String(query.teacherId))
  if (query?.courseId !== undefined) params.set('courseId', String(query.courseId))
  const qs = params.toString()
  return api.get(`/teach-info${qs ? `?${qs}` : ''}`)
}

export function fetchTeachInfo(id: number): Promise<Result<TeachInfo>> {
  return api.get(`/teach-info/${id}`)
}
