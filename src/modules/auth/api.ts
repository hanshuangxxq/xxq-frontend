import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type {
  ChangePasswordParams,
  LoginParams,
  RefreshResult,
  UpdateProfileParams,
  UserProfile,
  UserSession,
} from './types'

export const authApi = {
  async login(params: LoginParams): Promise<UserSession> {
    const result = await api.post<Result<UserSession>>('/login', params)
    return result.data
  },

  async logout(): Promise<boolean> {
    const result = await api.post<Result<boolean>>('/login/logout')
    return result.data
  },

  async refresh(refreshToken: string): Promise<RefreshResult> {
    const result = await api.post<Result<RefreshResult>>(
      `/login/refresh?refreshToken=${encodeURIComponent(refreshToken)}`,
      undefined,
      { silent: true },
    )
    return result.data
  },

  async getProfile(userId: number): Promise<UserProfile> {
    const result = await api.get<Result<UserProfile>>(
      `/user/profile?userId=${encodeURIComponent(userId)}`,
    )
    return result.data
  },

  async getProfileWithToken(userId: number, tokenId: string): Promise<UserProfile> {
    const result = await api.get<Result<UserProfile>>(
      `/user/profile?userId=${encodeURIComponent(userId)}&tokenId=${encodeURIComponent(tokenId)}`,
    )
    return result.data
  },

  async updateProfile(userId: number, params: UpdateProfileParams): Promise<boolean> {
    const result = await api.put<Result<boolean>>(
      `/user/profile?userId=${encodeURIComponent(userId)}`,
      params,
    )
    return result.data
  },

  async changePassword(params: ChangePasswordParams): Promise<boolean> {
    const result = await api.post<Result<boolean>>('/password/change', params)
    return result.data
  },

  async uploadAvatar(userId: number, file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const result = await api.postForm<Result<string>>(
      `/user/avatar/upload?userId=${encodeURIComponent(userId)}`,
      formData,
    )
    return result.data
  },
}
