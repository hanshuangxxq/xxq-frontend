import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type {
  ChunkSavedView,
  StoredFileRef,
  UploadInitRequest,
  UploadSessionView,
  VerifyResult,
} from './types'

const BASE = '/file'

/**
 * 文件模块接口(docs/文件传输接口总览.md §3)。
 *
 * 全部传 { loading: false, silent: true }:
 * - loading:分片上传的进度由全局上传面板展示,不能再让全局加载药丸出现第二个指示器;
 * - silent:失败与否由上传引擎按退避策略决定,引擎自行决定何时、以什么文案提示,
 *   api 层每次重试都弹一次提示会造成刷屏。
 */

/** 初始化/恢复上传会话(幂等,可秒传) POST /file/uploads */
export function initUpload(body: UploadInitRequest): Promise<Result<UploadSessionView>> {
  return api.post(`${BASE}/uploads`, body, { loading: false, silent: true })
}

/** 查询上传进度(只读,不创建会话;会话不存在时 404) GET /file/uploads/{uploadId} */
export function fetchUploadProgress(uploadId: string): Promise<Result<UploadSessionView>> {
  return api.get(`${BASE}/uploads/${encodeURIComponent(uploadId)}`, {
    loading: false,
    silent: true,
  })
}

/** 上传一个分片:裸二进制请求体 + X-Chunk-SHA256 头 PUT /file/uploads/{uploadId}/parts/{index} */
export function putChunk(
  uploadId: string,
  index: number,
  blob: Blob,
  chunkSha256: string,
  options: { onProgress?: (loaded: number, total: number) => void; signal?: AbortSignal },
): Promise<Result<ChunkSavedView>> {
  return api.putBinary<Result<ChunkSavedView>>(
    `${BASE}/uploads/${encodeURIComponent(uploadId)}/parts/${index}`,
    blob,
    {
      silent: true,
      onProgress: options.onProgress,
      signal: options.signal,
      headers: { 'X-Chunk-SHA256': chunkSha256 },
    },
  )
}

/**
 * 合并分片为成品(幂等,超时重试安全) POST /file/uploads/{uploadId}/complete。
 * 分片不齐会返回 400,由引擎调 verify 拿到缺失清单后补传重试,故此处不弹提示。
 */
export function completeUpload(uploadId: string): Promise<Result<StoredFileRef>> {
  return api.post(`${BASE}/uploads/${encodeURIComponent(uploadId)}/complete`, undefined, {
    loading: false,
    silent: true,
  })
}

/** 校验已收分片,返回缺失/损坏清单 POST /file/uploads/{uploadId}/verify */
export function verifyUpload(uploadId: string): Promise<Result<VerifyResult>> {
  return api.post(`${BASE}/uploads/${encodeURIComponent(uploadId)}/verify`, undefined, {
    loading: false,
    silent: true,
  })
}

/**
 * 取消上传:删除分片目录与会话 DELETE /file/uploads/{uploadId}。
 * 仅在用户主动取消时调用 —— 失败重试与暂停都**不能**调它,否则已传分片会丢。
 */
export function abortUpload(uploadId: string): Promise<Result<null>> {
  return api.delete(`${BASE}/uploads/${encodeURIComponent(uploadId)}`, {
    loading: false,
    silent: true,
  })
}
