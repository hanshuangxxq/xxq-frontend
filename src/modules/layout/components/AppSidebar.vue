<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NAvatar, NBadge, NButton, NDropdown, NIcon, NMenu, NModal } from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePreferenceStore } from '@/stores/usePreferenceStore'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { useAvatar } from '@/shared/composables/useAvatar'
import { resolveMenuForRole, matchActiveKey } from '../menu'
import SettingsModal from './SettingsModal.vue'
import sidebarHideSvg from '@/icons/sidebar_hide.svg'
import sidebarShowSvg from '@/icons/sidebar_show.svg'
import selectSvg from '@/icons/select.svg'
import settingSvg from '@/icons/setting.svg'
import logoutSvg from '@/icons/logout.svg'
import informationSvg from '@/icons/information.svg'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const preferenceStore = usePreferenceStore()
const notificationStore = useNotificationStore()

/** 侧边栏展开状态:读写都落到 preferenceStore,变更后自动浅合并保存到后端 */
const collapsed = computed({
  get: () => preferenceStore.sidebarCollapsed,
  set: (v: boolean) => preferenceStore.setSidebarCollapsed(v),
})

const showSettings = ref(false)
const showLogoutConfirm = ref(false)
const loggingOut = ref(false)

const avatarSrc = useAvatar(computed(() => authStore.user?.avatar ?? null))

function renderSvgIcon(svgSrc: string) {
  return () =>
    h(NIcon, null, {
      default: () => h('img', { src: svgSrc, style: { width: '18px', height: '18px' } }),
    })
}

/** 当前角色可见的菜单(顶部独立项 + 过滤后的非空分组) */
const menu = computed(() => resolveMenuForRole(authStore.user?.userType))

const menuOptions = computed<MenuOption[]>(() => [
  ...menu.value.top.map((item) => ({
    label: t(item.labelKey),
    key: item.key,
    icon: renderSvgIcon(item.icon),
  })),
  ...menu.value.groups.map((group) => ({
    label: t(group.labelKey),
    key: group.key,
    icon: renderSvgIcon(group.icon),
    children: group.children.map((child) => ({ label: t(child.labelKey), key: child.key })),
  })),
])

/** 菜单高亮:最长前缀匹配,参数化子路由(如 /selection/:id)自动高亮其父菜单项 */
const activeKey = computed(() => {
  const keys = [
    ...menu.value.top.map((item) => item.key),
    ...menu.value.groups.flatMap((group) => group.children.map((child) => child.key)),
  ]
  return matchActiveKey(route.path, keys)
})

/** 当前激活项所属分组的 key(激活的是顶部独立项或无匹配时为 undefined) */
const activeGroupKey = computed(
  () => menu.value.groups.find((g) => g.children.some((c) => c.key === activeKey.value))?.key,
)

/**
 * 分组展开状态(手风琴式):默认仅当前页面所属分组展开,其余收起;
 * 用户可手动展开其它分组,路由切换或侧边栏由收起切回展开时重置为默认态。
 */
const expandedKeys = ref<string[]>([])
watch(
  activeGroupKey,
  (key) => {
    expandedKeys.value = key ? [key] : []
  },
  { immediate: true },
)
watch(collapsed, (isCollapsed) => {
  if (!isCollapsed) {
    expandedKeys.value = activeGroupKey.value ? [activeGroupKey.value] : []
  }
})

function handleMenuClick(key: string) {
  router.push(key)
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

const userMenuOptions = computed(() => [
  { label: renderNotificationLabel, key: 'notification', icon: renderSvgIcon(informationSvg) },
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
    // 先跳转到登录页,跳转完成前不清空用户,避免当前页面的角色守卫短暂显示「无权限」
    await router.replace('/login')
  } finally {
    authStore.clearSession()
    loggingOut.value = false
  }
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-card">
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
          :collapsed-width="36"
          :root-indent="20"
          :indent="24"
          :expanded-keys="expandedKeys"
          @update:expanded-keys="expandedKeys = $event"
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
  </aside>

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

  <SettingsModal :show="showSettings" @update:show="showSettings = $event" />
</template>

<style scoped src="./AppSidebar.css"></style>
