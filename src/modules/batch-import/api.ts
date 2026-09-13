import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { BatchImportRequest, BatchImportResult } from './types'

/** 批量导入学生/教师账号 POST /academic/batch-import,返回逐条导入明细 */
export function batchImportUsers(body: BatchImportRequest): Promise<Result<BatchImportResult>> {
  return api.post('/academic/batch-import', body)
}
