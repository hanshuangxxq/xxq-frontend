<script setup lang="ts">
/**
 * PDF 懒加载查看器:pdf.js 直连 GET /file/preview,Range 分段按需拉取(README-API §11.6)。
 *
 * - 鉴权走 httpHeaders(iframe/<img> 无法带 Bearer 头,这是 PDF 能吃 Range 的唯一路径);
 *   pdf.js 内部 fetch 后端是本组件契约的一部分(后端文档指定对接方式),不属于绕过 api 层;
 * - rangeChunkSize 2MB:pdf.js 默认 64KB/段太碎,会撞 /api/file/** 600 次/分钟限流桶
 *   (后端 FileController 注释与 §11.6.3 同口径);
 * - disableAutoFetch:true —— 只拉「看过的页」,不后台预取整个文件,大 PDF 首屏零整传;
 * - cMapUrl/standardFontDataUrl/wasmUrl/iccUrl 指向 public/pdfjs/(CJK cmap、标准字体、
 *   jbig2/jpx 与 quickjs-eval 的 wasm 按需回源);v6 已无 eval 路径(改用 quickjs wasm),
 *   与 CSP 的 wasm-unsafe-eval 相容,无需 unsafe-eval;
 * - accessToken 只有 30 分钟,翻页中途过期时 Range 请求会 401 且无法走 api 管线的刷新重试
 *   —— 渲染失败统一上抛 error,由弹窗落「请下载」兜底(关掉重开即恢复);
 * - 渲染互斥:同一 canvas 不允许两个 render 并发(pdf.js 内部 WeakSet 拦截),
 *   翻页/缩放前必须先取消并等待上一个 RenderTask 收尾。
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NSpace, NText } from 'naive-ui'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { accessToken } from '@/shared/tokenManager'
import { PDF_RANGE_CHUNK_SIZE } from '../preview'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const props = defineProps<{ url: string }>()

const emit = defineEmits<{
  rendered: []
  error: [e: unknown]
}>()

const { t } = useI18n()

const wrapEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const pageNum = ref(1)
const pageCount = ref(0)
/** 相对「适配宽度」的缩放倍率 */
const zoom = ref(1)
/** 单页渲染进行中(翻页/缩放时禁用工具栏,避免连点触发并发 render) */
const rendering = ref(false)

let doc: pdfjsLib.PDFDocumentProxy | null = null
let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null
let renderTask: pdfjsLib.RenderTask | null = null

watch(
  () => props.url,
  (url) => {
    if (url) void load(url)
  },
  { immediate: true },
)

onBeforeUnmount(() => void destroy())

async function load(url: string): Promise<void> {
  await destroy()
  const token = accessToken.value
  const task = pdfjsLib.getDocument({
    url,
    httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    rangeChunkSize: PDF_RANGE_CHUNK_SIZE,
    // 懒加载核心:不后台预取整文件,只按渲染需要分段拉取
    disableAutoFetch: true,
    disableStream: false,
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    wasmUrl: '/pdfjs/wasm/',
    iccUrl: '/pdfjs/iccs/',
  })
  loadingTask = task
  try {
    doc = await task.promise
    pageCount.value = doc.numPages
    pageNum.value = 1
    zoom.value = 1
    await nextTick()
    await renderCurrentPage()
    emit('rendered')
  } catch (e) {
    if (!(e instanceof pdfjsLib.RenderingCancelledException)) {
      emit('error', e)
    }
  }
}

async function destroy(): Promise<void> {
  if (renderTask) {
    renderTask.cancel()
    try {
      await renderTask.promise
    } catch {
      // 取消是预期路径
    }
    renderTask = null
  }
  const task = loadingTask
  loadingTask = null
  doc = null
  pageCount.value = 0
  pageNum.value = 1
  if (task) await task.destroy()
}

async function renderCurrentPage(): Promise<void> {
  const d = doc
  const canvas = canvasEl.value
  if (!d || !canvas) return
  // 先取消并等上一个渲染收尾:同一 canvas 并发 render 会被 pdf.js 直接抛错
  if (renderTask) {
    renderTask.cancel()
    try {
      await renderTask.promise
    } catch {
      // RenderingCancelledException 是翻页的正常路径
    }
    renderTask = null
  }
  rendering.value = true
  try {
    const page = await d.getPage(pageNum.value)
    const baseViewport = page.getViewport({ scale: 1 })
    const wrapWidth = wrapEl.value?.clientWidth || 800
    const viewport = page.getViewport({
      scale: ((wrapWidth - 32) / baseViewport.width) * zoom.value,
    })
    // 手动按 DPR 放大画布保证清晰度(pdf.js 核心库不替你管画布尺寸)
    const outputScale = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = Math.floor(viewport.width * outputScale)
    canvas.height = Math.floor(viewport.height * outputScale)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`
    const task = page.render({
      canvas,
      viewport,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
    })
    renderTask = task
    await task.promise
  } catch (e) {
    if (!(e instanceof pdfjsLib.RenderingCancelledException)) {
      emit('error', e)
    }
  } finally {
    rendering.value = false
  }
}

function prevPage(): void {
  if (pageNum.value > 1) {
    pageNum.value--
    void renderCurrentPage()
  }
}

function nextPage(): void {
  if (pageNum.value < pageCount.value) {
    pageNum.value++
    void renderCurrentPage()
  }
}

function zoomIn(): void {
  zoom.value = Math.min(zoom.value + 0.25, 3)
  void renderCurrentPage()
}

function zoomOut(): void {
  zoom.value = Math.max(zoom.value - 0.25, 0.5)
  void renderCurrentPage()
}
</script>

<template>
  <div class="pdf-viewer">
    <div class="pdf-toolbar">
      <NSpace :size="4" align="center">
        <NButton size="tiny" quaternary :disabled="rendering || pageNum <= 1" @click="prevPage">
          {{ t('file.preview.prevPage') }}
        </NButton>
        <NText depth="3" class="pdf-page-indicator">{{ pageNum }} / {{ pageCount }}</NText>
        <NButton
          size="tiny"
          quaternary
          :disabled="rendering || pageNum >= pageCount"
          @click="nextPage"
        >
          {{ t('file.preview.nextPage') }}
        </NButton>
      </NSpace>
      <NSpace :size="4" align="center">
        <NButton size="tiny" quaternary :disabled="rendering" @click="zoomOut">
          {{ t('file.preview.zoomOut') }}
        </NButton>
        <NText depth="3" class="pdf-page-indicator">{{ Math.round(zoom * 100) }}%</NText>
        <NButton size="tiny" quaternary :disabled="rendering" @click="zoomIn">
          {{ t('file.preview.zoomIn') }}
        </NButton>
      </NSpace>
    </div>
    <div ref="wrapEl" class="pdf-canvas-wrap">
      <canvas ref="canvasEl" class="pdf-canvas"></canvas>
    </div>
  </div>
</template>

<style scoped src="./PdfRangeViewer.css"></style>
