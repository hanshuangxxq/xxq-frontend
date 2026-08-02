/**
 * 由后端返回的考试 startTime/endTime（HH:mm[:ss]）反算考试时长（分钟）。
 * 任一缺失或格式非法时返回 null。
 */
export function calcDurationMinutes(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null
  const [sh = 0, sm = 0] = start.split(':').map(Number)
  const [eh = 0, em = 0] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null
  return eh * 60 + em - (sh * 60 + sm)
}
