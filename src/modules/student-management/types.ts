/** 学生视图：账号基础信息 + 学籍信息，未维护的字段为 null */
export interface Student {
  studentId: number
  userId: number
  name: string
  /** 学号，未分配时为 null */
  studentNo: string | null
  gradeId: number | null
  /** 年级名称，未分配年级时为 null */
  gradeName: string | null
  /** 班级，未分班时为 null */
  className: string | null
  /** 专业，未录入时为 null */
  majorName: string | null
  /** 入学年份，未录入时为 null */
  enrollmentYear: number | null
  email: string | null
  phone: string | null
  createTime: string
}

/** 学生列表查询条件（全部可选） */
export interface StudentQuery {
  gradeId?: number
  className?: string
  major?: string
  /** 为 true 时仅返回未分配（班级等）的学生 */
  unassigned?: boolean
  name?: string
  /** 页码（从 1 开始） */
  page?: number
  /** 每页条数（上限 100） */
  pageSize?: number
}

/** 学生档案更新表单：页面侧对未修改字段回填原值后整体提交 */
export interface StudentUpdateForm {
  studentNo?: string
  className?: string
  majorName?: string
  gradeName?: string
  enrollmentYear?: number
}

/** 专业 */
export interface Major {
  id: number
  majorName: string
}
