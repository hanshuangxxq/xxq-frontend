export interface Student {
  studentId: number
  userId: number
  name: string
  studentNo: string | null
  gradeId: number | null
  gradeName: string | null
  className: string | null
  majorName: string | null
  enrollmentYear: number | null
  email: string | null
  phone: string | null
  createTime: string
}

export interface StudentQuery {
  gradeId?: number
  className?: string
  major?: string
  unassigned?: boolean
  name?: string
}

export interface StudentUpdateForm {
  studentNo?: string
  className?: string
  majorName?: string
  gradeName?: string
  enrollmentYear?: number
}

export interface Major {
  id: number
  majorName: string
}
