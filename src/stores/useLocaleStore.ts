import { ref } from 'vue'
import { defineStore } from 'pinia'
import { dateZhCN, dateEnUS, zhCN, enUS } from 'naive-ui'
import i18n, { type SupportedLocale } from '@/i18n'

const naiveLocaleMap = {
  'zh-CN': { locale: zhCN, dateLocale: dateZhCN },
  en: { locale: enUS, dateLocale: dateEnUS },
} as const

/**
 * 界面语言。不做本地持久化:登录后由 usePreferenceStore 从后端拉取并 setLocale,
 * 用户修改也经 usePreferenceStore.setLang 同步到后端。
 */
export const useLocaleStore = defineStore('locale', () => {
  const current = ref<SupportedLocale>('zh-CN')

  function setLocale(locale: SupportedLocale) {
    current.value = locale
    i18n.global.locale.value = locale
  }

  function naiveConfig() {
    return naiveLocaleMap[current.value]
  }

  return { current, setLocale, naiveConfig }
})
