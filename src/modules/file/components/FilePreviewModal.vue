<script setup lang="ts">
/**
 * 通用文件在线预览弹窗(file 模块,业务无关,课程/实践等模块都可复用)。
 *
 * 契约与加载策略(README-API §11.6,打开时先调 preview/info 零内容传输地决策):
 * - pdf → PdfRangeViewer:pdf.js 直连 GET /file/preview,Range 分段懒加载,
 *   首屏不整传、内容寻址 immutable 缓存二次打开零传输;
 * - jpg/png → api.getBlob 走 GET /file/preview 拉 blob 转 objectURL
 *   (<img> 无法带 Bearer 头,后端文档指定的对接方式;图片无分段意义);
 * - docx/xls/xlsx/ppt/pptx(previewable=false)→ 保留 vue-files-preview 客户端渲染,
 *   blob 仍走 POST /file/download 整取(zip 系格式必须整文件才能解析,天然无法分段);
 * - doc/zip/rar、mp4(课业 biz 不放行,视频有独立 WS 播放器)、超大整载型文件(>50MB)、
 *   渲染失败 → 兜底 UI:提示 + 下载按钮;
 * - 「下载」优先复用已拉取的 blob 直接保存,没拉过(pdf/兜底)才走 downloadPost;
 * - 不缓存数据:每次打开重新走 info/内容流程,关闭即清空(对象 URL 随关闭 revoke);
 * - 库的 tree-shake 注意点:vue-files-preview 的 preview.const.mjs 静态环引全部子组件,
 *   docx/xlsx/ppt 渲染器合并为一个大异步 chunk,只在首次预览 Office 文件时加载;
 *   pdf.js 与查看器在另一个异步 chunk,只在首次预览 PDF 时加载 —— 两条路径互不进对方首屏。
 */
import { computed, defineAsyncComponent, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NButton, NSpace, NText, useMessage } from 'naive-ui'
import { API_BASE_URL } from '@/config'
import { api, isReportedError, saveBlob } from '@/shared/api'
import { fetchPreviewInfo } from '../api'
import {
  PDF_LAZY_HINT_SIZE,
  PREVIEW_SIZE_LIMIT,
  officeKindOf,
  type PreviewFileTarget,
  type PreviewKind,
} from '../preview'
import { formatBytes } from '@/shared/utils/format'
import 'vue-files-preview/es/style.css'

const PdfRangeViewer = defineAsyncComponent(() => import('./PdfRangeViewer.vue'))

/** Office 客户端渲染器按需分包:只在首次预览对应类型时加载(合并 chunk 见文件头说明) */
const OFFICE_RENDERERS = {
  docx: defineAsyncComponent(
    () => import('vue-files-preview/es/packages/preview/supports/docx-preview/index.mjs'),
  ),
  xlsx: defineAsyncComponent(
    () => import('vue-files-preview/es/packages/preview/supports/xlsx-preview/index.mjs'),
  ),
  ppt: defineAsyncComponent(
    () => import('vue-files-preview/es/packages/preview/supports/ppt-preview/index.mjs'),
  ),
} as const

const props = defineProps<{
  show: boolean
  file: PreviewFileTarget | null
}>()

const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const { t } = useI18n()
const message = useMessage()

/** 决策出的预览路径;null 表示还在等 preview/info */
const kind = ref<PreviewKind | null>(null)
/** 信息接口给的权威大小(字节),超大拦截与「按需加载」提示用 */
const infoSize = ref(0)
/** office 路径的整文件 blob(pdf 走 Range 没有它;pic 走 objectURL) */
const blob = shallowRef<Blob | null>(null)
/** pic 路径的对象 URL */
const objectUrl = ref('')
/** pdf/pic 路径的 GET /file/preview 地址 */
const previewUrl = ref('')
/** 渲染进行中(info/内容拉取 + 本地解析);子组件 rendered/error 或 img onload 收尾 */
const busy = ref(false)
/** 渲染失败(子组件 error 事件)→ 落兜底 UI */
const renderFailed = ref(false)
/** pdf 大文件「将按需加载」提示(只是提示,不拦截) */
const lazyHint = ref(false)
const downloading = ref(false)

type OfficeKind = 'docx' | 'xlsx' | 'ppt'

function isOfficeKind(k: PreviewKind | null): k is OfficeKind {
  return k === 'docx' || k === 'xlsx' || k === 'ppt'
}

/** office 三选一渲染器;其它 kind 返回 null */
const officeRenderer = computed(() =>
  isOfficeKind(kind.value) ? OFFICE_RENDERERS[kind.value] : null,
)

const showFallback = computed(() => renderFailed.value || kind.value === 'unsupported')

type FallbackReason = 'notSupported' | 'tooLarge' | 'broken'

const fallbackReason = ref<FallbackReason>('notSupported')

function fallbackText(): string {
  return t(`file.preview.${fallbackReason.value}`)
}

watch(
  () => [props.show, props.file] as const,
  ([show, file]) => {
    if (show && file) void open()
    else resetState()
  },
  { immediate: true },
)

function resetState(): void {
  kind.value = null
  infoSize.value = 0
  blob.value = null
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = ''
  previewUrl.value = ''
  busy.value = false
  renderFailed.value = false
  fallbackReason.value = 'notSupported'
  lazyHint.value = false
}

