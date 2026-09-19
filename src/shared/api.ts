import { API_BASE_URL } from '@/config'
import { accessToken, refreshAccessToken } from '@/shared/tokenManager'
import { beginManagedRequest, endManagedRequest } from '@/shared/loading'
import { message } from '@/shared/discrete'
import i18n from '@/i18n'

const AUTH_WHITELIST = ['/login', '/login/refresh']

/** 网络层错误(后端不可达、DNS 失败、CORS、超时等),区别于认证失败与业务错误 */
export class ApiNetworkError extends Error {
  readonly isNetworkError = true
  /** 错误消息已在 api 层统一弹出,页面 catch 到后不应再次提示 */
  readonly reported = true
  constructor(message: string) {
    super(message)
    this.name = 'ApiNetworkError'
  }
}

/** HTTP 状态码错误(4xx/5xx),携带状态码供调用方区分认证失败与服务器暂时错误 */
export class HttpError extends Error {
  readonly status: number
  readonly reported = true
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

/** 业务错误(后端返回 code !== 200),消息已在 api 层弹出 */
export class BusinessError extends Error {
  readonly reported = true
  /**
   * 后端业务码。业务异常是 HTTP 200 + body.code,所以 HTTP status 给不出任何信息,
   * 这是区分 429(限流)/409(已合并)/404(会话过期)的唯一途径(接口文档 §2.2)。
   */
  readonly code: number
  constructor(message: string, code = 0) {
    super(message)
    this.name = 'BusinessError'
    this.code = code
  }
}

/** 请求被用户取消(经全局加载指示的取消按钮),静默处理,不弹任何提示 */
export class RequestCancelledError extends Error {
  readonly reported = true
  readonly cancelled = true
  constructor() {
    super(i18n.global.t('common.cancelled'))
    this.name = 'RequestCancelledError'
  }
}

/**
 * 错误是否已在 api 层弹出过提示(含用户取消)。
 * 页面 catch 后应先判断,避免重复弹出:
 * `catch (e) { if (!isReportedError(e)) message.error(...) }`
 */
export function isReportedError(e: unknown): boolean {
  return e instanceof Error && 'reported' in e && (e as { reported: unknown }).reported === true
}

export interface RequestOptions {
  /** 为 true 时错误消息不在 api 层弹出,由调用方自行处理 */
  silent?: boolean
  /** 为 false 时不注册到全局加载管理(不显示加载指示、不可取消;轮询、头像等后台请求使用) */
  loading?: boolean
  /** 附加请求头(如登录请求携带的客户端私网 IP) */
  headers?: Record<string, string>
}

// ---- 统一请求管线:请求头 -> fetch -> 401 刷新重试,JSON 与二进制共用 ----

/**
 * 发送请求并处理认证(唯一允许调用 fetch 访问后端的地方)。
 * 返回最终 Response;网络错误、取消、会话过期在此统一处理。
 */
async function sendWithAuth(url: string, init: RequestInit, silent: boolean): Promise<Response> {
  const headers: Record<string, string> = {}

  const isFormData = init.body instanceof FormData
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  if (accessToken.value && !AUTH_WHITELIST.includes(url.split('?')[0]!)) {
    headers['Authorization'] = `Bearer ${accessToken.value}`
  }

  const mergedOptions: RequestInit = {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  }

  const doFetch = (opts: RequestInit): Promise<Response> =>
    fetch(`${API_BASE_URL}${url}`, opts).catch((e) => {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new RequestCancelledError()
      }
      if (!silent) message.error(i18n.global.t('common.error.network'))
      throw new ApiNetworkError(e instanceof Error ? e.message : String(e))
    })

  let res = await doFetch(mergedOptions)

  if (res.status === 401 && !url.startsWith('/login/refresh')) {
    const outcome = await refreshAccessToken()
    if (outcome === 'success') {
      headers['Authorization'] = `Bearer ${accessToken.value}`
      res = await doFetch({
        ...mergedOptions,
        headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
      })
    } else if (outcome === 'network_error') {
      // 后端暂时不可达(如重启中):保留登录态,不跳转登录页
      if (!silent) message.error(i18n.global.t('common.error.network'))
      throw new ApiNetworkError('刷新登录状态失败,请检查网络连接')
    } else {
      window.location.replace('/login')
      throw new Error('Session expired')
    }
  }

  return res
}

/** 解析 Content-Disposition 中的文件名(优先 RFC 5987 UTF-8 形式) */
function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8?.[1]) return decodeURIComponent(utf8[1])
  const plain = disposition.match(/filename="?([^";]+)"?/i)
  return plain?.[1] ?? null
}

