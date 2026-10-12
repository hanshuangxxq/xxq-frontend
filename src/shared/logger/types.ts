/** 日志级别:debug 仅 console;info/warn/error 批量上报后端 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** 日志类型 */
export type LogType =
  | 'js-error'
  | 'unhandled-rejection'
  | 'vue-error'
  | 'api-error'
  | 'page-view'
  | 'manual'

export type BreadcrumbCategory = 'route' | 'api' | 'click'

/** 行为面包屑:内存环形缓冲,随 warn/error 一并上报(info 不附,控制体积) */
export interface Breadcrumb {
  ts: number
  category: BreadcrumbCategory
  message: string
}

/** api-error 条目的请求上下文(永不含请求体与 query) */
export interface ApiLogContext {
  method: string
  path: string
  status?: number
  code?: number
  durationMs: number
}

/** 客户端环境,每条日志携带;version 为构建期注入的 __APP_VERSION__ */
export interface ClientInfo {
  version: string
  ua: string
  locale: string
  viewport: string
}

/** 单条上报日志,与后端 FrontendLogItem 一一对应 */
export interface LogEntry {
  level: Exclude<LogLevel, 'debug'>
  type: LogType
  message: string
  stack?: string
  /** 发生时的前端路由 fullPath */
  page: string
  api?: ApiLogContext
  breadcrumbs?: Breadcrumb[]
  client: ClientInfo
  userId: number | null
  userType: string | null
  /** 客户端毫秒时间戳 */
  occurTime: number
  /** 去重聚合:同一签名在待发送期间出现的次数 */
  count: number
}

export interface ReportPayload {
  logs: LogEntry[]
}

/**
 * 上报传输层:由 main.ts 注入 api.post 实现。
 * logger 不 import @/shared/api,避免 api.ts → logger → api.ts 循环引用。
 */
export type LogTransport = (
  payload: ReportPayload,
  options?: { keepalive?: boolean },
) => Promise<unknown>
