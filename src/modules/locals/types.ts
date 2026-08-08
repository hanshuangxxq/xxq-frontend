/** 教室类型 code（请求/筛选时传 name） */
export type LocalTypeCode = 'CLASSROOM' | 'LABORATORY' | 'COMPUTER_ROOM' | 'LECTURE_HALL'

/** 教室类型（响应固定输出中文描述） */
export type LocalType = '普通教室' | '实验室' | '机房' | '报告厅'

/**
 * 中文描述 -> code。
 * 响应中 type 固定为中文描述，编辑回填表单时需转回 code 供下拉选择。
 * 用 Record<string, ...> 以便对未知描述安全降级。
 */
export const LOCAL_TYPE_TO_CODE: Record<string, LocalTypeCode> = {
  普通教室: 'CLASSROOM',
  实验室: 'LABORATORY',
  机房: 'COMPUTER_ROOM',
  报告厅: 'LECTURE_HALL',
}

/** 需要指定管理者的教室类型（实验室/机房），对应业务规则：实验室/机房必有管理者 */
export const LOCAL_TYPE_REQUIRES_MANAGER: ReadonlySet<LocalTypeCode> = new Set([
  'LABORATORY',
  'COMPUTER_ROOM',
])

export interface Local {
  id: number
  building: string
  classRoom: string
  max: number | null
  /** 响应输出中文描述；新建未传 type 时可能为 null */
  type: LocalType | null
  /** 管理者教师 ID（FK -> teacher.id）；实验室/机房必填，其他可选 */
  managerId: number | null
  /** 管理者姓名，仅响应回显（请求传入会被忽略） */
  managerName: string | null
}

export interface LocalForm {
  building: string
  classRoom: string
  max: number | null
  /** 请求传 name（推荐）；不传后端默认普通教室，但建议显式传 CLASSROOM */
  type: LocalTypeCode
  /** 管理者教师 ID；实验室/机房必填，其他可选 */
  managerId: number | null
}

export interface LocalQuery {
  /** 按类型筛选，推荐传 name */
  type?: LocalTypeCode
}
