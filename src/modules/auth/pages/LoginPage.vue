<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NForm, NFormItem, NInput, NButton, NCard, useMessage } from 'naive-ui'
import { useAuthStore } from '@/stores/useAuthStore'
import { useLoginGuard } from '@/modules/auth/useLoginGuard'
import { startClientIpDetection } from '@/shared/utils/clientIp'

const { t } = useI18n()
const authStore = useAuthStore()
const message = useMessage()
const { isLocked, lockedSeconds, recordFailure, recordSuccess } = useLoginGuard()

// 进入登录页即开始探测私网 IP,用户输入凭据期间即可完成,提交登录时无需等待
onMounted(startClientIpDetection)

const form = ref({
  account: '',
  password: '',
})

const loading = ref(false)

async function handleLogin() {
  // 请求进行中或处于锁定期时直接忽略,防止回车键/连点绕过按钮 loading 状态
  if (loading.value || isLocked.value) return
  loading.value = true
  try {
    await authStore.login({
      type: 'account',
      data: { account: form.value.account, password: form.value.password },
    })
    recordSuccess()
    message.success(t('auth.login.success'))
    // 登录后回到落地页(线上 / 由 Nginx 返回 SEO 页,展示已登录头像菜单);
    // 必须整页跳转:router.push('/') 只会命中 SPA 内部 redirect 到 /profile
    location.replace('/')
  } catch {
    // 错误消息已由 api 层统一提示;这里只统计失败次数,触发锁定时再提示
    const waitSeconds = recordFailure()
    if (waitSeconds > 0) {
      message.warning(t('auth.login.tooManyAttempts', { seconds: waitSeconds }))
    }
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
        <NButton type="primary" block :loading="loading" :disabled="isLocked" @click="handleLogin">
          {{
            isLocked
              ? $t('auth.login.lockedRetry', { seconds: lockedSeconds })
              : $t('auth.login.submit')
          }}
        </NButton>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped src="./LoginPage.css"></style>
