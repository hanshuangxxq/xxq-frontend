<script setup lang="ts">
/**
 * 教师登记/编辑教学视频弹窗。
 *
 * 两个契约要点:
 * - **服务端不解码视频，`durationSec` 由前端解析后回传**（文档 §3.2）。这里用
 *   `<video>` 元素的 loadedmetadata 拿时长（文档明确允许的做法），探测失败就不传该字段 ——
 *   列表里只是没有时长可显示，不阻塞登记；
 * - 视频文件**不可替换**，换视频 = 删除后重新登记，所以编辑模式只改元数据、不给选文件入口。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
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
import { registerVideo, updateVideo } from '../api'
import { VIDEO_BIZ } from '../constants'
import type { VideoView } from '../types'

/** 时长探测的超时上限(见 probeDuration):超时即放弃回传 durationSec */
const PROBE_TIMEOUT_MS = 10_000

const props = defineProps<{
  show: boolean
  courseId: number
  /** null = 登记新视频；非 null = 编辑该视频的元数据 */
  video: VideoView | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const message = useMessage()

const isEdit = computed(() => props.video !== null)

const form = ref({
  title: '',
  description: '',
  sortNo: 0,
  durationSec: null as number | null,
})
const fileList = ref<UploadFileInfo[]>([])
const { loading: saving, withLoading: withSaving } = useLoading()

watch(
  () => [props.show, props.video] as const,
  ([show]) => {
    if (!show) return
    const v = props.video
    form.value = {
      title: v?.title ?? '',
      description: v?.description ?? '',
      sortNo: v?.sortNo ?? 0,
      durationSec: v?.durationSec ?? null,
    }
    fileList.value = []
  },
  { immediate: true },
)

/**
 * 用 <video> 探测时长。走 objectURL 而不是真实 src：文件还没上传，本地就能读。
 * 失败（编码不支持、元数据缺失）时返回 null，由调用方决定不传该字段。
 */
function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const probe = document.createElement('video')
    let timer: ReturnType<typeof setTimeout> | null = null
    probe.preload = 'metadata'
    const finish = (value: number | null) => {
      if (timer) clearTimeout(timer)
      URL.revokeObjectURL(url)
      probe.removeAttribute('src')
      resolve(value)
    }
    probe.onloadedmetadata = () => {
      const seconds = probe.duration
      finish(Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null)
    }
    probe.onerror = () => finish(null)
    // 容器畸形/缺解码器时可能既不触发 loadedmetadata 也不触发 error,
    // 没有这道超时就会永远挂在这里,连带 handleSave 一直卡在 saving。
    // 超时按「探不出来」处理 —— durationSec 本来就是选填。
    timer = setTimeout(() => finish(null), PROBE_TIMEOUT_MS)
    probe.src = url
  })
}

function handleSave() {
  const f = form.value
  if (!f.title.trim()) {
    message.warning(t('coursework.video.titleRequired'))
    return
  }
  const existing = props.video
  const raw = fileList.value[0]?.file ?? null
  // 新建必须给文件（file part 或 filePath 二选一），否则后端 400
  if (!existing && !raw) {
    message.warning(t('coursework.video.fileRequired'))
    return
  }
  if (raw) {
    const err = validateFileForBiz(raw, VIDEO_BIZ)
    if (err) {
      message.warning(t(`file.error.${err}`))
      return
    }
  }

  return withSaving(async () => {
    try {
      if (existing) {
        await updateVideo(existing.id, {
          title: f.title.trim(),
          description: f.description,
          sortNo: f.sortNo ?? 0,
          durationSec: f.durationSec ?? undefined,
        })
      } else {
        // 先探时长再决定要不要回传；探测失败就不传，不影响登记
        const probed = raw ? await probeDuration(raw) : null
        // ≤20MB 走 multipart 整传；>20MB 自动分片上传（视频大多走这条）
        const prepared = await prepareSubmitFile(raw, VIDEO_BIZ)
        await registerVideo(
          {
            teachInfoId: props.courseId,
            title: f.title.trim(),
            description: f.description,
            sortNo: f.sortNo ?? 0,
            ...(probed != null ? { durationSec: probed } : {}),
          },
          prepared,
        )
      }
      message.success(
        t(existing ? 'coursework.video.editSuccess' : 'coursework.video.uploadSuccess'),
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
    :title="isEdit ? t('coursework.video.editTitle') : t('coursework.video.addTitle')"
    @update:show="emit('update:show', $event)"
  >
    <NForm :model="form" label-placement="top">
      <NFormItem :label="t('coursework.video.title')" required>
        <NInput v-model:value="form.title" maxlength="100" show-count />
      </NFormItem>
      <NFormItem :label="t('coursework.video.description')">
        <NInput v-model:value="form.description" type="textarea" :rows="3" />
      </NFormItem>
      <NFormItem :label="t('coursework.video.sortNo')">
        <NInputNumber v-model:value="form.sortNo" :min="0" :show-button="false" class="full-width" />
      </NFormItem>
      <NFormItem v-if="isEdit" :label="t('coursework.video.playDuration')">
        <NText depth="3" class="form-hint">{{ t('coursework.video.fileNotSelected') }}</NText>
      </NFormItem>
      <NFormItem v-else :label="t('coursework.video.tab')" required>
        <div class="upload-block">
          <NUpload
            v-model:file-list="fileList"
            :accept="bizAccept(VIDEO_BIZ)"
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

<style scoped src="./VideoFormModal.css"></style>

<style>
.coursework-modal {
  width: 640px;
  max-width: 92vw;
}
</style>
