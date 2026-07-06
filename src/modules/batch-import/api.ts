import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { BatchImportRequest, BatchImportResult } from './types'

export function batchImportUsers(body: BatchImportRequest): Promise<Result<BatchImportResult>> {
  return api.post('/aAdmin/batch-import', body)
}
