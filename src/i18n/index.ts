import { createI18n } from 'vue-i18n'
import zhCNCommon from '@/locales/zh-CN/common.json'
import zhCNAuth from '@/locales/zh-CN/auth.json'
import zhCNProfile from '@/locales/zh-CN/profile.json'
import zhCNCourse from '@/locales/zh-CN/course.json'
import zhCNCurriculum from '@/locales/zh-CN/curriculum.json'
import zhCNLayout from '@/locales/zh-CN/layout.json'
import zhCNTimeRestrictions from '@/locales/zh-CN/time-restrictions.json'
import zhCNScheduling from '@/locales/zh-CN/scheduling.json'
import zhCNCourseManagement from '@/locales/zh-CN/course-management.json'
import zhCNClassNames from '@/locales/zh-CN/class-names.json'
import zhCNLocals from '@/locales/zh-CN/locals.json'
import zhCNTeachDrafts from '@/locales/zh-CN/teach-drafts.json'
import zhCNBatchImport from '@/locales/zh-CN/batch-import.json'
import zhCNStudentManagement from '@/locales/zh-CN/student-management.json'
import zhCNMajors from '@/locales/zh-CN/majors.json'
import zhCNSemester from '@/locales/zh-CN/semester.json'
import zhCNSelection from '@/locales/zh-CN/selection.json'
import zhCNGrades from '@/locales/zh-CN/grades.json'
import zhCNNotification from '@/locales/zh-CN/notification.json'
import enCommon from '@/locales/en/common.json'
import enAuth from '@/locales/en/auth.json'
import enProfile from '@/locales/en/profile.json'
import enCourse from '@/locales/en/course.json'
import enCurriculum from '@/locales/en/curriculum.json'
import enLayout from '@/locales/en/layout.json'
import enTimeRestrictions from '@/locales/en/time-restrictions.json'
import enScheduling from '@/locales/en/scheduling.json'
import enCourseManagement from '@/locales/en/course-management.json'
import enClassNames from '@/locales/en/class-names.json'
import enLocals from '@/locales/en/locals.json'
import enTeachDrafts from '@/locales/en/teach-drafts.json'
import enBatchImport from '@/locales/en/batch-import.json'
import enStudentManagement from '@/locales/en/student-management.json'
import enMajors from '@/locales/en/majors.json'
import enSemester from '@/locales/en/semester.json'
import enSelection from '@/locales/en/selection.json'
import enGrades from '@/locales/en/grades.json'
import enNotification from '@/locales/en/notification.json'

export type SupportedLocale = 'zh-CN' | 'en'

export const SUPPORTED_LOCALES: SupportedLocale[] = ['zh-CN', 'en']

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': { common: zhCNCommon, auth: zhCNAuth, profile: zhCNProfile, course: zhCNCourse, curriculum: zhCNCurriculum, layout: zhCNLayout, 'time-restrictions': zhCNTimeRestrictions, scheduling: zhCNScheduling, 'course-management': zhCNCourseManagement, 'class-names': zhCNClassNames, locals: zhCNLocals, 'teach-drafts': zhCNTeachDrafts, 'batch-import': zhCNBatchImport, 'student-management': zhCNStudentManagement, majors: zhCNMajors, semester: zhCNSemester, selection: zhCNSelection, grades: zhCNGrades, notification: zhCNNotification },
    en: { common: enCommon, auth: enAuth, profile: enProfile, course: enCourse, curriculum: enCurriculum, layout: enLayout, 'time-restrictions': enTimeRestrictions, scheduling: enScheduling, 'course-management': enCourseManagement, 'class-names': enClassNames, locals: enLocals, 'teach-drafts': enTeachDrafts, 'batch-import': enBatchImport, 'student-management': enStudentManagement, majors: enMajors, semester: enSemester, selection: enSelection, grades: enGrades, notification: enNotification },
  },
})

export function setupI18n() {
  return i18n
}

export default i18n
