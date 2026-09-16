import type { UserType } from '@/modules/auth/types'

declare module 'vue-router' {
  interface RouteMeta {
    /** 面包屑/文档标题的 i18n key */
    titleKey?: string
    /**
     * 免登录可访问的独立公共页(登录页、403、404);缺省表示须登录。
     * 公共页不挂在主布局下,渲染时不加载侧边栏/通知通道/个性化偏好。
     */
    public?: boolean
    /**
     * 允许访问的角色;缺省表示所有登录用户可访问。
     * 与菜单 src/modules/layout/menu.ts 的 roles 保持一致:
     * 菜单负责隐藏入口,路由守卫(router/index.ts beforeEach)负责强制拦截地址栏直达。
     */
    roles?: UserType[]
  }
}

export {}
