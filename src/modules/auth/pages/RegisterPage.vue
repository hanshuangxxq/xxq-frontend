<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSelect,
  NCard,
  useMessage,
} from 'naive-ui'
import { useAuthStore } from '@/stores/useAuthStore'
import type { UserType } from '../types'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const message = useMessage()

const userTypeOptions = computed(() => [
  { label: t('auth.register.student'), value: 'student' },
  { label: t('auth.register.teacher'), value: 'teacher' },
  { label: t('auth.register.dean'), value: 'dean' },
])

const form = ref({
  account: '',
  password: '',
  confirmPassword: '',
  userType: 'student' as UserType,
  identifier: '',
})

const loading = ref(false)

async function handleRegister() {
  if (form.value.password !== form.value.confirmPassword) {
    message.warning(t('auth.register.passwordMismatch'))
    return
  }
  loading.value = true
  try {
    await authStore.register({
      account: form.value.account,
      password: form.value.password,
      userType: form.value.userType,
      identifier: form.value.identifier || undefined,
    })
    message.success(t('auth.register.success'))
    router.push('/login')
  } catch (e) {
    message.error((e as Error).message || t('auth.register.fail'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-page">
    <NCard :title="$t('auth.register.title')" class="register-card" bordered>
      <NForm :model="form">
        <NFormItem :label="$t('auth.register.account')">
          <NInput v-model:value="form.account" :placeholder="$t('auth.register.accountPlaceholder')" />
        </NFormItem>
        <NFormItem :label="$t('auth.register.password')">
          <NInput
            v-model:value="form.password"
            type="password"
            :placeholder="$t('auth.register.passwordPlaceholder')"
          />
        </NFormItem>
        <NFormItem :label="$t('auth.register.confirmPassword')">
          <NInput
            v-model:value="form.confirmPassword"
            type="password"
            :placeholder="$t('auth.register.confirmPasswordPlaceholder')"
          />
        </NFormItem>
        <NFormItem :label="$t('auth.register.userType')">
          <NSelect
            v-model:value="form.userType"
            :options="userTypeOptions"
          />
        </NFormItem>
        <NFormItem :label="$t('auth.register.identifier')">
          <NInput v-model:value="form.identifier" :placeholder="$t('auth.register.identifierPlaceholder')" />
        </NFormItem>
        <NButton
          type="primary"
          block
          :loading="loading"
          @click="handleRegister"
        >
          {{ $t('auth.register.submit') }}
        </NButton>
      </NForm>
      <div class="register-links">
        <NButton text type="primary" @click="router.push('/login')">
          {{ $t('auth.register.toLogin') }}
        </NButton>
      </div>
    </NCard>
  </div>
</template>

<style scoped src="./RegisterPage.css"></style>
