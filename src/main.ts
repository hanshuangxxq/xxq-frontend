import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import './theme/global.css'
import router from './router'
import { setupI18n } from './i18n'
import { ensureLatestVersion, startVersionCheck } from '@/shared/utils/versionCheck'
import { refreshToken } from '@/shared/tokenManager'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePreferenceStore } from '@/stores/usePreferenceStore'
import { api } from '@/shared/api'
import { attachVueErrorHandler, initLogger, logger } from '@/shared/logger'

/**
 * 移除 index.html 中的启动 splash:应用已挂载,首帧就位后淡出并删除节点。
 * 注意 splash 生命周期独立于 Vue 组件树(它在挂载前就已渲染),不走组件卸载
 */
function dismissBootSplash() {
  const splash = document.getElementById('boot-splash')
  if (!splash) return
  splash.classList.add('boot-splash-leaving')
  splash.addEventListener('transitionend', () => splash.remove(), { once: true })
  // 兜底:极端情况下 transitionend 不触发时也保证移除
  window.setTimeout(() => splash.remove(), 400)
}

/**
 * 应用启动流程:版本校验 -> 初始化日志 -> 创建应用 -> 预拉偏好 -> 挂载 -> 淡出 splash。
 * 任何一步失败都会向上抛出,启动 splash 停留在屏幕上提示加载中。
 */
async function bootstrap() {
  // 启动时先校验版本:浏览器重新打开/手动刷新若命中了缓存的旧页面,
  // 在此检测到新版本并自动强制刷新;返回 true 表示即将刷新,不再继续启动旧版应用
  if (await ensureLatestVersion()) return

  // 日志初始化尽量靠前:启动期异常(偏好拉取失败等)与 createApp 之前的 window 错误也能捕获。
  // transport 注入 api.post(logger 不反向依赖 api,防循环引用);
  // silent 不弹 toast、loading:false 不进全局加载;keepalive 供 pagehide 兜底发送
  initLogger({
    router,
    transport: (payload, options) =>
      api.post('/front-logs', payload, {
        silent: true,
        loading: false,
        keepalive: options?.keepalive,
      }),
  })

  const app = createApp(App)
  attachVueErrorHandler(app)

  app.use(createPinia())

  // 已有会话时,挂载前先拉取个性化偏好(主题/侧边栏),让首帧直接按用户设置渲染,
  // 避免先按默认主题渲染、读到远端偏好后再切换造成闪屏
  if (refreshToken.value) {
    // 实例化 auth store 以注册 token 刷新逻辑,使偏好请求遇 401 能自动换新 token
    useAuthStore()
    await usePreferenceStore().load()
  }

  app.use(router)
  app.use(setupI18n())

  app.mount('#app')
  dismissBootSplash()

  // 页面长期打开时,后台轮询检测服务器新版本并自动更新
  startVersionCheck()
}

bootstrap().catch((e) => {
  // 启动失败:splash 停留;错误经 logger 上报,不再抛出(unhandledrejection 会重复上报同一件事)
  logger.error('应用启动失败', e)
})
