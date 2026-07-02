export type RestrictionType = 'BLOCKED' | 'RESERVED'

export interface TimeRestriction {
  id: number
  timeId: number
  dayOfWeek: number
  restrictionType: RestrictionType
  courseId: number | null
  reason: string
}

export interface TimeRestrictionForm {
  timeId: number | null
  dayOfWeek: number | null
  restrictionType: RestrictionType
  courseId: number | null
  reason: string
}
