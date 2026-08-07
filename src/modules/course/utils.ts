import type { CourseSource } from './types'

/**
 * 课程来源归一化：后端对常规课可能返回 null/undefined，统一按 MANUAL 处理。
 */
export function courseSource(c: { source?: CourseSource | null }): CourseSource {
  return c.source ?? 'MANUAL'
}

/** 是否为公选课（来源 selection_campaign） */
export function isPublicCourse(c: { source?: CourseSource | null }): boolean {
  return courseSource(c) === 'SELECTION_CAMPAIGN'
}

/**
 * 课程复合键 `source:id`。
 * 公选课与常规课 id 可能重复，单独用 id 无法区分，下拉/选择类组件用此复合值作 option value。
 */
export function courseKey(id: number, source: CourseSource | null | undefined): string {
  return `${source ?? 'MANUAL'}:${id}`
}

/** 解析课程复合键，返回 { id, source } */
export function parseCourseKey(key: string): { id: number; source: CourseSource } {
  const idx = key.indexOf(':')
  const source = (idx >= 0 ? key.slice(0, idx) : 'MANUAL') as CourseSource
  const id = Number(idx >= 0 ? key.slice(idx + 1) : key)
  return { id, source }
}