/** GET /file/preview 的地址(pdf.js 直接吃;pic 经 api.getBlob 走统一管线) */
function buildPreviewUrl(path: string, name: string): string {
  return (
    `${API_BASE_URL}/file/preview?filePath=${encodeURIComponent(path)}` +
    `&originalName=${encodeURIComponent(name)}`
  )
}

async function open(): Promise<void> {
  const file = props.file
  if (!file) return
  busy.value = true
  try {
    const res = await fetchPreviewInfo(file.path)
    if (!props.show) return
    const info = res.data
    infoSize.value = info.size

    // 第一步:后端白名单(pdf/jpg/png)走 GET /preview;mp4 虽在名单但课业无此 biz,落兜底
    let k: PreviewKind
    if (info.previewable) {
      if (info.contentType === 'application/pdf') k = 'pdf'
      else if (info.contentType === 'image/jpeg' || info.contentType === 'image/png') k = 'pic'
      else k = 'unsupported'
    } else {
      // 第二步:不可原生渲染的按扩展名给 Office 客户端渲染,其余兜底
      k = officeKindOf(file.name)
    }

    // 整载型路径(pic/office)要做超大拦截;pdf 分段懒加载不适用
    if ((k === 'pic' || isOfficeKind(k)) && info.size > PREVIEW_SIZE_LIMIT) {
      fallbackReason.value = 'tooLarge'
      k = 'unsupported'
    }
    kind.value = k
    lazyHint.value = k === 'pdf' && info.size > PDF_LAZY_HINT_SIZE

    if (k === 'pdf') {
      // pdf.js 自己带 Bearer 头发 Range 请求,这里只给地址
      previewUrl.value = buildPreviewUrl(file.path, file.name)
    } else if (k === 'pic') {
      const res2 = await api.getBlob(buildPreviewUrl(file.path, file.name))
      if (!props.show) return
      objectUrl.value = URL.createObjectURL(res2)
      // <img> onload 收尾 busy
    } else if (isOfficeKind(k)) {
      const res2 = await api.postBlob('/file/download', {
        filePath: file.path,
        originalName: file.name,
      })
      if (!props.show) return
      blob.value = res2.blob
      // 渲染器 rendered/error 事件收尾 busy
    } else {
      busy.value = false
      if (!renderFailed.value) fallbackReason.value = 'notSupported'
    }
  } catch (e) {
    // 网络/业务/取消错误已由 api 层提示;预览打不开就关掉弹窗,与作答弹窗同口径
    if (!isReportedError(e)) {
      message.error((e as Error).message || t('file.preview.loadFail'))
    }
    emit('update:show', false)
  }
}

function handleRendered(): void {
  busy.value = false
}

function handleRenderError(): void {
  busy.value = false
  renderFailed.value = true
  fallbackReason.value = 'broken'
}

async function handleDownload(): Promise<void> {
  const file = props.file
  if (!file || downloading.value) return
  downloading.value = true
  try {
    if (blob.value) {
      // blob 已在手(office),直接保存,不再请求一次
      saveBlob(blob.value, file.name)
    } else {
      await api.downloadPost(
        '/file/download',
        { filePath: file.path, originalName: file.name },
        { fallbackName: file.name },
      )
    }
  } catch (e) {
    if (!isReportedError(e)) {
      message.error((e as Error).message || t('file.preview.downloadFail'))
    }
  } finally {
    downloading.value = false
  }
}

function close(): void {
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="file-preview-modal"
    :title="file?.name ?? t('file.preview.title')"
    @update:show="emit('update:show', $event)"
  >
    <div class="preview-body">
      <div v-if="showFallback" class="preview-fallback">
        <NText depth="3">{{ fallbackText() }}</NText>
        <NButton size="small" :loading="downloading" @click="handleDownload">
          {{ t('file.preview.download') }}
        </NButton>
      </div>
      <template v-else>
        <NText v-if="lazyHint" depth="3" class="preview-lazy-hint">
          {{ t('file.preview.lazyHint', { size: formatBytes(infoSize) }) }}
        </NText>
        <PdfRangeViewer
          v-if="kind === 'pdf' && previewUrl"
          :url="previewUrl"
          @rendered="handleRendered"
          @error="handleRenderError"
        />
        <img
          v-else-if="kind === 'pic' && objectUrl"
          class="preview-image"
          :src="objectUrl"
          :alt="file?.name ?? ''"
          @load="handleRendered"
          @error="handleRenderError"
        />
        <component
          :is="officeRenderer"
          v-else-if="blob && file && officeRenderer"
          :file="blob"
          :name="file.name"
          @rendered="handleRendered"
          @error="handleRenderError"
        />
        <div v-if="busy" class="preview-parsing">
          <NText depth="3">{{ t('file.preview.parsing') }}</NText>
        </div>
      </template>
    </div>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="close">{{ t('file.preview.close') }}</NButton>
        <NButton type="primary" :loading="downloading" @click="handleDownload">
          {{ t('file.preview.download') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped src="./FilePreviewModal.css"></style>

<style>
/* NModal 内容 teleport 到 body,尺寸类必须非 scoped(与 coursework-modal-answer 同款处理) */
.file-preview-modal {
  width: 960px;
  max-width: 96vw;
}
</style>
