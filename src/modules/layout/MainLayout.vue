<script setup lang="ts">
/**
 * 主布局：侧边栏 + 内容区（面包屑、路由出口带淡入滑出过渡、通知面板）。
 * 挂载时连接通知通道并加载个性化偏好；卸载时断开通知、复位偏好状态。
 */
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NBreadcrumb, NBreadcrumbItem, useMessage } from 'naive-ui'
import { usePreferenceStore } from '@/stores/usePreferenceStore'
import { useNotificationStore } from '@/stores/useNotificationStore'
import NotificationPanel from '@/modules/notification/NotificationPanel.vue'
import AppSidebar from './components/AppSidebar.vue'

const { t } = useI18n()
const route = useRoute()
const preferenceStore = usePreferenceStore()
const notificationStore = useNotificationStore()
const message = useMessage()

/** 侧边栏收起时内容区让位宽度随之收窄(只读;折叠交互在 AppSidebar 内) */
const collapsed = computed(() => preferenceStore.sidebarCollapsed)

/** 面包屑:取 matched 路由链上声明了 meta.titleKey 的记录 */
const breadcrumbs = computed(() =>
  route.matched
    .filter((r) => typeof r.meta.titleKey === 'string')
    .map((r) => ({ key: r.path, label: t(r.meta.titleKey as string) })),
)

onMounted(() => {
  notificationStore.setToastHandler((n) => {
    message.info(`${t('notification.newMessage')}：${n.title}`)
  })
  notificationStore.connect()
  preferenceStore.load()
})

onUnmounted(() => {
  notificationStore.disconnect()
  notificationStore.setToastHandler(null)
  preferenceStore.reset()
})
</script>

<template>
  <div class="main-layout">
    <AppSidebar />

    <div class="main-content" :class="{ 'sidebar-collapsed': collapsed }">
      <div v-if="breadcrumbs.length" class="content-header">
        <NBreadcrumb>
          <NBreadcrumbItem v-for="item in breadcrumbs" :key="item.key">
            {{ item.label }}
          </NBreadcrumbItem>
        </NBreadcrumb>
      </div>
      <RouterView v-slot="{ Component }">
        <Transition name="fade-slide" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </div>

    <NotificationPanel />
  </div>
</template>

<style scoped src="./MainLayout.css"></style>
