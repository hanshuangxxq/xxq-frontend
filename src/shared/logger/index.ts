import type { App } from 'vue'
import type { Router } from 'vue-router'

import { currentUserId, loadUser } from '@/shared/tokenManager'

import { addBreadcrumb, getBreadcrumbs } from './breadcrumbs'
import { enqueue, initReporter } from './reporter'
import type { ApiLogContext, ClientInfo, LogEntry, LogTransport, LogType } from './types'

const MESSAGE_MAX = 1_000
const STACK_MAX = 8_000
const DATA_MAX = 500

/** 当前路由 fullPath;initLogger 注入 router 后生效,之前退化为 location.pathname */
let currentPath: () => string = () => window.location.pathname

function clientInfo(): ClientInfo {
  return {
    version: __APP_VERSION__,
    ua: navigator.userAgent,
    locale: navigator.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  }
}

/** 从持久化会话读用户类型;不 import auth store(避免经 store → api 形成循环引用) */
function sessionUserType(): string | null {
  const user = loadUser() as { userType?: unknown } | null
  return typeof user?.userType === 'string' ? user.userType : null
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text
}

/** 手动埋点附加上下文序列化;失败(循环引用等)不拖垮日志本身 */
function serializeData(data: Record<string, unknown> | undefined): string {
  if (!data) return ''
  try {
    return ' | ' + truncate(JSON.stringify(data), DATA_MAX)
  } catch {
    return ' | [data 序列化失败]'
  }
}

function buildEntry(
  level: 'info' | 'warn' | 'error',
  type: LogType,
  message: string,
  extras: { stack?: string; api?: ApiLogContext },
): LogEntry {
  return {
    level,
    type,
    message: truncate(message, MESSAGE_MAX),
    ...(extras.stack ? { stack: truncate(extras.stack, STACK_MAX) } : {}),
    ...(extras.api ? { api: extras.api } : {}),
    page: currentPath(),
    client: clientInfo(),
    userId: currentUserId.value,
    userType: sessionUserType(),
    occurTime: Date.now(),
    count: 1,
    // info(页面访问/埋点)量大,不附面包屑;warn/error 附最近 50 条行为痕迹
    ...(level !== 'info' ? { breadcrumbs: getBreadcrumbs() } : {}),
  }
}

function write(
  level: 'info' | 'warn' | 'error',
  type: LogType,
  message: string,
  extras: { stack?: string; api?: ApiLogContext },
  err?: unknown,
) {
  // console 输出保留:开发期与远程协助排障直接可见;有原始错误时一并输出,保留可点击堆栈
  const line = `[xxq:${type}] ${message}`
  const args: unknown[] = err !== undefined ? [line, err] : [line]
  if (level === 'error') console.error(...args)
  else if (level === 'warn') console.warn(...args)
  else console.info(...args)
  enqueue(buildEntry(level, type, message, extras))
}

/** 对外日志门面:debug 仅 console;info/warn/error 上报后端 */
export const logger = {
  debug(message: string, data?: Record<string, unknown>) {
    console.debug(`[xxq] ${message}${serializeData(data)}`)
  },
  /** 手动埋点(如「导出成绩」「播放视频」):info 级落盘 */
  info(message: string, data?: Record<string, unknown>) {
    write('info', 'manual', message + serializeData(data), {})
  },
  warn(message: string, data?: Record<string, unknown>) {
    write('warn', 'manual', message + serializeData(data), {})
  },
  error(message: string, error?: unknown, data?: Record<string, unknown>) {
    const errMsg = error instanceof Error ? `${message}: ${error.message}` : message
    write('error', 'manual', errMsg + serializeData(data), {
      stack: error instanceof Error ? (error.stack ?? undefined) : undefined,
    }, error)
  },
}

export interface InitLoggerOptions {
  router: Router
  transport: LogTransport
}

/** 单例守卫:initLogger 带全局副作用(监听/定时器),重复调用会叠加,只初始化一次 */
let initialized = false

/**
 * 初始化日志:注册全局错误捕获、点击面包屑、路由面包屑与页面访问上报。
 * main.ts 在 createApp 之前调用(启动期异常也能经 window.onerror 捕获)。
 */
export function initLogger(options: InitLoggerOptions) {
  if (initialized) return
  initialized = true
  initReporter(options.transport)
  currentPath = () => options.router.currentRoute.value.fullPath

  window.addEventListener('error', onWindowError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)
  document.addEventListener('click', onDocumentClick, { capture: true, passive: true })

  options.router.afterEach((to, from) => {
    addBreadcrumb('route', `${from.fullPath} → ${to.fullPath}`)
    write('info', 'page-view', `页面访问 ${to.fullPath}`, {})
  })
}

