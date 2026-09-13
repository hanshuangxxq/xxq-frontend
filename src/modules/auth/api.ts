import { api } from '@/shared/api'
import { clientIpHeaders } from '@/shared/utils/clientIp'
import type { Result } from '@/shared/types'
import type {
  ChangePasswordParams,
  LoginParams,
  RefreshResult,
  UpdateProfileParams,
  UserPreferences,
  UserProfile,
  UserSession,
} from './types'

export const authApi = {
  // ---- 登录与会话 ----

  /** 账号密码登录 POST /login */
  async login(params: LoginParams): Promise<UserSession> {
    // 仅登录请求携带客户端私网 IP,供后端 NAT 场景(同宿舍楼同公网 IP)下的登录限流区分;
    // 登录后的限流/风控由后端按账户维度处理,不再携带该头
    const result = await api.post<Result<UserSession>>('/login', params, {
      headers: await clientIpHeaders(),
    })
    return result.data
  },

  /** 退出登录 POST /login/logout */
  async logout(): Promise<boolean> {
    const result = await api.post<Result<boolean>>('/login/logout')
    return result.data
  },

  /** 用 refreshToken 换取新令牌对 POST /login/refresh;静默请求,失败不弹错误提示 */
  async refresh(refreshToken: string): Promise<RefreshResult> {
    const result = await api.post<Result<RefreshResult>>(
      `/login/refresh?refreshToken=${encodeURIComponent(refreshToken)}`,
      undefined,
      { silent: true },
    )
    return result.data
  },

  // ---- 用户资料 ----

  /** 查询用户完整资料 GET /user/profile */
  async getProfile(userId: number): Promise<UserProfile> {
    const result = await api.get<Result<UserProfile>>(
      `/user/profile?userId=${encodeURIComponent(userId)}`,
    )
    return result.data
  },

  /** 查询用户资料,额外附带当前 tokenId GET /user/profile */
  async getProfileWithToken(userId: number, tokenId: string): Promise<UserProfile> {
    const result = await api.get<Result<UserProfile>>(
      `/user/profile?userId=${encodeURIComponent(userId)}&tokenId=${encodeURIComponent(tokenId)}`,
    )
    return result.data
  },

  /** 更新个人资料 PUT /user/profile */
  async updateProfile(userId: number, params: UpdateProfileParams): Promise<boolean> {
    const result = await api.put<Result<boolean>>(
      `/user/profile?userId=${encodeURIComponent(userId)}`,
      params,
    )
    return result.data
  },

  // ---- 密码与头像 ----

  /** 修改密码 POST /password/change */
  async changePassword(params: ChangePasswordParams): Promise<boolean> {
    const result = await api.post<Result<boolean>>('/password/change', params)
    return result.data
  },

  /** 上传头像(multipart/form-data)POST /user/avatar/upload,返回头像文件名 */
  async uploadAvatar(userId: number, file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const result = await api.postForm<Result<string>>(
      `/user/avatar/upload?userId=${encodeURIComponent(userId)}`,
      formData,
    )
    return result.data
  },

  // ---- 个性化偏好 ----

  /** 读取当前用户全部偏好;从未设置过时后端返回 {}。静默请求,失败不弹错误提示 */
  async getPreferences(): Promise<UserPreferences> {
    const result = await api.get<Result<UserPreferences>>('/preferences/me', { silent: true })
    return result.data
  },

  /** 浅合并更新偏好,只传要改的字段;返回合并后的完整偏好。静默请求,失败不弹错误提示 */
  async updatePreferences(patch: UserPreferences): Promise<UserPreferences> {
    const result = await api.put<Result<UserPreferences>>('/preferences/me', patch, {
      silent: true,
    })
    return result.data
  },
}
