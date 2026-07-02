import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { ScheduleSolution } from './types'

export function solve(): Promise<Result<{ scheduleId: number }>> {
  return api.post('/scheduling/solve')
}

export function getSolution(scheduleId: number): Promise<Result<ScheduleSolution>> {
  return api.get(`/scheduling/solution/${scheduleId}`)
}

export function stopSolving(scheduleId: number): Promise<Result<null>> {
  return api.post(`/scheduling/stop/${scheduleId}`)
}
