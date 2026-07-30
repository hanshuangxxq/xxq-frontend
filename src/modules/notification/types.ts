/** 消息类型 code（请求推荐传此值），响应中 type 返回中文描述 */
export type NotificationTypeCode = 'SYSTEM' | 'SELECTION' | 'SCHEDULE' | 'COURSE'

/** 消息已读状态筛选：unread 未读 / read 已读 */
export type NotificationStatus = 'unread' | 'read'

/** 面板筛选：全部 / 未读 / 已读 */
export type NotificationFilter = 'all' | NotificationStatus

/** 消息响应（同后端 NotificationResponse） */
export interface NotificationResponse {
  id: number
  userId: number
  /** 消息类型（中文描述，如「系统消息」） */
  type: string
  title: string
  content: string | null
  /** 是否已读：0 未读 / 1 已读 */
  isRead: number
  /** 创建时间 ISO-8601 yyyy-MM-ddTHH:mm:ss */
  createTime: string
}

/** 未读数响应 data */
export interface UnreadCountData {
  count: number
}

/** 发送消息请求（管理员） */
export interface SendNotificationParams {
  userId: number
  /** 传 code（推荐）或中文描述均可 */
  type: NotificationTypeCode | string
  title: string
  content?: string
}

/** WebSocket 服务端推送消息 */
export type WsPushMessage =
  | { type: 'unread_count'; count: number }
  | { type: 'notification'; data: NotificationResponse }
