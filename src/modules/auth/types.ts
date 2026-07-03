/** 用户类型 */
export type UserType = 'teacher' | 'student' | 'dean' | 'department' | 'academic_admin'

/** 登录渠道 */
export type LoginChannel = 'account' | 'wechat' | 'qq' | 'alipay'

/** 账号密码登录参数 */
export interface AccountLoginData {
  account: string
  password: string
}

/** 第三方登录参数 */
export interface ThirdPartyLoginData {
  code: string
}

/** 登录请求参数 */
export interface LoginParams {
  type: LoginChannel
  data: AccountLoginData | ThirdPartyLoginData
}

/** 登录成功后返回的用户会话 */
export interface UserSession {
  userId: number
  userType: UserType
  name: string
  account: string
  avatar: string | null
  role: string | null
  accessToken: string
  refreshToken: string
  loginTime: string
  lastLoginTime: string | null
}

/** Token 刷新响应 */
export interface RefreshResult {
  userId: number
  accessToken: string
  refreshToken: string
}

/** 班级信息 */
export interface ClassNameInfo {
  id: number
  className: string
  college: string
}

/** 用户完整信息 */
export interface UserProfile {
  userId: number
  name: string
  email: string | null
  phone: string | null
  gender: string | null
  avatar: string | null
  description: string | null
  role: string | null
  userType: UserType
  lastLoginTime: string | null
  createTime: string | null
  status: number
  identifier: string | null
  grade: string | null
  major: string | null
  className: ClassNameInfo | null
  enrollmentYear: number | null
  title: string | null
  department: string | null
  position: string | null
}

/** 修改密码请求参数 */
export interface ChangePasswordParams {
  account: string
  oldPassword: string
  newPassword: string
}

/** 修改个人信息请求参数 */
export interface UpdateProfileParams {
  email?: string
  phone?: string
  gender?: string
  avatar?: string
  description?: string
}
