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

async function bootstrap() {
  // 启动时先校验版本:浏览器重新打开/手动刷新若命中了缓存的旧页面,
  // 在此检测到新版本并自动强制刷新;返回 true 表示即将刷新,不再继续启动旧版应用
  if (await ensureLatestVersion()) return

  const app = createApp(App)

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

void bootstrap()
