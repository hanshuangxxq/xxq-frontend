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

export type SupportedLocale = 'zh-CN' | 'en'

export const SUPPORTED_LOCALES: SupportedLocale[] = ['zh-CN', 'en']

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': { common: zhCNCommon, auth: zhCNAuth, profile: zhCNProfile, course: zhCNCourse, curriculum: zhCNCurriculum, layout: zhCNLayout, 'time-restrictions': zhCNTimeRestrictions, scheduling: zhCNScheduling, 'course-management': zhCNCourseManagement, 'class-names': zhCNClassNames, locals: zhCNLocals, 'teach-drafts': zhCNTeachDrafts },
    en: { common: enCommon, auth: enAuth, profile: enProfile, course: enCourse, curriculum: enCurriculum, layout: enLayout, 'time-restrictions': enTimeRestrictions, scheduling: enScheduling, 'course-management': enCourseManagement, 'class-names': enClassNames, locals: enLocals, 'teach-drafts': enTeachDrafts },
  },
})

export function setupI18n() {
  return i18n
}

export default i18n
