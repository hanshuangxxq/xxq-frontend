import { watch } from 'vue'
import { useRoute } from 'vue-router'
import i18n from '@/i18n'

/**
 * 文档头同步:按当前路由 meta.titleKey 与界面语言更新 <title> 与 <html lang>。
 *
 * 本项目为纯静态 SPA(构建产物由 Nginx 直接分发,无 SSR):登录后的应用路由
 * 统一由 index.html 外壳响应,该外壳已声明 <meta name="robots" content="noindex">,
 * SEO 收录面由 deploy/landing 下的静态落地页承担。因此本 composable 的职责是
 * 浏览器标签页/书签可读性与读屏软件语言(<html lang>),而非搜索引擎收录。
 *
 * 在 App.vue 根组件调用一次即可:route 与 i18n locale 均为响应式源,
 * 路由切换与语言切换都会触发重算,无需在各页面重复调用。
 */
export function useDocumentHead() {
  const route = useRoute()

  watch(
    [() => route.meta.titleKey, () => i18n.global.locale.value],
    () => {
      const titleKey = route.meta.titleKey
      document.title =
        typeof titleKey === 'string' && titleKey.length > 0
          ? `${i18n.global.t(titleKey)} - ${i18n.global.t('common.app.siteName')}`
          : i18n.global.t('common.app.fullTitle')
      document.documentElement.lang = i18n.global.locale.value
    },
    { immediate: true },
  )
}
