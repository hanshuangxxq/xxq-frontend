import { API_BASE_URL } from '@/config'
import { accessToken, refreshAccessToken } from '@/shared/tokenManager'

const AUTH_WHITELIST = ['/login', '/register', '/login/refresh']

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

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

  return res.json() as Promise<T>
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
