import type { WarningLevel, WarningStatus, ProgressStatus, ExamStatus } from './types'

/** 预警级别对应的图表色（hex） */
export function warningLevelColor(level: WarningLevel | string): string {
  switch (level) {
    case '红色预警':
      return '#d03050'
    case '橙色预警':
      return '#f0a020'
    case '黄色预警':
      return '#f0c020'
    default:
      return '#909399'
  }
}

/** 预警级别对应的 NTag type */
export function warningLevelTagType(
  level: WarningLevel | string,
): 'error' | 'warning' | 'info' | 'default' {
  switch (level) {
    case '红色预警':
      return 'error'
    case '橙色预警':
      return 'warning'
    case '黄色预警':
      return 'info'
    default:
      return 'default'
  }
}

/** 预警状态对应的 NTag type */
export function warningStatusTagType(
  status: WarningStatus | string,
): 'success' | 'info' | 'default' {
  switch (status) {
    case '生效中':
      return 'info'
    case '已解除':
      return 'success'
    default:
      return 'default'
  }
}

/** 进度状态对应的 NTag type */
export function progressStatusTagType(
  status: ProgressStatus | string,
): 'success' | 'info' | 'default' {
  switch (status) {
    case '已结课':
      return 'success'
    case '进行中':
      return 'info'
    default:
      return 'default'
  }
}

/** 考试状态对应的 NTag type */
export function examStatusTagType(
  status: ExamStatus | string,
): 'success' | 'info' | 'warning' | 'default' {
  switch (status) {
    case '已完成':
      return 'success'
    case '已排考':
      return 'info'
    case '无考试':
      return 'warning'
    default:
      return 'default'
  }
}

/** 将 LocalDateTime 字符串 (yyyy-MM-ddTHH:mm:ss) 格式化为可读形式 */
export function formatDateTime(s: string | null | undefined): string {
  return s ? s.replace('T', ' ') : '-'
}
