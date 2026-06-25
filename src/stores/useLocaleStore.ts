import { ref } from 'vue'
import { defineStore } from 'pinia'
import { dateZhCN, dateEnUS, zhCN, enUS } from 'naive-ui'
import i18n, { type SupportedLocale } from '@/i18n'

const STORAGE_KEY = 'xxq-locale'

function loadFromStorage(): SupportedLocale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'zh-CN' || stored === 'en') return stored
  return 'zh-CN'
}

const naiveLocaleMap = {
  'zh-CN': { locale: zhCN, dateLocale: dateZhCN },
  en: { locale: enUS, dateLocale: dateEnUS },
} as const

export const useLocaleStore = defineStore('locale', () => {
  const current = ref<SupportedLocale>(loadFromStorage())

  function setLocale(locale: SupportedLocale) {
    current.value = locale
    i18n.global.locale.value = locale
    localStorage.setItem(STORAGE_KEY, locale)
  }

  function naiveConfig() {
    return naiveLocaleMap[current.value]
  }

  return { current, setLocale, naiveConfig }
})
