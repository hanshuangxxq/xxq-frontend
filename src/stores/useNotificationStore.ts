import { ref } from 'vue'
import { defineStore } from 'pinia'
import { accessToken, refreshAccessToken } from '@/shared/tokenManager'
import { notificationApi } from '@/modules/notification/api'
import { buildNotificationWsUrl, NotificationSocket } from '@/modules/notification/ws'
import type { NotificationFilter, NotificationResponse } from '@/modules/notification/types'

/** 新通知到达时的回调(用于弹出 toast 提示) */
export type NewNotificationHandler = (notification: NotificationResponse) => void

/**
 * 站内通知 store:维护未读数、通知列表(分页)与 WebSocket 长连接。
 * - 未读数主要由 WS 推送更新,标记已读/删除时本地乐观修正以即时反馈
 * - 列表分页走后端接口;面板打开期间收到匹配筛选的新通知会即时插入列表头部
 * - 连接生命周期由布局层管理:登录后 connect(),登出/卸载时 disconnect()
 */
export const useNotificationStore = defineStore('notification', () => {
  const unreadCount = ref(0)
  const notifications = ref<NotificationResponse[]>([])
  /** WS 连接状态(供界面显示连接指示) */
  const connected = ref(false)
  /** 通知面板是否打开 */
  const showPanel = ref(false)
  /** 当前列表筛选:全部/未读/已读 */
  const activeStatus = ref<NotificationFilter>('all')
  const loading = ref(false)
  const page = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const pages = ref(0)

  let socket: NotificationSocket | null = null
  let toastHandler: NewNotificationHandler | null = null

  /** 注册/注销新通知 toast 回调(由布局层挂载时注册) */
  function setToastHandler(handler: NewNotificationHandler | null): void {
    toastHandler = handler
  }

  /** 建立 WS 连接(幂等:已连接或已创建实例时直接返回) */
  function connect(): void {
    if (!accessToken.value) return
    if (socket) return
    socket = new NotificationSocket({
      getUrl: () => buildNotificationWsUrl(accessToken.value!),
      onOpen: () => {
        connected.value = true
      },
      onClose: () => {
        connected.value = false
      },
      onCount: (count) => {
        unreadCount.value = count
      },
      onNotification: (n) => {
        if (toastHandler) toastHandler(n)
        // 广播消息后端不再单独推送未读数，本地 +1 即时反馈
        if (n.broadcast) unreadCount.value += 1
        // 面板打开且当前筛选匹配（新消息为未读，故「已读」筛选不前置）
        if (showPanel.value && activeStatus.value !== 'read') {
          notifications.value = [n, ...notifications.value]
        }
      },
      shouldReconnect: () => !!accessToken.value,
      refreshToken: () => refreshAccessToken(),
    })
    socket.connect()
  }

  /** 断开 WS 连接并重置连接状态 */
  function disconnect(): void {
    socket?.disconnect()
    socket = null
    connected.value = false
  }

  /** 主动拉取一次未读数(连接建立初期兜底;失败静默,WS 会推送) */
  async function fetchUnreadCount(): Promise<void> {
    try {
      unreadCount.value = await notificationApi.getUnreadCount()
    } catch {
      // 忽略：WS 会推送未读数
    }
  }

  /** 按当前筛选与分页拉取通知列表 */
  async function fetchList(): Promise<void> {
    loading.value = true
    try {
      const status = activeStatus.value === 'all' ? undefined : activeStatus.value
      const res = await notificationApi.getListPage(status, page.value, pageSize.value)
      notifications.value = res.data.records
      total.value = res.data.total
      pages.value = res.data.pages
    } finally {
      loading.value = false
    }
  }

  /** 切换筛选条件并回到第 1 页重新加载 */
  async function setStatus(status: NotificationFilter): Promise<void> {
    activeStatus.value = status
    page.value = 1
    await fetchList()
  }

  /** 跳转到指定页(越界时忽略) */
  async function gotoPage(p: number): Promise<void> {
    if (p < 1 || (pages.value > 0 && p > pages.value)) return
    page.value = p
    await fetchList()
  }

  async function prevPage(): Promise<void> {
    await gotoPage(page.value - 1)
  }

  async function nextPage(): Promise<void> {
    await gotoPage(page.value + 1)
  }

  /** 标记单条已读(广播消息走专用端点);本地乐观更新列表与未读数 */
  async function markRead(id: number): Promise<void> {
    const item = notifications.value.find((n) => n.id === id)
    // 广播消息走专用端点标记已读
    if (item?.broadcast) {
      await notificationApi.markBroadcastRead(id)
    } else {
      await notificationApi.markRead(id)
    }
    if (item) item.isRead = 1
    // 未读数由 WS 推送更新；本地乐观更新以即时反馈
    if (unreadCount.value > 0) unreadCount.value -= 1
  }

  /** 全部标记已读 */
  async function readAll(): Promise<void> {
    await notificationApi.readAll()
    notifications.value.forEach((n) => {
      n.isRead = 1
    })
    unreadCount.value = 0
  }

  /** 删除一条通知;若删除的是未读项则同步扣减未读数 */
  async function remove(id: number): Promise<void> {
    const target = notifications.value.find((n) => n.id === id)
    await notificationApi.remove(id)
    notifications.value = notifications.value.filter((n) => n.id !== id)
    if (total.value > 0) total.value -= 1
    if (target && target.isRead === 0 && unreadCount.value > 0) {
      unreadCount.value -= 1
    }
  }

  /** 打开通知面板并加载第 1 页 */
  function openPanel(): void {
    showPanel.value = true
    page.value = 1
    void fetchList()
  }

  /** 关闭通知面板 */
  function closePanel(): void {
    showPanel.value = false
  }

  return {
    unreadCount,
    notifications,
    connected,
    showPanel,
    activeStatus,
    loading,
    page,
    pageSize,
    total,
    pages,
    setToastHandler,
    connect,
    disconnect,
    fetchUnreadCount,
    fetchList,
    setStatus,
    gotoPage,
    prevPage,
    nextPage,
    markRead,
    readAll,
    remove,
    openPanel,
    closePanel,
  }
})
