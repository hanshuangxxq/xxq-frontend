<script setup lang="ts">
import { computed, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NLayout, NLayoutSider, NLayoutContent, NMenu, NAvatar, NSpace } from 'naive-ui'
import { useAuthStore } from '@/stores/useAuthStore'
import { avatarUrl } from '@/shared/utils/avatar'
import logoutSvg from '@/icons/logout.svg'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const menuOptions = computed(() => [
  { label: t('profile.title'), key: '/profile' },
])

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
              :src="avatarUrl(authStore.user?.avatar)"
              round
            >
              {{ authStore.user?.name?.charAt(0) }}
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

        <div style="margin-top: auto; padding: 0 16px 16px">
          <NMenu
            :options="[
              {
                label: t('auth.logout'),
                key: 'logout',
                icon: () =>
                  h('img', {
                    src: logoutSvg,
                    style: { width: '18px', height: '18px' },
                  }),
              },
            ]"
            @update:value="handleLogout"
          />
        </div>
      </div>
    </NLayoutSider>

    <NLayoutContent content-style="background: #fff; min-height: 100vh">
      <RouterView />
    </NLayoutContent>
  </NLayout>
</template>
