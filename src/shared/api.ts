import { API_BASE_URL } from '@/config'
import { accessToken, refreshAccessToken } from '@/shared/tokenManager'
import { createDiscreteApi } from 'naive-ui'

const { message } = createDiscreteApi(['message'])

const AUTH_WHITELIST = ['/login', '/login/refresh']

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

  let res = await fetch(`${API_BASE_URL}${url}`, mergedOptions)

  if (res.status === 401 && !url.startsWith('/login/refresh')) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken.value}`
      res = await fetch(`${API_BASE_URL}${url}`, {
        ...mergedOptions,
        headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
      })
    } else {
      window.location.replace('/login')
      throw new Error('Session expired')
    }
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body}`)
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
