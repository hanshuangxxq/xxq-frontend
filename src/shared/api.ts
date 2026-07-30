import { API_BASE_URL } from '@/config'
import { accessToken, refreshAccessToken } from '@/shared/tokenManager'
import { createDiscreteApi } from 'naive-ui'

const { message } = createDiscreteApi(['message'])

const AUTH_WHITELIST = ['/login', '/login/refresh']

/** 网络层错误(后端不可达、DNS 失败、CORS、超时等),区别于认证失败与业务错误 */
export class ApiNetworkError extends Error {
  readonly isNetworkError = true
  constructor(message: string) {
    super(message)
    this.name = 'ApiNetworkError'
  }
}

/** HTTP 状态码错误(4xx/5xx),携带状态码供调用方区分认证失败与服务器暂时错误 */
export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}

  const isFormData = options?.body instanceof FormData
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  if (accessToken.value && !AUTH_WHITELIST.includes(url.split('?')[0]!)) {
    headers['Authorization'] = `Bearer ${accessToken.value}`
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  }

  const doFetch = (opts: RequestInit): Promise<Response> =>
    fetch(`${API_BASE_URL}${url}`, opts).catch((e) => {
      throw new ApiNetworkError(e instanceof Error ? e.message : '网络请求失败')
    })

  let res = await doFetch(mergedOptions)

  if (res.status === 401 && !url.startsWith('/login/refresh')) {
    const outcome = await refreshAccessToken()
    if (outcome === 'success') {
      headers['Authorization'] = `Bearer ${accessToken.value}`
      res = await doFetch({
        ...mergedOptions,
        headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
      })
    } else if (outcome === 'network_error') {
      // 后端暂时不可达(如重启中):保留登录态,不跳转登录页
      throw new ApiNetworkError('刷新登录状态失败,请检查网络连接')
    } else {
      window.location.replace('/login')
      throw new Error('Session expired')
    }
  }

  if (!res.ok) {
    const body = await res.text()
    throw new HttpError(res.status, `HTTP ${res.status}: ${body}`)
  }

  const body = (await res.json()) as { code: number; message: string; data: unknown }
  if (body.code !== 200) {
    message.error(body.message || '请求失败')
    throw new Error(body.message || '请求失败')
  }
  return body as T
}

export const api = {
  get<T>(url: string): Promise<T> {
    return request<T>(url)
  },

  post<T>(url: string, data?: unknown): Promise<T> {
    return request<T>(url, {
      method: 'POST',
      ...(data !== undefined && { body: JSON.stringify(data) }),
    })
  },

  postForm<T>(url: string, formData: FormData): Promise<T> {
    return request<T>(url, {
      method: 'POST',
      body: formData,
    })
  },

  put<T>(url: string, data?: unknown): Promise<T> {
    return request<T>(url, {
      method: 'PUT',
      ...(data !== undefined && { body: JSON.stringify(data) }),
    })
  },

  delete<T>(url: string): Promise<T> {
    return request<T>(url, { method: 'DELETE' })
  },
}
