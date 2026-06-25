import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import authRoutes from '@/modules/auth/router'
import { useAuthStore } from '@/stores/useAuthStore'
import MainLayout from '@/modules/layout/MainLayout.vue'

const WHITELIST = ['/login', '/register']

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/modules/layout/HomePage.vue'),
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/modules/auth/pages/ProfilePage.vue'),
      },
    ],
  },
  ...authRoutes,
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  if (!authStore.isLoggedIn && !WHITELIST.includes(to.path)) {
    return '/login'
  }

  if (authStore.isLoggedIn && WHITELIST.includes(to.path)) {
    return '/profile'
  }
})

export default router
