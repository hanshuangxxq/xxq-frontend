import { API_BASE_URL } from '@/config'
import { accessToken, refreshAccessToken } from '@/shared/tokenManager'
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

export interface RequestOptions {
  /** 为 true 时错误消息不在 api 层弹出,由调用方自行处理 */
  silent?: boolean
}

async function request<T>(url: string, options?: RequestInit & RequestOptions): Promise<T> {
  const { silent, ...init } = options ?? {}
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
}

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
}
