import { ref } from 'vue'
import { defineStore } from 'pinia'
import { accessToken, refreshAccessToken } from '@/shared/tokenManager'
import { notificationApi } from '@/modules/notification/api'
import { buildNotificationWsUrl, NotificationSocket } from '@/modules/notification/ws'
import type { NotificationFilter, NotificationResponse } from '@/modules/notification/types'

export type NewNotificationHandler = (notification: NotificationResponse) => void

export const useNotificationStore = defineStore('notification', () => {
  const unreadCount = ref(0)
  const notifications = ref<NotificationResponse[]>([])
  const connected = ref(false)
  const showPanel = ref(false)
  const activeStatus = ref<NotificationFilter>('all')
  const loading = ref(false)
  const page = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const pages = ref(0)

  let socket: NotificationSocket | null = null
  let toastHandler: NewNotificationHandler | null = null

  function setToastHandler(handler: NewNotificationHandler | null): void {
    toastHandler = handler
  }

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

  function disconnect(): void {
    socket?.disconnect()
    socket = null
    connected.value = false
  }

  async function fetchUnreadCount(): Promise<void> {
    try {
      unreadCount.value = await notificationApi.getUnreadCount()
    } catch {
      // 忽略：WS 会推送未读数
    }
  }

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

  async function setStatus(status: NotificationFilter): Promise<void> {
    activeStatus.value = status
    page.value = 1
    await fetchList()
  }

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

  async function readAll(): Promise<void> {
    await notificationApi.readAll()
    notifications.value.forEach((n) => {
      n.isRead = 1
    })
    unreadCount.value = 0
  }

  async function remove(id: number): Promise<void> {
    const target = notifications.value.find((n) => n.id === id)
    await notificationApi.remove(id)
    notifications.value = notifications.value.filter((n) => n.id !== id)
    if (total.value > 0) total.value -= 1
    if (target && target.isRead === 0 && unreadCount.value > 0) {
      unreadCount.value -= 1
    }
  }

  function openPanel(): void {
    showPanel.value = true
    page.value = 1
    void fetchList()
  }

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
