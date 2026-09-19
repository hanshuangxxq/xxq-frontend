import { computed, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UploadFileInfo } from 'naive-ui'
import { formatBytes } from '@/shared/utils/format'
import { bizExtensionHint, needsChunkedUpload } from './validate'
import type { BizCode } from './types'

/**
 * 文件选择框下方的提示文案。
 *
 * 选中大文件时提前告知「将走分片上传」:否则用户点提交后突然冒出一个悬浮进度面板,
 * 会以为是出了意外。未选文件或文件不大时退回常规的格式/大小说明。
 */
export function useUploadHint(fileList: Ref<UploadFileInfo[]>, biz: BizCode): ComputedRef<string> {
  const { t } = useI18n()

  return computed(() => {
    const file = fileList.value[0]?.file
    if (file && needsChunkedUpload(file.size)) {
      return t('file.hint.willChunk', { size: formatBytes(file.size) })
    }
    return t('file.hint.wholeLimit', { exts: bizExtensionHint(biz) })
  })
}
