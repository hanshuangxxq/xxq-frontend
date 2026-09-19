/**
 * 文件模块类型定义,逐字镜像后端 module/file 的契约。
 * 契约原文见 docs/文件传输接口总览.md §3(分片上传)与 §4.2(业务提交二选一)。
 */

/** 业务目录白名单,与后端 FileBizEnum 的 9 个 code 一一对应,传其它值后端直接 400 */
export type BizCode =
  | 'graduation-thesis'
  | 'graduation-opening-report'
  | 'graduation-midterm'
  | 'internship-report'
  | 'social-practice-report'
  | 'graduation-duplicate-report'
  | 'graduation-campaign-material'
  | 'graduation-defense-material'
  | 'competition-certificate'

/** 初始化/恢复上传会话的请求体 POST /file/uploads */
export interface UploadInitRequest {
  biz: BizCode
  /** 原始文件名(含扩展名);服务端按扩展名做白名单校验 */
  originalName: string
  totalSize: number
  totalChunks: number
  /** 整文件 SHA-256,64 位小写十六进制 */
  sha256: string
}

/** 合并后的产物引用;storedPath 提交给业务端点的 filePath 字段 */
export interface StoredFileRef {
  /** 形如 objects/{biz}/{sha256}{ext} */
  storedPath: string
  originalName: string
  size: number
  sha256: string
  biz: BizCode
}

/** 上传会话视图:POST /file/uploads 与 GET /file/uploads/{uploadId} 的 data */
export interface UploadSessionView {
  /** 秒传命中时为 null;正常会话是 sha256(biz:ownerId:文件sha256) 的确定性派生值 */
  uploadId: string | null
  biz: BizCode
  originalName: string
  totalSize: number
  /**
   * ★ 切片一律以本字段为准。续传时服务端以磁盘 meta.json 为权威,会忽略请求里的分片粒度,
   * 用客户端自己的目标片大小去切片会导致「分片大小不符」而全量重传。
   */
  chunkSize: number
  totalChunks: number
  sha256: string
  /** 服务端已收分片序号(升序,0 基);跳过这些即可续传 */
  receivedChunks: number[]
  receivedCount: number
  /** ★ 非 null 即「不用再传了」:秒传命中,或该会话此前已合并过 */
  completedFile: StoredFileRef | null
}

/** 单个分片的上传结果 PUT /file/uploads/{uploadId}/parts/{index} 的 data */
export interface ChunkSavedView {
  index: number
  receivedCount: number
}

/** 分片校验结果 POST /file/uploads/{uploadId}/verify 的 data */
export interface VerifyResult {
  received: number[]
  missing: number[]
  badDigest: number[]
  /** false 表示会话由磁盘重建、没有摘要基线,此时 badDigest 恒为空 */
  hashesKnown: boolean
  /** ★ 服务端已预合并 missing ∪ badDigest,直接重传这些序号即可,不要再自己求并集 */
  retryable: number[]
}

/**
 * 业务提交时文件的「二选一」载体(接口文档 §4.2 形态 A)。
 * file 与 filePath 只能给一个,同时给会被后端 400 拒绝。
 */
export interface PreparedSubmitFile {
  /** ≤20MB:multipart 的 file 部分 */
  file: File | null
  /** >20MB:分片产物路径,写进 data JSON 的 filePath */
  filePath: string | null
  /** 展示文件名,配合 filePath 使用 */
  fileOriginal: string | null
}
