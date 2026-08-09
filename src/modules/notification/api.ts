import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type {
  NotificationResponse,
  NotificationStatus,
  SendNotificationParams,
  UnreadCountData,
} from './types'

export const notificationApi = {
  /** 获取未读数 */
  async getUnreadCount(): Promise<number> {
    const result = await api.get<Result<UnreadCountData>>('/notification/unread-count')
    return result.data.count
  },

  /** 消息列表（按创建时间倒序，分页） */
  async getListPage(
    status?: NotificationStatus,
    page?: number,
    pageSize?: number,
  ): Promise<Result<PageResult<NotificationResponse>>> {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (page != null) params.set('page', String(page))
    if (pageSize != null) params.set('pageSize', String(pageSize))
    const qs = params.toString()
    return api.get(`/notification/list${qs ? `?${qs}` : ''}`)
  },

  /** 标记单条已读 */
  async markRead(id: number): Promise<void> {
    await api.put<Result<null>>(`/notification/${id}/read`)
  },

  /** 标记广播消息已读（广播消息走专用端点） */
  async markBroadcastRead(id: number): Promise<void> {
    await api.put<Result<null>>(`/notification/broadcast/${id}/read`)
  },

  /** 全部已读 */
  async readAll(): Promise<void> {
    await api.put<Result<null>>('/notification/read-all')
  },

  /** 删除单条消息（软删除） */
  async remove(id: number): Promise<void> {
    await api.delete<Result<null>>(`/notification/${id}`)
  },

  /** 发送消息（仅管理员） */
  async send(params: SendNotificationParams): Promise<NotificationResponse> {
    const result = await api.post<Result<NotificationResponse>>('/notification/send', params)
    return result.data
  },
}
