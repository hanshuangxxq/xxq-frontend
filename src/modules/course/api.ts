import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
import type { Course, CourseForm } from './types'

export function fetchCourses(): Promise<Result<Course[]>> {
  return api.get('/courses')
}

export function fetchCourse(id: number): Promise<Result<Course>> {
  return api.get(`/courses/${id}`)
}

export function createCourse(body: CourseForm): Promise<Result<Course>> {
  return api.post('/courses', body)
}

export function updateCourse(id: number, body: CourseForm): Promise<Result<Course>> {
  return api.put(`/courses/${id}`, body)
}

export function deleteCourse(id: number): Promise<Result<null>> {
  return api.delete(`/courses/${id}`)
}
