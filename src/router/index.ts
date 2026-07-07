import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import authRoutes from '@/modules/auth/router'
import { useAuthStore } from '@/stores/useAuthStore'
import MainLayout from '@/modules/layout/MainLayout.vue'

const WHITELIST = ['/login']

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
      {
        path: 'course',
        name: 'CourseSelection',
        component: () => import('@/modules/course/pages/CourseSelectionPage.vue'),
      },
      {
        path: 'curriculum',
        name: 'Curriculum',
        component: () => import('@/modules/curriculum/pages/CurriculumPage.vue'),
      },
      {
        path: 'time-restrictions',
        name: 'TimeRestrictions',
        component: () => import('@/modules/time-restrictions/pages/TimeRestrictionsPage.vue'),
      },
      {
        path: 'scheduling',
        name: 'Scheduling',
        component: () => import('@/modules/scheduling/pages/SchedulingPage.vue'),
      },
      {
        path: 'course-management',
        name: 'CourseManagement',
        component: () => import('@/modules/course/pages/CourseManagementPage.vue'),
      },
      {
        path: 'class-names',
        name: 'ClassNameManagement',
        component: () => import('@/modules/class-names/pages/ClassNameManagementPage.vue'),
      },
      {
        path: 'locals',
        name: 'LocalManagement',
        component: () => import('@/modules/locals/pages/LocalManagementPage.vue'),
      },
      {
        path: 'teach-drafts',
        name: 'TeachDrafts',
        component: () => import('@/modules/curriculum/pages/DraftManagementPage.vue'),
      },
      {
        path: 'batch-import',
        name: 'BatchImport',
        component: () => import('@/modules/batch-import/pages/BatchImportPage.vue'),
      },
      {
        path: 'student-management',
        name: 'StudentManagement',
        component: () => import('@/modules/student-management/pages/StudentManagementPage.vue'),
      },
      {
        path: 'majors',
        name: 'MajorManagement',
        component: () => import('@/modules/majors/pages/MajorManagementPage.vue'),
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
