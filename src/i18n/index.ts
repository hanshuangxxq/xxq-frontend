import { createI18n } from 'vue-i18n'
import zhCNCommon from '@/locales/zh-CN/common.json'
import zhCNAuth from '@/locales/zh-CN/auth.json'
import zhCNProfile from '@/locales/zh-CN/profile.json'
import zhCNCourse from '@/locales/zh-CN/course.json'
import zhCNCurriculum from '@/locales/zh-CN/curriculum.json'
import zhCNLayout from '@/locales/zh-CN/layout.json'
import enCommon from '@/locales/en/common.json'
import enAuth from '@/locales/en/auth.json'
import enProfile from '@/locales/en/profile.json'
import enCourse from '@/locales/en/course.json'
import enCurriculum from '@/locales/en/curriculum.json'
import enLayout from '@/locales/en/layout.json'

export type SupportedLocale = 'zh-CN' | 'en'

export const SUPPORTED_LOCALES: SupportedLocale[] = ['zh-CN', 'en']

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': { common: zhCNCommon, auth: zhCNAuth, profile: zhCNProfile, course: zhCNCourse, curriculum: zhCNCurriculum, layout: zhCNLayout },
    en: { common: enCommon, auth: enAuth, profile: enProfile, course: enCourse, curriculum: enCurriculum, layout: enLayout },
  },
})

export function setupI18n() {
  return i18n
}

export default i18n