/**
 * 将请求注册到全局加载管理器(自动显示/隐藏加载指示、支持用户取消),
 * 并在结束后注销。loading 为 false 或调用方自带 AbortSignal 时不注册。
 */
async function managed<T>(loading: boolean, init: RequestInit, task: () => Promise<T>): Promise<T> {
  if (!loading || init.signal) return task()
  const controller = new AbortController()
  init.signal = controller.signal
  beginManagedRequest(controller)
  try {
    return await task()
  } finally {
    endManagedRequest(controller)
  }
}

/** JSON 请求:Result 包装,业务错误(code !== 200)统一弹出并抛 BusinessError */
async function request<T>(url: string, options?: RequestInit & RequestOptions): Promise<T> {
  const { silent = false, loading = true, ...init } = options ?? {}

  return managed(loading, init, async () => {
    const res = await sendWithAuth(url, init, silent)

    if (!res.ok) {
      if (!silent) message.error(i18n.global.t('common.error.server', { status: res.status }))
      const body = await res.text()
      throw new HttpError(res.status, `HTTP ${res.status}: ${body}`)
    }

    const body = (await res.json()) as { code: number; message: string; data: unknown }
    if (body.code !== 200) {
      const text = body.message || i18n.global.t('common.error.requestFailed')
      if (!silent) message.error(text)
      throw new BusinessError(text, body.code)
    }
    return body as T
  })
}

/** 二进制请求:文件流等非 Result 响应;错误时尝试读取后端 JSON 错误消息 */
async function requestBlob(
  url: string,
  options?: RequestOptions,
): Promise<{ blob: Blob; filename: string | null }> {
  const { silent = false, loading = true, headers } = options ?? {}
  const init: RequestInit = { headers }

  return managed(loading, init, async () => {
    const res = await sendWithAuth(url, init, silent)

    if (!res.ok) {
      let text = ''
      try {
        const body = (await res.json()) as { message?: string }
        text = body.message ?? ''
      } catch {
        // 非 JSON 错误体,使用通用提示
      }
      const msg = text || i18n.global.t('common.error.server', { status: res.status })
      if (!silent) message.error(msg)
      throw new HttpError(res.status, msg)
    }

    return {
      blob: await res.blob(),
      filename: parseFilename(res.headers.get('Content-Disposition')),
    }
  })
}

// ---- 二进制上传管线:全项目唯一允许使用 XMLHttpRequest 的地方 ----

/**
 * 二进制上传请求选项。分片上传必须能报告进度,而 fetch 没有上传进度事件,
 * 故上传单独走 XHR;鉴权、401 刷新重试、错误分类与 JSON 管线保持同一语义。
 */
export interface BinaryRequestOptions {
  /** 附加请求头(分片场景:X-Chunk-SHA256) */
  headers?: Record<string, string>
  /** 上传进度回调;仅传输阶段触发,lengthComputable 为 false 时不回调 */
  onProgress?: (loaded: number, total: number) => void
  /** 取消信号;abort 时以 RequestCancelledError 拒绝 */
  signal?: AbortSignal
  /** 为 true 时错误消息不在 api 层弹出(上传引擎自行决定重试时机与最终提示) */
  silent?: boolean
}

/** 单次 XHR 发送结果。不抛错,由调用方按 HTTP status 与 body 共同判定 */
interface XhrOutcome {
  status: number
  text: string
}

/**
 * 发送一次裸二进制 PUT,不重试(401 刷新后的重试由 putBinary 负责)。
 * 请求体是 Blob 而非 FormData:分片契约要求 Content-Type: application/octet-stream,
 * 且不经 multipart 解析(接口文档 §3.5)。
 */
function xhrSend(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  options: BinaryRequestOptions,
): Promise<XhrOutcome> {
  const { onProgress, signal } = options

  return new Promise<XhrOutcome>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', `${API_BASE_URL}${url}`)
    xhr.responseType = 'text'
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value)
    }

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(e.loaded, e.total)
      }
    }

    // 已中止的信号不会再触发 abort 事件,必须先判一次,否则请求会照常发出
    if (signal?.aborted) {
      reject(new RequestCancelledError())
      return
    }

    const onAbort = () => xhr.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    const cleanup = () => signal?.removeEventListener('abort', onAbort)

    xhr.onload = () => {
      cleanup()
      resolve({ status: xhr.status, text: xhr.responseText })
    }
    xhr.onerror = () => {
      cleanup()
      reject(new ApiNetworkError('上传请求失败'))
    }
    xhr.onabort = () => {
      cleanup()
      reject(new RequestCancelledError())
    }

    xhr.send(body)
  })
}

