import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { College, CollegeCreateRequest, CollegeUpdateRequest } from './types'

// ---- 院系 CRUD ----

/** 查询全部院系列表 GET /colleges(不分页,直接返回全量数组,供下拉选择等场景) */
export function fetchColleges(): Promise<Result<College[]>> {
  return api.get('/colleges')
}

/** 创建院系 POST /colleges */
export function createCollege(body: CollegeCreateRequest): Promise<Result<College>> {
  return api.post('/colleges', body)
}

/** 更新院系 PUT /colleges/{id} */
export function updateCollege(id: number, body: CollegeUpdateRequest): Promise<Result<College>> {
  return api.put(`/colleges/${id}`, body)
}

/** 删除院系 DELETE /colleges/{id} */
export function deleteCollege(id: number): Promise<Result<null>> {
  return api.delete(`/colleges/${id}`)
}
