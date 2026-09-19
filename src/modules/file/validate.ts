import { BIZ_EXTENSIONS, CHUNK_MAX_SIZE, WHOLE_MAX_SIZE } from './constants'
import type { BizCode } from './types'

/** 校验失败原因:'type' 扩展名不在白名单 / 'empty' 空文件 / 'tooLarge' 超 2GB */
export type FileValidationError = 'type' | 'empty' | 'tooLarge' | null

/** 取小写扩展名(含点)。隐藏文件('.gitignore')视为无扩展名 */
function extensionOf(name: string): string {
  const index = name.lastIndexOf('.')
  return index <= 0 ? '' : name.slice(index).toLowerCase()
}

/**
 * 按业务目录校验文件:扩展名白名单 + 非空 + 2GB 总上限。
 * 刻意不校验 20MB —— 超过 20MB 会自动改走分片上传,那是正常路径而非错误。
 */
export function validateFileForBiz(file: File, biz: BizCode): FileValidationError {
  if (!BIZ_EXTENSIONS[biz].includes(extensionOf(file.name))) return 'type'
  if (file.size === 0) return 'empty'
  if (file.size > CHUNK_MAX_SIZE) return 'tooLarge'
  return null
}

/** 该大小是否需要走分片上传(>20MB 时整传会被后端业务层拒绝) */
export function needsChunkedUpload(size: number): boolean {
  return size > WHOLE_MAX_SIZE
}

/** NUpload 的 accept 属性值,由 biz 的扩展名白名单派生 */
export function bizAccept(biz: BizCode): string {
  return BIZ_EXTENSIONS[biz].join(',')
}

/** 提示文案用的扩展名列表,如 '.doc/.docx/.pdf' */
export function bizExtensionHint(biz: BizCode): string {
  return BIZ_EXTENSIONS[biz].join('/')
}
