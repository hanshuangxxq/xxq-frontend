import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { TimeRestriction, TimeRestrictionForm } from './types'

// ---- 时段限制 CRUD（禁排/预留规则，供排课求解器作为约束） ----

/** 查询全部时段限制 GET /time-restrictions */
export function fetchTimeRestrictions(): Promise<Result<TimeRestriction[]>> {
  return api.get('/time-restrictions')
}

/** 查询单个时段限制详情 GET /time-restrictions/{id} */
export function fetchTimeRestriction(id: number): Promise<Result<TimeRestriction>> {
  return api.get(`/time-restrictions/${id}`)
}

/** 新建时段限制 POST /time-restrictions */
export function createTimeRestriction(body: TimeRestrictionForm): Promise<Result<TimeRestriction>> {
  return api.post('/time-restrictions', body)
}

/** 更新时段限制 PUT /time-restrictions/{id} */
export function updateTimeRestriction(
  id: number,
  body: TimeRestrictionForm,
): Promise<Result<TimeRestriction>> {
  return api.put(`/time-restrictions/${id}`, body)
}

/** 删除时段限制 DELETE /time-restrictions/{id} */
export function deleteTimeRestriction(id: number): Promise<Result<null>> {
  return api.delete(`/time-restrictions/${id}`)
}
