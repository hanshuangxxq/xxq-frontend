/** 班级(行政班) */
export interface ClassName {
  id: number
  className: string
  /** 所属专业 id（-> major.id）；院系经 major.collegeId 两跳推导，本实体不含院系字段 */
  majorId: number | null
}

/**
 * 班级表单,新建/编辑共用。
 * 新建时 majorId 必填（服务端 400 拒绝空值）；编辑时传 null 服务端按「非空才更新」忽略，
 * 即保持原专业不变。
 */
export interface ClassNameForm {
  className: string
  majorId: number | null
}
