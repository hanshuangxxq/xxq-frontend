import { api, type RequestOptions } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { ScheduleSolution } from './types'

export function solve(): Promise<Result<{ scheduleId: number }>> {
  return api.post('/scheduling/solve')
}

export function getSolution(
  scheduleId: number,
  options?: RequestOptions,
): Promise<Result<ScheduleSolution>> {
  return api.get(`/scheduling/solution/${scheduleId}`, options)
}

export function stopSolving(scheduleId: number): Promise<Result<null>> {
  return api.post(`/scheduling/stop/${scheduleId}`)
}
