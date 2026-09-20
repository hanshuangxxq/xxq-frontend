import type { TimeRestriction } from '@/modules/time-restrictions/types'
import type { TimeSlot } from '@/modules/curriculum/types'

/**
 * i18n 翻译函数（`useI18n().t`）的最小签名。
 * 本文件是纯函数，不引入 vue/vue-i18n，翻译由调用方注入。
 */
export type TranslateFn = (key: string) => string

/**
 * 星期几文案表。显式列出键名而非拼接 `common.weekday.${day}`，
 * 这样在 computed 里调用时能随语言切换整体重算。
 */
export function weekdayLabels(t: TranslateFn): Record<number, string> {
  return {
    1: t('common.weekday.1'),
    2: t('common.weekday.2'),
    3: t('common.weekday.3'),
    4: t('common.weekday.4'),
    5: t('common.weekday.5'),
    6: t('common.weekday.6'),
    7: t('common.weekday.7'),
  }
}

/** 节次文案表 timeId -> "08:00-09:40" */
export function timeSlotLabels(slots: TimeSlot[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const s of slots) {
    map.set(s.id, `${s.startPeriod.substring(0, 5)}-${s.endPeriod.substring(0, 5)}`)
  }
  return map
}

/**
 * 时段限制的可读文案：限制记录自身没有名称，靠「星期 + 节次 + 原因」拼出来；
 * 三者都缺时退化成 `#id`，避免出现空白选项。
 */
export function restrictionLabel(
  r: TimeRestriction,
  weekdays: Record<number, string>,
  slotLabels: Map<number, string>,
): string {
  const parts: string[] = []
  const day = weekdays[r.dayOfWeek]
  if (day) parts.push(day)
  const slot = slotLabels.get(r.timeId)
  if (slot) parts.push(slot)
  if (r.reason) parts.push(r.reason)
  return parts.length ? parts.join(' ') : `#${r.id}`
}

/**
 * 可以绑定到选课活动的预留时段：必须是 RESERVED，且未被常规课（courseId 非空）
 * 或别的活动（campaignId 指向他处）占用 —— 后端 bindTimeRestrictions /
 * rebindTimeRestrictions 会拒绝这些，提前过滤掉必错项。
 *
 * `campaignId` 传当前活动 id 时，本活动已认领的仍算可绑定（改绑时要能回显）。
 */
export function bindableRestrictions(
  all: TimeRestriction[],
  campaignId?: number | null,
): TimeRestriction[] {
  return all.filter(
    (r) =>
      r.restrictionType === 'RESERVED' &&
      r.courseId == null &&
      (r.campaignId == null || r.campaignId === campaignId),
  )
}
