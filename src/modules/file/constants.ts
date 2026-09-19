import type { BizCode } from './types'

/** 整传上限:后端 FileBizEnum.maxWholeSize(接口文档 §2.3) */
export const WHOLE_MAX_SIZE = 20 * 1024 * 1024

/** 分片上传总上限:后端 file.max-file-size(接口文档 §2.3) */
export const CHUNK_MAX_SIZE = 2 * 1024 * 1024 * 1024

/** 目标分片大小。只用于推导首次 init 的 totalChunks;续传必须改用响应里的 chunkSize */
export const TARGET_CHUNK_SIZE = 5 * 1024 * 1024

/** 分片数量上限,与后端校验口径一致 */
export const MAX_TOTAL_CHUNKS = 10000

/** 并发上传分片数,契约建议 3–5(接口文档 §3.8) */
export const CHUNK_CONCURRENCY = 4

/** 单个分片的最大尝试次数(含首次),超限则整个任务失败 */
export const MAX_CHUNK_ATTEMPTS = 4

/** complete 失败后「verify → 补传 → 再 complete」的最大轮次 */
export const MAX_VERIFY_ROUNDS = 2

/**
 * 60 秒窗口内允许发出的分片请求数。服务端文件档是 600 次/分钟(接口文档 §2.4),
 * 留 20% 余量给续传查询、verify、complete 等同桶请求。
 * 必须有这个闸门:2GB ÷ 5MB ≈ 410 个分片,4 并发在快链路上能打出 ~2000 次/分钟,
 * 只靠 429 之后退避会把上传拖成反复撞墙。
 */
export const RATE_WINDOW_LIMIT = 480
export const RATE_WINDOW_MS = 60_000

/** 429 退避基数:1s → 2s → 4s(接口文档 §2.4) */
export const RETRY_BASE_DELAY_MS = 1000

/** 整文件哈希的读取片大小,决定哈希阶段的内存占用上界(恒定一片) */
export const HASH_SLICE_SIZE = 4 * 1024 * 1024

/** 文档类业务目录的扩展名白名单,镜像后端 FileBizEnum */
const DOC_EXTENSIONS = ['.doc', '.docx', '.pdf', '.zip', '.rar'] as const
/** 证书类额外放行图片(常为扫描件/照片),镜像后端 FileBizEnum */
const CERT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'] as const

/**
 * biz -> 允许的扩展名(小写,含点)。必须与后端 FileBizEnum 保持一致 ——
 * 服务端既决定磁盘目录也决定扩展名白名单,这里只是把错误提前到选文件时暴露。
 */
export const BIZ_EXTENSIONS: Record<BizCode, readonly string[]> = {
  'graduation-thesis': DOC_EXTENSIONS,
  'graduation-opening-report': DOC_EXTENSIONS,
  'graduation-midterm': DOC_EXTENSIONS,
  'internship-report': DOC_EXTENSIONS,
  'social-practice-report': DOC_EXTENSIONS,
  'graduation-duplicate-report': DOC_EXTENSIONS,
  'graduation-campaign-material': DOC_EXTENSIONS,
  'graduation-defense-material': DOC_EXTENSIONS,
  'competition-certificate': CERT_EXTENSIONS,
}
