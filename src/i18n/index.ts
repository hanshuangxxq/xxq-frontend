import { createI18n } from 'vue-i18n'
import zhCNCommon from '@/locales/zh-CN/common.json'
import zhCNAuth from '@/locales/zh-CN/auth.json'
import zhCNProfile from '@/locales/zh-CN/profile.json'
import zhCNCourse from '@/locales/zh-CN/course.json'
import enCommon from '@/locales/en/common.json'
import enAuth from '@/locales/en/auth.json'
import enProfile from '@/locales/en/profile.json'
import enCourse from '@/locales/en/course.json'

export type SupportedLocale = 'zh-CN' | 'en'

export const SUPPORTED_LOCALES: SupportedLocale[] = ['zh-CN', 'en']

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': { common: zhCNCommon, auth: zhCNAuth, profile: zhCNProfile, course: zhCNCourse },
    en: { common: enCommon, auth: enAuth, profile: enProfile, course: enCourse },
  },
})

export function setupI18n() {
  return i18n
}

export default i18n