/** Vue 渲染/生命周期错误捕获;main.ts 在 createApp 之后、mount 之前调用 */
export function attachVueErrorHandler(app: App) {
  app.config.errorHandler = (err, instance, info) => {
    // script-setup 组件的名字在 __name 上;拿不到组件名也不影响上报
    const comp = (instance?.$options.name ?? instance?.$options.__name) as string | undefined
    const where = comp ? `${info}, 组件:${comp}` : info
    write('error', 'vue-error', `Vue 错误(${where}): ${err instanceof Error ? err.message : String(err)}`, {
      stack: err instanceof Error ? (err.stack ?? undefined) : undefined,
    }, err)
  }
}

function onWindowError(event: ErrorEvent) {
  // 跨域脚本错误只有 "Script error." 无细节,仍记录(带来源文件),便于发现 CSP/资源加载问题
  write('error', 'js-error', `${event.message} @${event.filename}:${event.lineno}`, {
    stack: event.error instanceof Error ? (event.error.stack ?? undefined) : undefined,
  }, event.error)
}

function onUnhandledRejection(event: PromiseRejectionEvent) {
  const reason: unknown = event.reason
  // api 层错误已在请求管线带上下文上报(见 reportApiError),跳过避免重复;
  // 鸭子类型判断 reported:logger 不能 import api 模块(循环引用)
  if (reason instanceof Error && 'reported' in reason && reason.reported === true) return
  write(
    'error',
    'unhandled-rejection',
    reason instanceof Error ? reason.message : stringifyReason(reason),
    { stack: reason instanceof Error ? (reason.stack ?? undefined) : undefined },
    reason instanceof Error ? reason : undefined,
  )
}

/** 非 Error 的 rejection 原因:同 serializeData 的防御式序列化,失败回退 String(reason) */
function stringifyReason(reason: unknown): string {
  try {
    // JSON.stringify 对 undefined/function/symbol 返回 undefined,回退 String(...)
    const serialized: unknown = JSON.stringify(reason)
    return typeof serialized === 'string' ? truncate(serialized, MESSAGE_MAX) : String(reason)
  } catch {
    return String(reason)
  }
}

// ---- 点击面包屑:只记可交互元素,同一元素 500ms 内连击去重 ----

let lastClickDesc = ''
let lastClickAt = 0

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ''
  const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 20)
  return text ? `<${tag}${id}> ${text}` : `<${tag}${id}>`
}

function onDocumentClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return
  const el =
    event.target.closest(
      'button, a, input, [role="button"], [role="menuitem"], [role="option"], [role="tab"]',
    ) ?? event.target
  const desc = describeElement(el)
  const now = Date.now()
  if (desc === lastClickDesc && now - lastClickAt < 500) return
  lastClickDesc = desc
  lastClickAt = now
  addBreadcrumb('click', desc)
}

// ---- api.ts 挂钩(由请求管线调用;url 可能带 query,这里统一剥离) ----

/** 请求完成(成功/失败)记一条面包屑 */
export function addApiBreadcrumb(
  method: string,
  url: string,
  status: number | null,
  code: number | null,
  durationMs: number,
) {
  const statusText = status !== null ? `HTTP ${status}` : '网络失败'
  const codeText = code !== null && code !== 200 ? ` code:${code}` : ''
  // noUncheckedIndexedAccess:split 结果可能为 undefined,回退完整 url
  const path = url.split('?')[0] ?? url
  addBreadcrumb('api', `${method} ${path} → ${statusText}${codeText} ${Math.round(durationMs)}ms`)
}

/** 请求失败上报:业务错误(后端 4xx 语义,多为正常交互反馈)记 warn,网络/HTTP 错误记 error */
export function reportApiError(
  kind: 'network' | 'http' | 'business',
  method: string,
  url: string,
  status: number | null,
  code: number | null,
  durationMs: number,
  detail: string,
) {
  const api: ApiLogContext = {
    method,
    path: url.split('?')[0] ?? '',
    durationMs: Math.round(durationMs),
    ...(status !== null ? { status } : {}),
    ...(code !== null ? { code } : {}),
  }
  write(kind === 'business' ? 'warn' : 'error', 'api-error', truncate(detail, MESSAGE_MAX), { api })
}
