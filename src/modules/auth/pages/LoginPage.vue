<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NForm, NFormItem, NInput, NButton, NCard, useMessage } from 'naive-ui'
import { useAuthStore } from '@/stores/useAuthStore'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const message = useMessage()

const form = ref({
  account: '',
  password: '',
})

const loading = ref(false)

async function handleLogin() {
  loading.value = true
  try {
    await authStore.login({
      type: 'account',
      data: { account: form.value.account, password: form.value.password },
    })
    message.success(t('auth.login.success'))
    // 线上 / 由 Nginx 直接返回 SEO 落地页,登录后必须显式进入应用内页面
    router.push('/profile')
  } catch {
    // 错误消息已由 api 层统一提示
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <NCard :title="$t('auth.login.title')" class="login-card" bordered>
      <NForm :model="form">
        <NFormItem :label="$t('auth.login.account')">
          <NInput v-model:value="form.account" :placeholder="$t('auth.login.accountPlaceholder')" />
        </NFormItem>
        <NFormItem :label="$t('auth.login.password')">
          <NInput
            v-model:value="form.password"
            type="password"
            :placeholder="$t('auth.login.passwordPlaceholder')"
            @keydown.enter="handleLogin"
          />
        </NFormItem>
        <NButton type="primary" block :loading="loading" @click="handleLogin">
          {{ $t('auth.login.submit') }}
        </NButton>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped src="./LoginPage.css"></style>
