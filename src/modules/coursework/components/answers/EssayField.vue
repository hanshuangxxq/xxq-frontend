<script setup lang="ts">
/**
 * 大题作答:文本 + 附件(≤3 个)。
 *
 * 附件两种形态:
 * - keptFiles:已上传到文件模块的 {path, original}(重交时来自上次提交,或本次已传);
 * - fileList:NUpload 里**新选未传**的本地文件,提交时才经 uploadForStoredRef 上传换 path。
 * 新选上限 = 3 - 已保留数(后端每题附件 >3 会 400)。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NInput, NUpload, NButton, NTag, NSpace, type UploadFileInfo } from 'naive-ui'
import { bizAccept } from '@/modules/file/validate'
import { SUBMISSION_BIZ } from '../../constants'
import type { AssignmentQuestionView, EssayAnswerFile } from '../../types'

const props = defineProps<{
  question: AssignmentQuestionView
  text: string
  keptFiles: EssayAnswerFile[]
  fileList: UploadFileInfo[]
}>()

const emit = defineEmits<{
  'update:text': [value: string]
  'update:keptFiles': [value: EssayAnswerFile[]]
  'update:fileList': [value: UploadFileInfo[]]
}>()

const { t } = useI18n()

/** 后端每题附件 ≤3,新选上限随已保留数收缩 */
const maxNew = computed(() => Math.max(0, 3 - props.keptFiles.length))

function removeKept(index: number): void {
  emit(
    'update:keptFiles',
    props.keptFiles.filter((_, i) => i !== index),
  )
}

function handleTextUpdate(value: string): void {
  emit('update:text', value)
}

function handleFileListUpdate(value: UploadFileInfo[]): void {
  emit('update:fileList', value)
}
</script>

<template>
  <div class="essay-field">
    <NInput
      :value="text"
      type="textarea"
      :rows="5"
      :placeholder="t('coursework.answer.essayTextPlaceholder')"
      @update:value="handleTextUpdate"
    />
    <div v-if="keptFiles.length" class="essay-kept">
      <NTag
        v-for="(file, index) in keptFiles"
        :key="file.path"
        size="small"
        closable
        @close="removeKept(index)"
      >
        {{ file.original }}
      </NTag>
    </div>
    <NSpace v-if="maxNew > 0" align="center" :size="8">
      <NUpload
        :file-list="fileList"
        :accept="bizAccept(SUBMISSION_BIZ)"
        :max="maxNew"
        :default-upload="false"
        @update:file-list="handleFileListUpdate"
      >
        <NButton size="small">{{ t('coursework.common.selectFile') }}</NButton>
      </NUpload>
    </NSpace>
  </div>
</template>

<style scoped>
.essay-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.essay-kept {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
