<script setup lang="ts">
import { ref, computed, h, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NLayout,
  NLayoutSider,
  NLayoutContent,
  NMenu,
  NAvatar,
  NIcon,
  NDropdown,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSelect,
  NBadge,
  useMessage,
} from 'naive-ui'
import { useAuthStore } from '@/stores/useAuthStore'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { useAvatar } from '@/shared/composables/useAvatar'
import { authApi } from '@/modules/auth/api'
import { useNotificationStore } from '@/stores/useNotificationStore'
import NotificationPanel from '@/modules/notification/NotificationPanel.vue'
import type { SupportedLocale } from '@/i18n'
import sidebarHideSvg from '@/icons/sidebar_hide.svg'
import sidebarShowSvg from '@/icons/sidebar_show.svg'
import selectSvg from '@/icons/select.svg'
import perInfoSvg from '@/icons/perInfo.svg'
import logoutSvg from '@/icons/logout.svg'
import courseSvg from '@/icons/course.svg'
import couSelSvg from '@/icons/couSel.svg'
import settingSvg from '@/icons/setting.svg'
import closeSvg from '@/icons/close.svg'
import timeResSvg from '@/icons/TimeRes.svg'
import autoSvg from '@/icons/auto.svg'
import classSvg from '@/icons/class.svg'
import classRoomSvg from '@/icons/classRoom.svg'
import batchImportSvg from '@/icons/batchImport.svg'
import stuInfoSvg from '@/icons/stuInfo.svg'
import majorSvg from '@/icons/major.svg'
import semesterSvg from '@/icons/semester.svg'
import informationSvg from '@/icons/information.svg'
import reviewSvg from '@/icons/review.svg'
import makeupSvg from '@/icons/makeup.svg'
import scoreEntrySvg from '@/icons/scoreEntry.svg'
import scoreStatisticsSvg from '@/icons/scoreStatistics.svg'
import scoreInquirySvg from '@/icons/scoreInquiry.svg'
import examTimeSvg from '@/icons/examTime.svg'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const localeStore = useLocaleStore()
const notificationStore = useNotificationStore()
const message = useMessage()

const collapsed = ref(false)
const showSettings = ref(false)
const showLogoutConfirm = ref(false)
const loggingOut = ref(false)
const settingsTab = ref<'password' | 'language'>('language')

const avatarSrc = useAvatar(computed(() => authStore.user?.avatar ?? null))

const localeOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
]

const currentLocale = computed({
  get: () => localeStore.current,
  set: (v) => localeStore.setLocale(v as SupportedLocale),
})

function renderSvgIcon(svgSrc: string) {
  return () =>
    h(NIcon, null, {
      default: () => h('img', { src: svgSrc, style: { width: '18px', height: '18px' } }),
    })
}

function renderNotificationLabel() {
  const children = [h('span', null, t('notification.title'))]
  if (notificationStore.unreadCount > 0) {
    children.push(h(NBadge, { value: notificationStore.unreadCount, type: 'error', max: 99 }))
  }
  return h(
    'div',
    {
      style:
        'display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding-right: 8px',
    },
    children,
  )
}

