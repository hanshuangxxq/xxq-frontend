import { API_BASE_URL } from '@/config'
import { ensureFreshAccessToken } from '@/shared/tokenManager'
import type { NotificationResponse, WsPushMessage } from './types'

/** 通知 WebSocket 的回调集合，由调用方（store）注入，连接各生命周期事件 */
export interface NotificationSocketHandlers {
  /** 获取当前 WS 连接 URL（含 token） */
  getUrl: () => string
  /** 连接建立（用于更新在线状态） */
  onOpen: () => void
  /** 连接断开（用于更新在线状态） */
  onClose: () => void
  /** 收到未读数推送（建连时服务端立即下发一次） */
  onCount: (count: number) => void
  /** 收到新通知推送 */
  onNotification: (data: NotificationResponse) => void
  /** 是否还应重连（通常判断是否仍处于登录态） */
  shouldReconnect: () => boolean
}

const HEARTBEAT_INTERVAL = 30_000 // 心跳间隔，到点发 ping 兼作保活
const INITIAL_BACKOFF = 1_000 // 断线重连初始退避（ms）
const MAX_BACKOFF = 30_000 // 退避上限（ms），达到后按上限固定间隔重试

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
 * - 每次建连（含断线重连）前先确保 token 未临近过期，再用它握手
 * - 建连后服务端立即推送未读数
 * - 每 30s 发送 `ping` 兼作心跳
 * - 断线后指数退避重连
 */
export class NotificationSocket {
  private ws: WebSocket | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private backoff = INITIAL_BACKOFF
  private manualClose = false
  /** 建连中（刷新 token 的往返期间），使 connect() 幂等 */
  private connecting = false
  /** 建连世代：disconnect() 与新的 connect() 都令其自增，使在途建连作废 */
  private epoch = 0
  private readonly handlers: NotificationSocketHandlers

  constructor(handlers: NotificationSocketHandlers) {
    this.handlers = handlers
  }

  /** 建立连接（已有连接或正在建连时幂等跳过）；建连失败或断线走指数退避重连 */
  connect(): void {
    if (this.ws || this.connecting) return
    const epoch = ++this.epoch
    this.manualClose = false
    this.connecting = true
    void this.openWithFreshToken(epoch)
  }

  /** 主动断开（登出/布局卸载时调用）：置 manualClose 阻止后续自动重连 */
  disconnect(): void {
    this.manualClose = true
    this.epoch += 1
    this.connecting = false
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

  /**
   * 握手前先确保 token 未临近过期（需要时才换新）。access token 只有 30 分钟，页面挂机
   * 久了手里的 token 早已过期，直接握手会被服务端 401 拒绝（服务端只留下「token 无效 -
   * JWT expired」的告警），而浏览器 WebSocket API 读不到失败握手的状态码，事后无从补救。
   * 刷新失败不阻断握手：沿用旧 token 试一次，连不上由退避重连兜底。
   */
  private async openWithFreshToken(epoch: number): Promise<void> {
    await ensureFreshAccessToken()
    // 期间被 disconnect() 或新的 connect() 取代：本次建连作废
    if (epoch !== this.epoch) return
    this.connecting = false
    if (this.manualClose || !this.handlers.shouldReconnect()) return
    this.open()
  }

  /** 打开连接并挂上事件；建连失败或断线统一在 onclose 里退避重连 */
  private open(): void {
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
      // 已被新连接取代（disconnect 后重连）时忽略迟到的关闭事件，别把新连接的状态清掉
      if (this.ws !== ws) return
      this.ws = null
      this.stopHeartbeat()
      this.handlers.onClose()
      if (!this.manualClose) {
        this.scheduleReconnect()
      }
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
      // 重连同样先确保 token 未临近过期（connect() 内部统一处理）
      this.connect()
    }, delay)
  }
}
