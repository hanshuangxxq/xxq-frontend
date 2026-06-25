import { API_BASE_URL } from '@/config'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

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

  post<T>(url: string, data: unknown): Promise<T> {
    return request<T>(url, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  put<T>(url: string, data: unknown): Promise<T> {
    return request<T>(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  delete<T>(url: string): Promise<T> {
    return request<T>(url, { method: 'DELETE' })
  },
}
