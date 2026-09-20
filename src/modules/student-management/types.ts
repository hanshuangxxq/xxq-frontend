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
  /** 专业名：经班级推导（学生不直存专业），未分班或班级未挂专业时为 null，属正常状态 */
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
  /** 专业名（服务端按专业反查班级后再筛学生）；与 unassigned 组合恒为空集，不要同时传 */
  major?: string
  /** 为 true 时仅返回未分配（班级等）的学生 */
  unassigned?: boolean
  name?: string
  /** 页码（从 1 开始） */
  page?: number
  /** 每页条数（上限 100） */
  pageSize?: number
}

/**
 * 学生档案更新表单：页面侧对未修改字段回填原值后整体提交。
 * 无 majorName —— 专业挂在班级上，改专业只能通过换班级。
 */
export interface StudentUpdateForm {
  studentNo?: string
  className?: string
  gradeName?: string
  enrollmentYear?: number
}
