/**
 * 在线预览的类型分流(FilePreviewModal 用),契约见 README-API §11.6。
 *
 * 决策顺序(打开弹窗时):
 * 1. 先调 GET /file/preview/info 拿 { size, contentType, previewable }(零内容传输);
 * 2. previewable=true(pdf/jpg/png) → 走 GET /file/preview(inline + Range):
 *    - pdf 交给 pdf.js 分段懒加载(首屏不整传,immutable 缓存二次零传输);
 *    - 图片无法带 Bearer 头,由 api.getBlob 拉 blob 转 objectURL(整载,图片无分段意义);
 *    - mp4 理论上在白名单,但课业各 biz 不放行 mp4(视频有独立 WS 播放器),落 unsupported;
 * 3. previewable=false → 按扩展名看是否 Office:docx/xls/xlsx/ppt/pptx 保留
 *    vue-files-preview 客户端渲染(blob 走 POST /file/download 整取 —— zip 系格式必须
 *    整文件才能解析,天然无法分段);doc/zip/rar 无成熟前端渲染器,落 unsupported 兜底。
 *
 * 库的 tree-shake 注意点不变:preview.const.mjs 静态环引全部子组件,docx/xlsx/ppt
 * 三个渲染器合并为一个大异步 chunk,只在首次预览 Office 文件时加载。
 */

export type PreviewKind = 'pdf' | 'pic' | 'docx' | 'xlsx' | 'ppt' | 'unsupported'

/** 预览目标:存储相对路径 + 展示名(Office 分流与下载落盘名用) */
export interface PreviewFileTarget {
  path: string
  name: string
}

/**
 * 整载型预览(pic/office)的最大字节数:这些路径要把整个 blob 读进内存(office 还要解析),
 * 分片通道允许单文件到 2GB,超限直接落兜底提示下载,避免把页面卡死。
 * pdf 不适用 —— pdf.js 分段懒加载,多大都只看前几页。
 */
export const PREVIEW_SIZE_LIMIT = 50 * 1024 * 1024

/** pdf 超过该体积时提示「将按需加载」(只是提示,不拦截) */
export const PDF_LAZY_HINT_SIZE = 20 * 1024 * 1024

/**
 * pdf.js 的分段粒度(后端 FileController 注释与 README-API §11.6.3 同口径):
 * 默认 64KB/段太碎,会撞 /api/file/** 的 600 次/分钟限流桶,调到 2MB。
 */
export const PDF_RANGE_CHUNK_SIZE = 2 * 1024 * 1024

/** Office 客户端渲染器(vue-files-preview 子组件)对应的扩展名 */
const OFFICE_KIND: Record<string, PreviewKind> = {
  docx: 'docx',
  xls: 'xlsx',
  xlsx: 'xlsx',
  ppt: 'ppt',
  pptx: 'ppt',
}

/** 按展示文件名取小写扩展名(无点返回 '') */
export function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : ''
}

/** previewable=false 时的二级分流:Office 扩展名给客户端渲染器,其余 unsupported */
export function officeKindOf(fileName: string): PreviewKind {
  return OFFICE_KIND[extOf(fileName)] ?? 'unsupported'
}
