import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { Major, MajorForm } from './types'

/** 查询全部专业 GET /majors */
export function fetchMajors(): Promise<Result<Major[]>> {
  return api.get('/majors')
}

/** 创建专业 POST /majors */
export function createMajor(body: MajorForm): Promise<Result<Major>> {
  return api.post('/majors', body)
}

/** 更新专业 PUT /majors/{id} */
export function updateMajor(id: number, body: MajorForm): Promise<Result<Major>> {
  return api.put(`/majors/${id}`, body)
}

/** 删除专业 DELETE /majors/{id} */
export function deleteMajor(id: number): Promise<Result<boolean>> {
  return api.delete(`/majors/${id}`)
}
