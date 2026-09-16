import type { RouteRecordRaw } from 'vue-router'

// 认证模块路由:仅登录页,是未登录用户访问系统时唯一的入口页面
const authRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('./pages/LoginPage.vue'),
    meta: { titleKey: 'auth.login.title', public: true },
  },
]

export default authRoutes
