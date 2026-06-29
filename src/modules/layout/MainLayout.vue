<script setup lang="ts">
import { ref, computed, h } from 'vue'
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
  useMessage,
} from 'naive-ui'
import { useAuthStore } from '@/stores/useAuthStore'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { useAvatar } from '@/shared/composables/useAvatar'
import { authApi } from '@/modules/auth/api'
import type { SupportedLocale } from '@/i18n'
import sidebarHideSvg from '@/icons/sidebar_hide.svg'
import sidebarShowSvg from '@/icons/sidebar_show.svg'
import selectSvg from '@/icons/select.svg'
import perInfoSvg from '@/icons/perInfo.svg'
import logoutSvg from '@/icons/logout.svg'
import couSelSvg from '@/icons/couSel.svg'
import settingSvg from '@/icons/setting.svg'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const localeStore = useLocaleStore()
const message = useMessage()

const collapsed = ref(false)
const showSettings = ref(false)
const settingsTab = ref<'password' | 'language'>('password')

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

const menuOptions = computed(() => {
  const items: Array<{ label: string; key: string; icon?: () => ReturnType<typeof h> }> = [
    { label: t('profile.title'), key: '/profile', icon: renderSvgIcon(perInfoSvg) },
  ]
  if (authStore.user?.userType === 'student') {
    items.push({ label: t('course.title'), key: '/course', icon: renderSvgIcon(couSelSvg) })
  }
  return items
})

const activeKey = computed(() => route.path)

function handleMenuClick(key: string) {
  router.push(key)
}

const userMenuOptions = computed(() => {
  if (collapsed.value) {
    return [
      { key: 'settings', icon: renderSvgIcon(settingSvg) },
      { type: 'divider' as const, key: 'divider' },
      { key: 'logout', icon: renderSvgIcon(logoutSvg) },
    ]
  }
  return [
    { label: t('layout.settings'), key: 'settings', icon: renderSvgIcon(settingSvg) },
    { type: 'divider' as const, key: 'divider' },
    { label: t('auth.logout'), key: 'logout', icon: renderSvgIcon(logoutSvg) },
  ]
})

function handleUserMenuSelect(key: string) {
  if (key === 'settings') {
    showSettings.value = true
  } else if (key === 'logout') {
    handleLogout()
  }
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
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
          <span class="project-name">{{ t('layout.projectName') }}</span>
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
            placement="top-end"
            @select="handleUserMenuSelect"
          >
            <div class="dropdown-hitbox"></div>
          </NDropdown>
          <img :src="selectSvg" class="dropdown-arrow" />
        </div>
      </div>
    </NLayoutSider>

    <NLayoutContent class="main-content">
      <RouterView />
    </NLayoutContent>
  </NLayout>

  <NModal
    v-model:show="showSettings"
    preset="card"
    :title="t('layout.settings')"
    class="settings-modal"
    :segmented="{ content: 'soft', footer: 'soft' }"
  >
    <div class="settings-layout">
      <div class="settings-nav">
        <div
          class="settings-nav-item"
          :class="{ active: settingsTab === 'password' }"
          @click="settingsTab = 'password'"
        >
          {{ t('layout.changePassword') }}
        </div>
        <div
          class="settings-nav-item"
          :class="{ active: settingsTab === 'language' }"
          @click="settingsTab = 'language'"
        >
          {{ t('layout.switchLanguage') }}
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

    <template #footer>
      <NButton @click="showSettings = false">{{ t('layout.close') }}</NButton>
    </template>
  </NModal>
</template>

<style scoped src="./MainLayout.css"></style>
