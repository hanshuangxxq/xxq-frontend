export interface Student {
  studentId: number
  userId: number
  name: string
  studentNo: string | null
  className: string | null
  grade: string | null
  majorName: string | null
  enrollmentYear: number | null
  email: string | null
  phone: string | null
  createTime: string
}

export interface StudentQuery {
  grade?: string
  className?: string
  major?: string
  unassigned?: boolean
  name?: string
}

export interface StudentUpdateForm {
  studentNo?: string
  className?: string
  majorName?: string
  enrollmentYear?: number
}

export interface Major {
  id: number
  majorName: string
}
