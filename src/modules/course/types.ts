export interface Course {
  id: number
  courseName: string
  courseCode: string
  credit: number
  courseHour: number
  courseType: string
}

export interface CourseForm {
  courseName: string
  courseCode: string
  credit: number | null
  courseHour: number | null
  courseType: string
}
