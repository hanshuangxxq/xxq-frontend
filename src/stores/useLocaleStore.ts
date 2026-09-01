import { ref } from 'vue'
import { defineStore } from 'pinia'
import { dateZhCN, dateEnUS, zhCN, enUS } from 'naive-ui'
import i18n, { detectSystemLocale, type SupportedLocale } from '@/i18n'

const naiveLocaleMap = {
  'zh-CN': { locale: zhCN, dateLocale: dateZhCN },
  en: { locale: enUS, dateLocale: dateEnUS },
} as const

/**
 * 界面语言。默认跟随系统语言(浏览器语言);登录后若后端偏好返回了语言设置,
 * 则由 usePreferenceStore 以后端为准调用 setLocale 覆盖,用户修改也经
 * usePreferenceStore.setLang 同步到后端。
 */
export const useLocaleStore = defineStore('locale', () => {
  const current = ref<SupportedLocale>(detectSystemLocale())

  function setLocale(locale: SupportedLocale) {
    current.value = locale
    i18n.global.locale.value = locale
  }

  function naiveConfig() {
    return naiveLocaleMap[current.value]
  }

  return { current, setLocale, naiveConfig }
})
