import { BusinessError } from '@/shared/api'
import { message } from '@/shared/discrete'
import i18n from '@/i18n'
import { WHOLE_MAX_SIZE } from './constants'
import { useUploadStore } from './store'
import type { BizCode, PreparedSubmitFile } from './types'

/**
 * 按文件大小二选一,返回可交给业务提交接口的载体:
 * - ≤20MB:原样走 multipart 的 file 部分,与改造前完全一致;
 * - >20MB:走分片上传拿产物路径,提交时写进 data 的 filePath(接口文档 §4.2 形态 A)。
 *
 * 20MB 这条线不是随便定的:后端业务层整传上限就是 20MB,
 * 超过它整传必然被拒,只能走分片。
 *
 * 分片进度由全局上传面板展示,本函数只负责等待任务结束,
 * 因此页面侧的「提交中」按钮态与既有 catch 分支都无需改动。
 */
export async function prepareSubmitFile(
  file: File | null,
  biz: BizCode,
): Promise<PreparedSubmitFile> {
  if (!file) return { file: null, filePath: null, fileOriginal: null }
  if (file.size <= WHOLE_MAX_SIZE) return { file, filePath: null, fileOriginal: null }

  const store = useUploadStore()
  const task = store.enqueue(file, biz)
  // 上传不绑定组件生命周期:即使用户切走路由,任务也会继续跑完
  const ref = await task.done

  // 防御:产物路径的 biz 段必须与本次提交的业务目录一致,
  // 否则会被后端以 403「文件不属于该业务目录」拒绝
  if (!ref.storedPath.startsWith(`objects/${biz}/`)) {
    const text = i18n.global.t('file.error.bizMismatch')
    message.error(text)
    throw new BusinessError(text, 403)
  }

  return { file: null, filePath: ref.storedPath, fileOriginal: ref.originalName }
}
