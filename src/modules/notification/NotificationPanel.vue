<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NDrawer,
  NDrawerContent,
  NTabs,
  NTab,
  NSpin,
  NEmpty,
  NTag,
  NButton,
  NPopconfirm,
  NTime,
} from 'naive-ui'
import { useNotificationStore } from '@/stores/useNotificationStore'
import type { NotificationFilter } from '@/modules/notification/types'

const { t } = useI18n()
const store = useNotificationStore()

const show = computed({
  get: () => store.showPanel,
  set: (v: boolean) => (v ? store.openPanel() : store.closePanel()),
})

const filter = computed({
  get: () => store.activeStatus,
  set: (v: NotificationFilter) => {
    void store.setStatus(v)
  },
})

function toTimestamp(time: string): number {
  return new Date(time).getTime()
}

async function handleMarkRead(id: number) {
  await store.markRead(id)
}

async function handleDelete(id: number) {
  await store.remove(id)
}
</script>

<template>
  <NDrawer v-model:show="show" :width="420" placement="right">
    <NDrawerContent closable :title="t('notification.title')">
      <div class="panel-toolbar">
        <NButton text type="primary" :disabled="store.unreadCount === 0" @click="store.readAll()">
          {{ t('notification.markAllRead') }}
        </NButton>
      </div>

      <NTabs v-model:value="filter" type="line" animated>
        <NTab name="all">{{ t('notification.all') }}</NTab>
        <NTab name="unread">
          {{ t('notification.unread') }}
          <span v-if="store.unreadCount > 0" class="unread-badge">{{ store.unreadCount }}</span>
        </NTab>
        <NTab name="read">{{ t('notification.read') }}</NTab>
      </NTabs>

      <NSpin :show="store.loading">
        <NEmpty
          v-if="store.notifications.length === 0"
          :description="t('notification.empty')"
          class="empty-state"
        />
        <div v-else class="notification-list">
          <div
            v-for="n in store.notifications"
            :key="n.id"
            class="notification-item"
            :class="{ unread: n.isRead === 0 }"
          >
            <div class="item-header">
              <NTag size="small" :bordered="false">{{ n.type }}</NTag>
              <NTime :time="toTimestamp(n.createTime)" type="datetime" class="item-time" />
            </div>
            <div class="item-title">{{ n.title }}</div>
            <div v-if="n.content" class="item-content">{{ n.content }}</div>
            <div class="item-actions">
              <NButton
                v-if="n.isRead === 0"
                size="tiny"
                text
                type="primary"
                @click="handleMarkRead(n.id)"
              >
                {{ t('notification.markRead') }}
              </NButton>
              <NPopconfirm @positive-click="handleDelete(n.id)">
                <template #trigger>
                  <NButton size="tiny" text type="error">{{ t('notification.delete') }}</NButton>
                </template>
                {{ t('notification.deleteConfirm') }}
              </NPopconfirm>
            </div>
          </div>
        </div>
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped src="./NotificationPanel.css"></style>
