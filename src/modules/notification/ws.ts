import { API_BASE_URL } from '@/config'
import type { RefreshOutcome } from '@/shared/tokenManager'
import type { NotificationResponse, WsPushMessage } from './types'

export interface NotificationSocketHandlers {
  /** 获取当前 WS 连接 URL（含 token） */
  getUrl: () => string
  onOpen: () => void
  onClose: () => void
  onCount: (count: number) => void
  onNotification: (data: NotificationResponse) => void
  /** 是否还应重连（通常判断是否仍处于登录态） */
  shouldReconnect: () => boolean
  /** 重连前刷新 token:'success' 立即重连,'network_error' 稍后重试,'auth_failed' 停止 */
  refreshToken: () => Promise<RefreshOutcome>
}

const HEARTBEAT_INTERVAL = 30_000
const INITIAL_BACKOFF = 1_000
const MAX_BACKOFF = 30_000

/** 由 API_BASE_URL 推导 WS 基础地址（绝对地址取其 host；相对地址取当前页 origin） */
function resolveWsBaseUrl(): string {
  if (/^https?:\/\//i.test(API_BASE_URL)) {
    const url = new URL(API_BASE_URL)
    return `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`
  }
  const { protocol, host } = window.location
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`
}

/** 构造消息推送 WebSocket 连接 URL */
export function buildNotificationWsUrl(token: string): string {
  return `${resolveWsBaseUrl()}/ws/notification?token=${encodeURIComponent(token)}`
}

/**
 * 消息提醒 WebSocket 客户端。
 * - 建连后服务端立即推送未读数
 * - 每 30s 发送 `ping` 兼作心跳
 * - 断线后指数退避重连，重连前刷新 token（失效则停止）
 */
export class NotificationSocket {
  private ws: WebSocket | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private backoff = INITIAL_BACKOFF
  private manualClose = false
  private readonly handlers: NotificationSocketHandlers

  constructor(handlers: NotificationSocketHandlers) {
    this.handlers = handlers
  }

  connect(): void {
    if (this.ws) return
    this.manualClose = false
    let ws: WebSocket
    try {
      ws = new WebSocket(this.handlers.getUrl())
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.backoff = INITIAL_BACKOFF
      this.handlers.onOpen()
      this.startHeartbeat()
    }

    ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data)
    }

    ws.onerror = () => {
      // 出错后通常会触发 onclose，重连在 onclose 中处理
    }

    ws.onclose = () => {
      this.stopHeartbeat()
      this.ws = null
      this.handlers.onClose()
      if (!this.manualClose) {
        this.scheduleReconnect()
      }
    }
  }

  disconnect(): void {
    this.manualClose = true
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return
    let msg: WsPushMessage
    try {
      msg = JSON.parse(raw) as WsPushMessage
    } catch {
      return
    }
    if (!msg || typeof msg !== 'object') return
    if (msg.type === 'unread_count' && typeof msg.count === 'number') {
      this.handlers.onCount(msg.count)
    } else if (msg.type === 'notification' && msg.data) {
      this.handlers.onNotification(msg.data)
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping')
      }
    }, HEARTBEAT_INTERVAL)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    if (!this.handlers.shouldReconnect()) return
    const delay = this.backoff
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.reconnect()
    }, delay)
  }

  private async reconnect(): Promise<void> {
    if (!this.handlers.shouldReconnect()) return
    // 重连前刷新 token
    const outcome = await this.handlers.refreshToken()
    if (outcome === 'success') {
      this.connect()
      return
    }
    // 'network_error':后端暂时不可达(如重启中),保留登录态继续退避重试
    // 'auth_failed':已登出(shouldReconnect 为 false),不再重连
    if (outcome === 'network_error' && this.handlers.shouldReconnect()) {
      this.scheduleReconnect()
    }
  }
}
