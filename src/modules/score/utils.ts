import type { ScoreLevel, ReviewStatus } from './types'

/**
 * 按 §1.6 计算总评：总评 = 平时分 × ratio% + 期末成绩 × (100 − ratio)%（保留 2 位小数）。
 * 任一分数为空则无法计算。
 */
export function computeTotal(
  regular: number | null,
  final: number | null,
  ratio: number,
): number | null {
  if (regular == null || final == null) return null
  const total = regular * (ratio / 100) + final * ((100 - ratio) / 100)
  return Number(total.toFixed(2))
}

/** 按 §1.6 派生成绩等级 */
export function levelOf(total: number): ScoreLevel {
  if (total >= 90) return '优'
  if (total >= 80) return '良'
  if (total >= 70) return '中'
  if (total >= 60) return '及格'
  return '不及格'
}

/** 等级对应的图表色（hex） */
export function levelColor(level: ScoreLevel | string): string {
  switch (level) {
    case '优':
      return '#18a058'
    case '良':
      return '#2080f0'
    case '中':
      return '#909399'
    case '及格':
      return '#f0a020'
    case '不及格':
      return '#d03050'
    default:
      return '#909399'
  }
}

/** 等级对应的 NTag type */
export function levelTagType(
  level: string,
): 'success' | 'info' | 'warning' | 'error' | 'default' {
  switch (level) {
    case '优':
      return 'success'
    case '良':
      return 'info'
    case '中':
      return 'default'
    case '及格':
      return 'warning'
    case '不及格':
      return 'error'
    default:
      return 'default'
  }
}

/** 复核状态对应的 NTag type */
export function statusTagType(
  status: ReviewStatus | string,
): 'success' | 'info' | 'warning' | 'error' | 'default' {
  switch (status) {
    case '待教师处理':
      return 'warning'
    case '教师已回复':
      return 'info'
    case '已升级教务':
      return 'default'
    case '已解决':
      return 'success'
    case '已驳回':
      return 'error'
    default:
      return 'default'
  }
}

/** 考试/复核状态对应的 NTag type */
export function examStatusTagType(
  status: string,
): 'success' | 'info' | 'warning' | 'error' | 'default' {
  switch (status) {
    case '已安排':
      return 'info'
    case '已完成':
      return 'success'
    case '已取消':
      return 'error'
    default:
      return 'default'
  }
}

/** 将 LocalDateTime 字符串 (yyyy-MM-ddTHH:mm:ss) 格式化为可读形式 */
export function formatDateTime(s: string | null | undefined): string {
  return s ? s.replace('T', ' ') : '-'
}

/** 将 LocalDate (yyyy-MM-dd) 格式化为日期 */
export function formatDate(s: string | null | undefined): string {
  return s ?? '-'
}