/** 容错解析 Result 包装;响应不是 JSON(网关 HTML 错误页等)时返回 null */
function parseResult(text: string): { code: number; message?: string; data: unknown } | null {
  try {
    const parsed = JSON.parse(text) as { code?: unknown; message?: unknown }
    return typeof parsed.code === 'number'
      ? (parsed as { code: number; message?: string; data: unknown })
      : null
  } catch {
    return null
  }
}

/**
 * PUT 裸二进制体并解包 Result<T>。成功**必须同时满足 HTTP 2xx 与 body.code === 200**
 * —— 业务异常同样是 HTTP 200,只看 HTTP status 会把失败当成功(接口文档 §2.2、§10)。
 *
 * accessToken 只有 30 分钟,大文件传输中途必然过期:401 时刷新后**只重试这一个请求**,
 * 不是整个文件(接口文档 §2.1)。Blob 可重复读取,重发同一 body 安全,且同序号分片重传
 * 在服务端是幂等覆盖。
 *
 * 与 JSON 管线不同,此函数**不接入全局加载管理**:分片上传的进度由上传面板自行展示,
 * 且「取消全局加载」不应中断用户主动发起的上传。
 */
async function putBinary<T>(
  url: string,
  body: Blob,
  options: BinaryRequestOptions = {},
): Promise<T> {
  const { headers = {}, silent = false } = options
  // 每次发送都重建请求头,保证 401 刷新后用的是新 token
  const buildHeaders = (): Record<string, string> =>
    accessToken.value
      ? { ...headers, Authorization: `Bearer ${accessToken.value}` }
      : { ...headers }

  let outcome = await xhrSend(url, body, buildHeaders(), options)

  if (outcome.status === 401) {
    const refreshOutcome = await refreshAccessToken()
    if (refreshOutcome === 'success') {
      outcome = await xhrSend(url, body, buildHeaders(), options)
    } else if (refreshOutcome === 'network_error') {
      // 后端暂时不可达(如重启中):保留登录态,不跳转登录页
      if (!silent) message.error(i18n.global.t('common.error.network'))
      throw new ApiNetworkError('刷新登录状态失败,请检查网络连接')
    } else {
      window.location.replace('/login')
      throw new Error('Session expired')
    }
  }

  const parsed = parseResult(outcome.text)

  if (outcome.status < 200 || outcome.status >= 300) {
    const text = parsed?.message || i18n.global.t('common.error.server', { status: outcome.status })
    if (!silent) message.error(text)
    throw new HttpError(outcome.status, text)
  }

  if (parsed === null || parsed.code !== 200) {
    const text = parsed?.message || i18n.global.t('common.error.requestFailed')
    if (!silent) message.error(text)
    throw new BusinessError(text, parsed?.code ?? 0)
  }

  return parsed as T
}

/**
 * 全项目唯一的后端访问入口。任何模块需要后端数据都必须经由这里,
 * 不得直接调用 fetch 访问后端(静态资源、外部 URL 除外)。
 * 所有请求自动接入全局加载指示与取消,页面无需手写加载状态。
 */
export const api = {
  get<T>(url: string, options?: RequestOptions): Promise<T> {
    return request<T>(url, options)
  },

  post<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(url, {
      ...options,
      method: 'POST',
      ...(data !== undefined && { body: JSON.stringify(data) }),
    })
  },

  postForm<T>(url: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return request<T>(url, { ...options, method: 'POST', body: formData })
  },

  put<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(url, {
      ...options,
      method: 'PUT',
      ...(data !== undefined && { body: JSON.stringify(data) }),
    })
  },

  delete<T>(url: string, options?: RequestOptions): Promise<T> {
    return request<T>(url, { ...options, method: 'DELETE' })
  },

  /**
   * PUT 裸二进制体(application/octet-stream),带上传进度与 401 刷新重试。
   * 分片上传专用 —— 普通 JSON 请求请用 put,文件整传请用 postForm。
   */
  putBinary<T>(url: string, body: Blob, options?: BinaryRequestOptions): Promise<T> {
    return putBinary<T>(url, body, options)
  },

  /** 获取二进制数据(如头像图片),与 JSON 接口共用认证/刷新/错误处理管线 */
  async getBlob(url: string, options?: RequestOptions): Promise<Blob> {
    const { blob } = await requestBlob(url, options)
    return blob
  },

  /** 下载后端文件并在浏览器中保存;文件名取响应头 Content-Disposition,缺省用 fallbackName */
  async download(url: string, options?: RequestOptions & { fallbackName?: string }): Promise<void> {
    const { fallbackName = 'download', ...rest } = options ?? {}
    const { blob, filename } = await requestBlob(url, rest)

    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename ?? fallbackName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
  },
}
