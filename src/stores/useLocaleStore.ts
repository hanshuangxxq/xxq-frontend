import { ref } from 'vue'
import { defineStore } from 'pinia'
import { dateZhCN, dateEnUS, zhCN, enUS } from 'naive-ui'
import i18n, { detectSystemLocale, type SupportedLocale } from '@/i18n'

/** 界面语言 -> Naive UI 组件语言包映射 */
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
  /** 当前界面语言 */
  const current = ref<SupportedLocale>(detectSystemLocale())

  /** 切换界面语言(同步更新 vue-i18n 实例,全站文案即时刷新) */
  function setLocale(locale: SupportedLocale) {
    current.value = locale
    i18n.global.locale.value = locale
  }

  /** 当前语言对应的 Naive UI 语言包配置(供 App.vue 的 NConfigProvider 绑定) */
  function naiveConfig() {
    return naiveLocaleMap[current.value]
  }

  return { current, setLocale, naiveConfig }
})
