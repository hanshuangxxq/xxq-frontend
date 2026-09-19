/**
 * 全站统一展示格式化。空值(null/undefined/空串)一律返回 '-'。
 * 后端时间字符串兼容两种形态:'YYYY-MM-DDTHH:mm:ss'(ISO) 与 'YYYY-MM-DD HH:mm:ss'。
 */

/** 'YYYY-MM-DD HH:mm' */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ')
}

/** 'YYYY-MM-DD' */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  return value.slice(0, 10)
}

/** 数字原样展示,空值 '-' */
export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : String(value)
}

/** 分数展示,语义同 formatNumber(独立导出便于后续统一调整精度) */
export function formatScore(value: number | null | undefined): string {
  return formatNumber(value)
}

/**
 * 字节数展示,如 1.5 MB / 812 KB。
 * ≥1GB 保留一位小数便于识别量级(2.0 GB 而非 2048 MB),更小的整数直接展示。
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}
