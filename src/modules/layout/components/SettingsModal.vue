<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSelect,
  NRadioGroup,
  NRadioButton,
  useMessage,
} from 'naive-ui'
import { useAuthStore } from '@/stores/useAuthStore'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { useThemeStore, type ThemeMode } from '@/stores/useThemeStore'
import { usePreferenceStore } from '@/stores/usePreferenceStore'
import { authApi } from '@/modules/auth/api'
import type { SupportedLocale } from '@/i18n'
import closeSvg from '@/icons/close.svg'

defineProps<{
  show: boolean
}>()
const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const localeStore = useLocaleStore()
const themeStore = useThemeStore()
const preferenceStore = usePreferenceStore()
const message = useMessage()

const settingsTab = ref<'password' | 'language' | 'appearance'>('language')

const localeOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
]

/** 语言/主题都经 preferenceStore 写入,自动浅合并同步到后端 */
const currentLocale = computed({
  get: () => localeStore.current,
  set: (v) => preferenceStore.setLang(v as SupportedLocale),
})

const themeMode = computed<ThemeMode>({
  get: () => themeStore.mode,
  set: (v) => preferenceStore.setTheme(v),
})

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
  } catch {
    // 错误消息已由 api 层统一提示
  } finally {
    changingPassword.value = false
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="settings-modal"
    content-style="padding: 0; margin: 0"
    :segmented="{ content: 'soft', footer: 'soft' }"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="settings-layout">
      <img :src="closeSvg" class="settings-close-btn" @click="emit('update:show', false)" />
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
          <div
            class="settings-nav-item"
            :class="{ active: settingsTab === 'appearance' }"
            @click="settingsTab = 'appearance'"
          >
            {{ t('layout.appearance') }}
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
          <template v-else-if="settingsTab === 'language'">
            <h4 class="settings-section-title">{{ t('layout.switchLanguage') }}</h4>
            <NSelect v-model:value="currentLocale" :options="localeOptions" class="locale-select" />
          </template>
          <template v-else>
            <h4 class="settings-section-title">{{ t('layout.appearance') }}</h4>
            <NRadioGroup v-model:value="themeMode">
              <NRadioButton value="light">{{ t('layout.themeLight') }}</NRadioButton>
              <NRadioButton value="dark">{{ t('layout.themeDark') }}</NRadioButton>
              <NRadioButton value="system">{{ t('layout.themeSystem') }}</NRadioButton>
            </NRadioGroup>
          </template>
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped src="./SettingsModal.css"></style>
