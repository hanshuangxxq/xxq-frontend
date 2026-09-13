import { computed } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore'

/**
 * 角色判定 composable:基于当前登录用户的 userType 派生各模块权限计算属性。
 * 注意:这里只做「页面内按钮/区域显隐」层面的判断;真正的访问控制由路由守卫
 * (meta.roles)与后端 403 兜底,二者角色清单需与菜单 menu.ts 保持一致。
 */
export function useRoleCheck() {
  const authStore = useAuthStore()

  const isAcademicAdmin = computed(() => authStore.user?.userType === 'academic_admin')
  const isDepartment = computed(() => authStore.user?.userType === 'department')
  const isTeacher = computed(() => authStore.user?.userType === 'teacher')
  const isStudent = computed(() => authStore.user?.userType === 'student')

  /** 管理侧角色(教务或院系):用于「查看类」入口的宽口径判断 */
  const isAdmin = computed(
    () => authStore.user?.userType === 'academic_admin' || authStore.user?.userType === 'department',
  )

  const canManageRestrictions = computed(() => authStore.user?.userType === 'academic_admin')
  const canViewRestrictions = computed(() => isAdmin.value)

  const canManageScheduling = computed(() => authStore.user?.userType === 'academic_admin')
  const canViewScheduling = computed(() => isAdmin.value)

  const canManageCourses = computed(() => authStore.user?.userType === 'academic_admin')
  const canManageClassNames = computed(() => authStore.user?.userType === 'academic_admin')
  const canManageLocals = computed(() => authStore.user?.userType === 'academic_admin')

  const canManageBatchImport = computed(() => authStore.user?.userType === 'academic_admin')
  const canManageStudents = computed(() => authStore.user?.userType === 'academic_admin')

  const canManageDrafts = computed(() => authStore.user?.userType === 'department')
  const canViewDrafts = computed(() => authStore.user?.userType === 'department')

  return {
    isAcademicAdmin,
    isDepartment,
    isTeacher,
    isStudent,
    isAdmin,
    canManageRestrictions,
    canViewRestrictions,
    canManageScheduling,
    canViewScheduling,
    canManageCourses,
    canManageClassNames,
    canManageLocals,
    canManageBatchImport,
    canManageStudents,
    canManageDrafts,
    canViewDrafts,
  }
}