const menuOptions = computed(() => {
  const items: Array<{ label: string; key: string; icon?: () => ReturnType<typeof h> }> = [
    { label: t('profile.title'), key: '/profile', icon: renderSvgIcon(perInfoSvg) },
  ]
  if (authStore.user?.userType === 'student' || authStore.user?.userType === 'teacher') {
    items.push({ label: t('curriculum.title'), key: '/curriculum', icon: renderSvgIcon(courseSvg) })
  }
  if (authStore.user?.userType === 'student') {
    items.push({ label: t('course.title'), key: '/course', icon: renderSvgIcon(couSelSvg) })
  }
  if (
    authStore.user?.userType === 'academic_admin' ||
    authStore.user?.userType === 'department'
  ) {
    items.push({
      label: t('time-restrictions.title'),
      key: '/time-restrictions',
      icon: renderSvgIcon(timeResSvg),
    })
  }
  if (authStore.user?.userType === 'department') {
    items.push({
      label: t('teach-drafts.title'),
      key: '/teach-drafts',
      icon: renderSvgIcon(couSelSvg),
    })
  }
  if (authStore.user?.userType === 'academic_admin') {
    items.push({
      label: t('course-management.title'),
      key: '/course-management',
      icon: renderSvgIcon(couSelSvg),
    })
    items.push({
      label: t('class-names.title'),
      key: '/class-names',
      icon: renderSvgIcon(classSvg),
    })
    items.push({
      label: t('locals.title'),
      key: '/locals',
      icon: renderSvgIcon(classRoomSvg),
    })
    items.push({
      label: t('scheduling.title'),
      key: '/scheduling',
      icon: renderSvgIcon(autoSvg),
    })
    items.push({
      label: t('batch-import.title'),
      key: '/batch-import',
      icon: renderSvgIcon(batchImportSvg),
    })
    items.push({
      label: t('student-management.title'),
      key: '/student-management',
      icon: renderSvgIcon(stuInfoSvg),
    })
    items.push({
      label: t('majors.title'),
      key: '/majors',
      icon: renderSvgIcon(majorSvg),
    })
    items.push({
      label: t('layout.semester'),
      key: '/semester',
      icon: renderSvgIcon(semesterSvg),
    })
    items.push({
      label: t('grades.title'),
      key: '/grades',
      icon: renderSvgIcon(majorSvg),
    })
    items.push({
      label: t('selection.title'),
      key: '/selection',
      icon: renderSvgIcon(couSelSvg),
    })
  }
  // 成绩与考试
  if (authStore.user?.userType === 'student') {
    items.push({ label: t('score.myTitle'), key: '/my-scores', icon: renderSvgIcon(scoreInquirySvg) })
    items.push({ label: t('exam.myTitle'), key: '/my-exams', icon: renderSvgIcon(examTimeSvg) })
  }
  if (authStore.user?.userType === 'teacher') {
    items.push({ label: t('score.mgTitle'), key: '/scores', icon: renderSvgIcon(scoreEntrySvg) })
  }
  if (authStore.user?.userType === 'department') {
    items.push({
      label: t('score.statTitle'),
      key: '/score-statistics',
      icon: renderSvgIcon(scoreStatisticsSvg),
    })
  }
  if (authStore.user?.userType === 'academic_admin') {
    items.push({
      label: t('score.statTitle'),
      key: '/score-statistics',
      icon: renderSvgIcon(scoreStatisticsSvg),
    })
    items.push({ label: t('exam.mgTitle'), key: '/exams', icon: renderSvgIcon(examTimeSvg) })
    items.push({ label: t('exam.mkTitle'), key: '/makeup-exams', icon: renderSvgIcon(makeupSvg) })
  }
  if (
    authStore.user?.userType === 'student' ||
    authStore.user?.userType === 'teacher' ||
    authStore.user?.userType === 'academic_admin'
  ) {
    items.push({
      label: t('score.rvTitle'),
      key: '/score-review',
      icon: renderSvgIcon(reviewSvg),
    })
  }
  return items
})

const activeKey = computed(() => route.path)

function handleMenuClick(key: string) {
  router.push(key)
}

const userMenuOptions = computed(() => [
  {
    label: renderNotificationLabel,
    key: 'notification',
    icon: renderSvgIcon(informationSvg),
  },
  { label: t('layout.settings'), key: 'settings', icon: renderSvgIcon(settingSvg) },
  { type: 'divider' as const, key: 'divider' },
  { label: t('auth.logout'), key: 'logout', icon: renderSvgIcon(logoutSvg) },
])

function handleUserMenuSelect(key: string) {
  if (key === 'notification') {
    notificationStore.openPanel()
  } else if (key === 'settings') {
    showSettings.value = true
  } else if (key === 'logout') {
    showLogoutConfirm.value = true
  }
}

async function handleLogout() {
  loggingOut.value = true
  try {
    await authStore.logout()
    showLogoutConfirm.value = false
    router.push('/login')
  } finally {
    loggingOut.value = false
  }
}

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmNewPassword: '',
})
const changingPassword = ref(false)

async function handleChangePassword() {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmNewPassword) {
    message.warning(t('layout.passwordMismatch'))
    return
  }
  changingPassword.value = true
  try {
    await authApi.changePassword({
      account: authStore.user!.account,
      oldPassword: passwordForm.value.oldPassword,
      newPassword: passwordForm.value.newPassword,
    })
    message.success(t('layout.passwordChangeSuccess'))
    passwordForm.value = { oldPassword: '', newPassword: '', confirmNewPassword: '' }
  } catch (e) {
    message.error((e as Error).message || t('layout.passwordChangeFail'))
  } finally {
    changingPassword.value = false
  }
}

onMounted(() => {
  notificationStore.setToastHandler((n) => {
    message.info(`${t('notification.newMessage')}：${n.title}`)
  })
  notificationStore.connect()
})

onUnmounted(() => {
  notificationStore.disconnect()
  notificationStore.setToastHandler(null)
})
</script>

