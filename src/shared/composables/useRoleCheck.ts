import { computed } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore'

export function useRoleCheck() {
  const authStore = useAuthStore()

  const isAcademicAdmin = computed(() => authStore.user?.userType === 'academic_admin')
  const isDepartment = computed(() => authStore.user?.userType === 'department')
  const isDean = computed(() => authStore.user?.userType === 'dean')
  const isTeacher = computed(() => authStore.user?.userType === 'teacher')
  const isStudent = computed(() => authStore.user?.userType === 'student')

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

  const canManageDrafts = computed(() => authStore.user?.userType === 'department')
  const canViewDrafts = computed(() => authStore.user?.userType === 'department')

  return {
    isAcademicAdmin,
    isDepartment,
    isDean,
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
    canManageDrafts,
    canViewDrafts,
  }
}
