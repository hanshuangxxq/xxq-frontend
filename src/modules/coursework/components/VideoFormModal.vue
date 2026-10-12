<script setup lang="ts">
/**
 * 教师登记/编辑教学视频弹窗。
 *
 * 契约要点(章节树协议 §3.8/§3.9):
 * - **视频必须挂节**:登记时 `data.nodeId` 必填,授课组由节反推(旧版的 teachInfoId 已下线);
 *   编辑时 nodeId 非空即**改挂**,限同一授课组、且不支持移回公共区 ——
 *   所以已挂节的视频,「所属小节」只能改选、不能清空(公共区视频则可以留空,表示不归档);
 * - **服务端不解码视频,`durationSec` 由前端解析后回传**。这里用 `<video>` 元素的
 *   loadedmetadata 拿时长(协议明确允许的做法),探测失败就不传该字段 ——
 *   列表里只是没有时长可显示,不阻塞登记;
 * - 视频文件**不可替换**,换视频 = 删除后重新登记,所以编辑模式只改元数据与挂载点、不给选文件入口。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NCascader,
  NUpload,
  NButton,
  NSpace,
  NText,
  useMessage,
  type CascaderOption,
  type UploadFileInfo,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { useLoading } from '@/shared/composables/useLoading'
import { prepareSubmitFile } from '@/modules/file/submit'
import { bizAccept, validateFileForBiz } from '@/modules/file/validate'
import { registerVideo, updateVideo } from '../api'
import { VIDEO_BIZ } from '../constants'
import type { ChapterView, VideoView } from '../types'

/** 时长探测的超时上限(见 probeDuration):超时即放弃回传 durationSec */
const PROBE_TIMEOUT_MS = 10_000

const props = defineProps<{
  show: boolean
  /** 当前章节树里的章(含节),用来给「所属小节」级联出可挂载的目标 */
  chapters: ChapterView[]
  /** null = 登记新视频；非 null = 编辑该视频的元数据 / 挂载点 */
  video: VideoView | null
  /** 登记时的预选小节(从某个节点「上传视频」进来) */
  defaultNodeId?: number | null
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
  /** 目标节 id;null = 不指定(仅编辑公共区视频时允许) */
  nodeId: null as number | null,
})
const fileList = ref<UploadFileInfo[]>([])
const { loading: saving, withLoading: withSaving } = useLoading()

/**
 * 「所属小节」级联项:章为父、节为叶。`leaf-only` 下父节点不可选,
 * 空章(还没有节)显式 disabled 而不是留一个点不动的展开箭头。
 */
const sectionOptions = computed<CascaderOption[]>(() =>
  props.chapters.map((chapter) => ({
    value: chapter.id,
    label: chapter.title,
    disabled: chapter.sections.length === 0,
    children: chapter.sections.map((section) => ({ value: section.id, label: section.title })),
  })),
)

/** 整棵树一个节都没有时,级联无从选起 —— 提示先去建章建节 */
const hasSection = computed(() => props.chapters.some((chapter) => chapter.sections.length > 0))

/** 已挂节的视频不许脱离节(后端也不支持移回公共区),故此时该字段必填 */
const nodeRequired = computed(() => !isEdit.value || props.video?.nodeId != null)

watch(
  () => [props.show, props.video] as const,
  ([show]) => {
    if (!show) return
    const v = props.video
    form.value = {
      title: v?.title ?? '',
      description: v?.description ?? '',
      nodeId: v?.nodeId ?? props.defaultNodeId ?? null,
    }
    fileList.value = []
  },
  { immediate: true },
)

/** 级联回传的是 string | number | null(选项 value 的联合类型),收成 number 再进表单 */
function handleNodeChange(value: string | number | null) {
  form.value.nodeId = typeof value === 'number' ? value : null
}

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

function reportSaved(successKey: string) {
  message.success(t(successKey))
  emit('update:show', false)
  emit('saved')
}

function notifyFail(e: unknown): void {
  if (!isReportedError(e)) {
    message.error((e as Error).message || t('coursework.common.operationFail'))
  }
}

/** 登记:nodeId 与文件都在 handleSave 里校验过,这里收的是已收窄的实参 */
function createVideo(nodeId: number, raw: File) {
  return withSaving(async () => {
    try {
      // 先探时长再决定要不要回传；探测失败就不传，不影响登记
      const probed = await probeDuration(raw)
      // ≤20MB 走 multipart 整传；>20MB 自动分片上传（视频大多走这条）
      const prepared = await prepareSubmitFile(raw, VIDEO_BIZ)
      await registerVideo(
        {
          nodeId,
          title: form.value.title.trim(),
          description: form.value.description,
          ...(probed != null ? { durationSec: probed } : {}),
        },
        prepared,
      )
      reportSaved('coursework.video.uploadSuccess')
    } catch (e) {
      notifyFail(e)
    }
  })
}

/** 编辑:只改元数据与挂载点(nodeId 缺省 = 不改挂) */
function updateExisting(video: VideoView) {
  const nodeId = form.value.nodeId
  return withSaving(async () => {
    try {
      await updateVideo(video.id, {
        title: form.value.title.trim(),
        description: form.value.description,
        ...(nodeId != null ? { nodeId } : {}),
      })
      reportSaved('coursework.video.editSuccess')
    } catch (e) {
      notifyFail(e)
    }
  })
}

function handleSave() {
  if (!form.value.title.trim()) {
    message.warning(t('coursework.video.titleRequired'))
    return
  }
  const existing = props.video
  if (existing) {
    // 已挂节的视频必填小节(预填过且不可清空),这里只兜住「公共区视频选了又清掉」之类的边界
    if (nodeRequired.value && form.value.nodeId == null) {
      message.warning(t('coursework.video.sectionNodeRequired'))
      return
    }
    return updateExisting(existing)
  }

  const nodeId = form.value.nodeId
  const raw = fileList.value[0]?.file ?? null
  if (nodeId == null) {
    message.warning(t('coursework.video.sectionNodeRequired'))
    return
  }
  // 新建必须给文件（file part 或 filePath 二选一），否则后端 400
  if (!raw) {
    message.warning(t('coursework.video.fileRequired'))
    return
  }
  const err = validateFileForBiz(raw, VIDEO_BIZ)
  if (err) {
    message.warning(t(`file.error.${err}`))
    return
  }
  return createVideo(nodeId, raw)
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
      <NFormItem :label="t('coursework.video.sectionNode')" :required="nodeRequired">
        <div class="upload-block">
          <NCascader
            class="full-width"
            leaf-only
            :clearable="false"
            :value="form.nodeId"
            :options="sectionOptions"
            :disabled="!hasSection"
            :placeholder="t('coursework.video.sectionNodePlaceholder')"
            @update:value="handleNodeChange"
          />
          <NText v-if="!hasSection" depth="3" class="form-hint">
            {{ t('coursework.video.noSectionTip') }}
          </NText>
        </div>
      </NFormItem>
      <NFormItem v-if="isEdit" :label="t('coursework.video.playDuration')">
        <NText depth="3" class="form-hint">{{ t('coursework.video.fileNotSelected') }}</NText>
      </NFormItem>
      <NFormItem v-else :label="t('coursework.video.file')" required>
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
