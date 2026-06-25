import { createI18n } from 'vue-i18n'
import zhCNCommon from '@/locales/zh-CN/common.json'
import enCommon from '@/locales/en/common.json'

export type SupportedLocale = 'zh-CN' | 'en'

export const SUPPORTED_LOCALES: SupportedLocale[] = ['zh-CN', 'en']

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': { common: zhCNCommon },
    en: { common: enCommon },
  },
})

export function setupI18n() {
  return i18n
}

export default i18n
