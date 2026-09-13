<script setup lang="ts">
/**
 * 主题冲突弹窗：本机 localStorage 主题与后端个性化偏好不一致时强制用户选择，
 * 不可关闭/点遮罩/Esc 退出，必须显式选边后弹窗才会消失。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NButton } from 'naive-ui'
import { usePreferenceStore } from '@/stores/usePreferenceStore'
import type { ThemeMode } from '@/stores/useThemeStore'

const { t } = useI18n()
const preferenceStore = usePreferenceStore()

/** 冲突信息：local 为本机主题、remote 为远端主题；无冲突时为 null */
const conflict = computed(() => preferenceStore.themeConflict)

const themeLabelKeys: Record<ThemeMode, string> = {
  light: 'layout.themeLight',
  dark: 'layout.themeDark',
  system: 'layout.themeSystem',
}

const localLabel = computed(() => (conflict.value ? t(themeLabelKeys[conflict.value.local]) : ''))
const remoteLabel = computed(() => (conflict.value ? t(themeLabelKeys[conflict.value.remote]) : ''))

/** 保留本机主题并回写远端 */
function useLocal() {
  preferenceStore.resolveThemeConflict(false)
}

/** 采用远端主题并覆盖本机 */
function useRemote() {
  preferenceStore.resolveThemeConflict(true)
}
</script>

<template>
  <NModal
    :show="!!conflict"
    preset="card"
    class="theme-conflict-dialog"
    :title="t('layout.themeConflictTitle')"
    :closable="false"
    :mask-closable="false"
    :close-on-esc="false"
  >
    <p class="conflict-message">
      {{ t('layout.themeConflictMessage', { local: localLabel, remote: remoteLabel }) }}
    </p>
    <div class="conflict-actions">
      <NButton @click="useLocal">
        {{ t('layout.themeConflictUseLocal', { theme: localLabel }) }}
      </NButton>
      <NButton type="primary" @click="useRemote">
        {{ t('layout.themeConflictUseRemote', { theme: remoteLabel }) }}
      </NButton>
    </div>
  </NModal>
</template>

<style scoped src="./ThemeConflictDialog.css"></style>
