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
  constructor(message: string) {
    super(message)
    this.name = 'BusinessError'
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
      throw new BusinessError(text)
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