<template>
  <NLayout has-sider class="main-layout">
    <NLayoutSider
      bordered
      :width="220"
      :collapsed-width="64"
      :collapsed="collapsed"
      collapse-mode="width"
      class="main-sider"
    >
      <div class="sidebar-container">
        <div class="sidebar-top" :class="{ collapsed }">
          <span v-show="!collapsed" class="project-name">{{ t('layout.projectName') }}</span>
          <img
            :src="collapsed ? sidebarShowSvg : sidebarHideSvg"
            class="toggle-icon"
            :title="collapsed ? t('layout.expand') : t('layout.collapse')"
            @click="collapsed = !collapsed"
          />
        </div>

        <div class="sidebar-menu">
          <NMenu
            :value="activeKey"
            :options="menuOptions"
            :collapsed="collapsed"
            :collapsed-width="48"
            :root-indent="20"
            @update:value="handleMenuClick"
          />
        </div>

        <div class="sidebar-bottom" :class="{ collapsed }">
          <NAvatar :size="32" :src="avatarSrc" round>
            <template v-if="!avatarSrc">{{ authStore.user?.name?.charAt(0) }}</template>
            <template #fallback>{{ authStore.user?.name?.charAt(0) }}</template>
          </NAvatar>
          <span class="username">{{ authStore.user?.name }}</span>
          <NDropdown
            trigger="click"
            :options="userMenuOptions"
            :placement="collapsed ? 'top' : 'top-end'"
            @select="handleUserMenuSelect"
          >
            <div class="dropdown-hitbox"></div>
          </NDropdown>
          <img :src="selectSvg" class="dropdown-arrow" />
        </div>
      </div>
    </NLayoutSider>

    <NLayoutContent class="main-content" :class="{ 'sidebar-collapsed': collapsed }">
      <RouterView />
    </NLayoutContent>
  </NLayout>

  <NModal
    v-model:show="showSettings"
    preset="card"
    class="settings-modal"
    content-style="padding: 0; margin: 0"
    :segmented="{ content: 'soft', footer: 'soft' }"
  >
    <div class="settings-layout">
      <img
        :src="closeSvg"
        class="settings-close-btn"
        @click="showSettings = false"
      />
      <div class="settings-body">
        <div class="settings-nav">
          <div class="settings-nav-title">{{ t('layout.settings') }}</div>
          <div
            class="settings-nav-item"
            :class="{ active: settingsTab === 'language' }"
            @click="settingsTab = 'language'"
          >
            {{ t('layout.switchLanguage') }}
          </div>
          <div
            class="settings-nav-item"
            :class="{ active: settingsTab === 'password' }"
            @click="settingsTab = 'password'"
          >
            {{ t('layout.changePassword') }}
          </div>
        </div>
        <div class="settings-content">
        <template v-if="settingsTab === 'password'">
          <h4 class="settings-section-title">{{ t('layout.changePassword') }}</h4>
          <NForm :model="passwordForm">
            <NFormItem :label="t('layout.currentPassword')">
              <NInput
                v-model:value="passwordForm.oldPassword"
                type="password"
                :placeholder="t('layout.currentPasswordPlaceholder')"
              />
            </NFormItem>
            <NFormItem :label="t('layout.newPassword')">
              <NInput
                v-model:value="passwordForm.newPassword"
                type="password"
                :placeholder="t('layout.newPasswordPlaceholder')"
              />
            </NFormItem>
            <NFormItem :label="t('layout.confirmNewPassword')">
              <NInput
                v-model:value="passwordForm.confirmNewPassword"
                type="password"
                :placeholder="t('layout.confirmNewPasswordPlaceholder')"
              />
            </NFormItem>
            <NButton
              type="primary"
              :loading="changingPassword"
              block
              @click="handleChangePassword"
            >
              {{ t('layout.changePassword') }}
            </NButton>
          </NForm>
        </template>
        <template v-else>
          <h4 class="settings-section-title">{{ t('layout.switchLanguage') }}</h4>
          <NSelect
            v-model:value="currentLocale"
            :options="localeOptions"
            class="locale-select"
          />
        </template>
        </div>
      </div>
    </div>

  </NModal>

  <NModal
    v-model:show="showLogoutConfirm"
    preset="card"
    class="logout-confirm-modal"
    :title="t('layout.logoutConfirmTitle')"
  >
    <p class="logout-confirm-message">{{ t('layout.logoutConfirmMessage') }}</p>
    <div class="logout-confirm-actions">
      <NButton @click="showLogoutConfirm = false">{{ t('profile.cancel') }}</NButton>
      <NButton type="error" :loading="loggingOut" @click="handleLogout">
        {{ t('auth.logout') }}
      </NButton>
    </div>
  </NModal>

  <NotificationPanel />
</template>

<style scoped src="./MainLayout.css"></style>
