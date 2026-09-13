import { api, type RequestOptions } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { ScheduleSolution } from './types'

// ---- 排课求解器 ----

/** 触发排课求解（异步任务，返回 scheduleId 用于轮询） POST /scheduling/solve */
export function solve(): Promise<Result<{ scheduleId: number }>> {
  return api.post('/scheduling/solve')
}

/** 查询求解方案；options 传 { loading: false, silent: true } 使轮询不打断全局加载、错误不自动弹窗 GET /scheduling/solution/{scheduleId} */
export function getSolution(
  scheduleId: number,
  options?: RequestOptions,
): Promise<Result<ScheduleSolution>> {
  return api.get(`/scheduling/solution/${scheduleId}`, options)
}

/** 停止当前求解任务 POST /scheduling/stop/{scheduleId} */
export function stopSolving(scheduleId: number): Promise<Result<null>> {
  return api.post(`/scheduling/stop/${scheduleId}`)
}
