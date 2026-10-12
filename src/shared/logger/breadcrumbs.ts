import type { Breadcrumb, BreadcrumbCategory } from './types'

/** 环形缓冲容量:只保留最近 50 条,随错误上报时控制体积 */
const CAPACITY = 50

const buffer: Breadcrumb[] = []
let cursor = 0
let size = 0

/** 追加一条面包屑;超出容量覆盖最旧的一条 */
export function addBreadcrumb(category: BreadcrumbCategory, message: string) {
  const entry: Breadcrumb = { ts: Date.now(), category, message }
  if (size < CAPACITY) {
    buffer.push(entry)
    size += 1
    cursor = size % CAPACITY
    return
  }
  buffer[cursor] = entry
  cursor = (cursor + 1) % CAPACITY
}

/** 按时间顺序返回现有面包屑副本(最旧在前) */
export function getBreadcrumbs(): Breadcrumb[] {
  if (size < CAPACITY) return [...buffer]
  return [...buffer.slice(cursor), ...buffer.slice(0, cursor)]
}
