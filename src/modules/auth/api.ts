import { API_BASE_URL } from '@/config'
import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { LoginParams, RegisterParams, UpdateProfileParams, UserProfile, UserSession } from './types'

export const authApi = {
  async login(params: LoginParams): Promise<UserSession> {
    const result = await api.post<Result<UserSession>>('/login', params)
    if (result.code !== 200) throw new Error(result.message)
    return result.data
  },

  async register(params: RegisterParams): Promise<boolean> {
    const result = await api.post<Result<boolean>>('/register', params)
    if (result.code !== 200) throw new Error(result.message)
    return result.data
  },

  async logout(tokenId: string): Promise<boolean> {
    const result = await api.post<Result<boolean>>(
      `/login/logout?tokenId=${encodeURIComponent(tokenId)}`,
    )
    if (result.code !== 200) throw new Error(result.message)
    return result.data
  },

  async refresh(refreshToken: string): Promise<void> {
    await api.post(`/login/refresh?refreshToken=${encodeURIComponent(refreshToken)}`)
  },

  async getProfile(userId: number): Promise<UserProfile> {
    const result = await api.get<Result<UserProfile>>(
      `/user/profile?userId=${encodeURIComponent(userId)}`,
    )
    if (result.code !== 200) throw new Error(result.message)
    return result.data
  },

  async updateProfile(userId: number, params: UpdateProfileParams): Promise<boolean> {
    const result = await api.put<Result<boolean>>(
      `/user/profile?userId=${encodeURIComponent(userId)}`,
      params,
    )
    if (result.code !== 200) throw new Error(result.message)
    return result.data
  },

  async uploadAvatar(userId: number, file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(
      `${API_BASE_URL}/user/avatar/upload?userId=${encodeURIComponent(userId)}`,
      { method: 'POST', body: formData },
    )

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HTTP ${res.status}: ${body}`)
    }

    const result = (await res.json()) as Result<string>
    if (result.code !== 200) throw new Error(result.message)
    return result.data
  },
}
