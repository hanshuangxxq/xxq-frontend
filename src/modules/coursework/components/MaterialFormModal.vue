<script setup lang="ts">
/**
 * 教师上传/编辑课程资料弹窗。
 *
 * 资料的**文件本体不可替换**（换文件 = 删除重传），所以编辑模式只改标题/描述，
 * 不提供选文件的入口，并在编辑态显式提示这一点，避免用户以为能换文件。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NUpload,
  NButton,
  NSpace,
  NText,
  useMessage,
  type UploadFileInfo,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { useLoading } from '@/shared/composables/useLoading'
import { prepareSubmitFile } from '@/modules/file/submit'
import { bizAccept, validateFileForBiz } from '@/modules/file/validate'
import { updateMaterial, uploadMaterial } from '../api'
import { MATERIAL_BIZ } from '../constants'
import type { MaterialView } from '../types'

const props = defineProps<{
  show: boolean
  courseId: number
  /** null = 上传新资料;非 null = 编辑该资料的标题/描述 */
  material: MaterialView | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const message = useMessage()

const isEdit = computed(() => props.material !== null)

const form = ref({ title: '', description: '' })
const fileList = ref<UploadFileInfo[]>([])
const { loading: saving, withLoading: withSaving } = useLoading()

watch(
  () => [props.show, props.material] as const,
  ([show]) => {
    if (!show) return
    const m = props.material
    form.value = { title: m?.title ?? '', description: m?.description ?? '' }
    fileList.value = []
  },
  { immediate: true },
)

function handleSave() {
  const f = form.value
  // data 里的必填字段缺失只会得到笼统的 400「请求体格式错误」,本地必须先校验
  if (!f.title.trim()) {
    message.warning(t('coursework.material.titleRequired'))
    return
  }
  const existing = props.material
  const raw = fileList.value[0]?.file ?? null
  // 新建时文件必给其一（file 或 filePath），没有文件后端会 400
  if (!existing && !raw) {
    message.warning(t('coursework.material.fileRequired'))
    return
  }
  if (raw) {
    const err = validateFileForBiz(raw, MATERIAL_BIZ)
    if (err) {
      message.warning(t(`file.error.${err}`))
      return
    }
  }

  return withSaving(async () => {
    try {
      if (existing) {
        await updateMaterial(existing.id, {
          title: f.title.trim(),
          description: f.description,
        })
      } else {
        // ≤20MB 走 multipart 整传；>20MB 自动分片上传，进度见右下角面板
        const prepared = await prepareSubmitFile(raw, MATERIAL_BIZ)
        await uploadMaterial(
          {
            teachInfoId: props.courseId,
            title: f.title.trim(),
            description: f.description,
          },
          prepared,
        )
      }
      message.success(
        t(existing ? 'coursework.material.editSuccess' : 'coursework.material.uploadSuccess'),
      )
      emit('update:show', false)
      emit('saved')
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.operationFail'))
      }
    }
  })
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="coursework-modal"
    :title="isEdit ? t('coursework.material.editTitle') : t('coursework.material.addTitle')"
    @update:show="emit('update:show', $event)"
  >
    <NForm :model="form" label-placement="top">
      <NFormItem :label="t('coursework.material.title')" required>
        <NInput v-model:value="form.title" maxlength="100" show-count />
      </NFormItem>
      <NFormItem :label="t('coursework.material.description')">
        <NInput v-model:value="form.description" type="textarea" :rows="3" />
      </NFormItem>
      <NFormItem v-if="isEdit" :label="t('coursework.common.selectFile')">
        <NText depth="3" class="upload-hint">
          {{ t('coursework.material.noFileTip') }}
        </NText>
      </NFormItem>
      <NFormItem v-else :label="t('coursework.material.tab')" required>
        <div class="upload-block">
          <NUpload
            v-model:file-list="fileList"
            :accept="bizAccept(MATERIAL_BIZ)"
            :max="1"
            :default-upload="false"
          >
            <NButton>{{ t('coursework.common.selectFile') }}</NButton>
          </NUpload>
        </div>
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">{{ t('coursework.common.cancel') }}</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">
          {{ t('coursework.common.save') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped src="./MaterialFormModal.css"></style>

<style>
.coursework-modal {
  width: 640px;
  max-width: 92vw;
}
</style>
