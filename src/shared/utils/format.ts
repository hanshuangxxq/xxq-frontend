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
