import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import './theme/global.css'
import router from './router'
import { setupI18n } from './i18n'
import { ensureLatestVersion, startVersionCheck } from '@/shared/utils/versionCheck'

async function bootstrap() {
  // 启动时先校验版本:浏览器重新打开/手动刷新若命中了缓存的旧页面,
  // 在此检测到新版本并自动强制刷新;返回 true 表示即将刷新,不再继续启动旧版应用
  if (await ensureLatestVersion()) return

  const app = createApp(App)

  app.use(createPinia())
  app.use(router)
  app.use(setupI18n())

  app.mount('#app')

  // 页面长期打开时,后台轮询检测服务器新版本并自动更新
  startVersionCheck()
}

void bootstrap()
