import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { Grade, GradeForm } from './types'

// ---- 年级 CRUD ----

/** 查询全部年级 GET /grades */
export function fetchGrades(): Promise<Result<Grade[]>> {
  return api.get('/grades')
}

/** 查询年级详情 GET /grades/{id} */
export function fetchGrade(id: number): Promise<Result<Grade>> {
  return api.get(`/grades/${id}`)
}

/** 创建年级 POST /grades */
export function createGrade(body: GradeForm): Promise<Result<Grade>> {
  return api.post('/grades', body)
}

/** 更新年级 PUT /grades/{id}（body 为部分字段，仅更新传入项） */
export function updateGrade(id: number, body: Partial<GradeForm>): Promise<Result<Grade>> {
  return api.put(`/grades/${id}`, body)
}

/** 删除年级 DELETE /grades/{id} */
export function deleteGrade(id: number): Promise<Result<null>> {
  return api.delete(`/grades/${id}`)
}
