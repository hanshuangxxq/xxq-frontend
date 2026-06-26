<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NLayout, NLayoutSider, NLayoutContent, NMenu, NAvatar, NSpace, NSelect } from 'naive-ui'
import { useAuthStore } from '@/stores/useAuthStore'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { avatarUrl } from '@/shared/utils/avatar'
import type { SupportedLocale } from '@/i18n'
import logoutSvg from '@/icons/logout.svg'
import selectSvg from '@/icons/select.svg'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const localeStore = useLocaleStore()

const localeOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
]

const currentLocale = computed({
  get: () => localeStore.current,
  set: (v) => localeStore.setLocale(v as SupportedLocale),
})

const avatarSrc = computed(() => avatarUrl(authStore.user?.avatar))

const menuOptions = computed(() => {
  const items = [{ label: t('profile.title'), key: '/profile' }]
  if (authStore.user?.userType === 'student') {
    items.push({ label: t('course.title'), key: '/course' })
  }
  return items
})

const activeKey = computed(() => route.path)

function handleMenuClick(key: string) {
  router.push(key)
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <NLayout has-sider style="min-height: 100vh">
    <NLayoutSider bordered :width="220">
      <div
        style="
          background: #e8eaed;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        "
      >
        <div style="padding: 24px 16px 16px">
          <NSpace vertical align="center" :size="8">
            <NAvatar
              :size="56"
              :src="avatarSrc"
              round
            >
              <template v-if="!avatarSrc">{{ authStore.user?.name?.charAt(0) }}</template>
              <template #fallback>{{ authStore.user?.name?.charAt(0) }}</template>
            </NAvatar>
            <span style="font-size: 14px; font-weight: 500">{{ authStore.user?.name }}</span>
          </NSpace>
        </div>

        <NMenu
          :value="activeKey"
          :options="menuOptions"
          :root-indent="20"
          @update:value="handleMenuClick"
        />

        <div
          style="
            margin-top: auto;
            padding: 8px 0;
            background: #f0eaea;
            border-top: 1px solid #e0d4d4;
          "
        >
          <div style="padding: 0 12px; margin-bottom: 6px">
            <NSelect
              v-model:value="currentLocale"
              :options="localeOptions"
              size="tiny"
              :consistent-menu-width="false"
              style="width: 100%"
              :theme-overrides="{ peers: { InternalSelection: { color: '#faf0f0' } } }"
            >
              <template #arrow>
                <img :src="selectSvg" style="width: 14px; height: 14px" />
              </template>
            </NSelect>
          </div>
          <div class="logout-btn" @click="handleLogout">
            <img :src="logoutSvg" style="width: 18px; height: 18px" />
            <span>{{ t('auth.logout') }}</span>
          </div>
        </div>
      </div>
    </NLayoutSider>

    <NLayoutContent content-style="background: #fff; min-height: 100vh">
      <RouterView />
    </NLayoutContent>
  </NLayout>
</template>

<style scoped>
.logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  cursor: pointer;
  color: #777;
  font-size: 14px;
  transition: background 0.15s, color 0.15s;
}
.logout-btn:hover {
  background: #e8d0d0;
  color: #333;
}
</style>
