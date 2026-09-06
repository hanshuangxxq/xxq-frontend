import type { UserType } from '@/modules/auth/types'

declare module 'vue-router' {
  interface RouteMeta {
    /** 面包屑/文档标题的 i18n key */
    titleKey?: string
    /**
     * 允许访问的角色;缺省表示所有登录用户可访问。
     * 与菜单 src/modules/layout/menu.ts 的 roles 保持一致:
     * 菜单负责隐藏入口,路由守卫(router/index.ts beforeEach)负责强制拦截地址栏直达。
     */
    roles?: UserType[]
  }
}

export {}
