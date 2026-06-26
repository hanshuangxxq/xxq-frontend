<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSelect,
  NCard,
  NSpace,
  NGrid,
  NGi,
  NAvatar,
  useMessage,
} from 'naive-ui'
import { useAuthStore } from '@/stores/useAuthStore'
import { useAvatar } from '@/shared/composables/useAvatar'
import { refreshToken } from '@/shared/tokenManager'
import { authApi } from '../api'
import type { UserProfile } from '../types'

const { t } = useI18n()
const authStore = useAuthStore()
const message = useMessage()

const profile = ref<UserProfile | null>(null)
const editing = ref(false)
const saving = ref(false)
const uploading = ref(false)

const genderOptions = [
  { label: t('profile.notSet'), value: '' },
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
]

const form = ref({
  email: '',
  phone: '',
  gender: '',
  description: '',
})

const avatarSrc = useAvatar(computed(() => profile.value?.avatar ?? null))

const isStudent = computed(() => profile.value?.userType === 'student')
const isTeacher = computed(() => profile.value?.userType === 'teacher')
const isDean = computed(() => profile.value?.userType === 'dean')

const userTypeLabel = computed(() => {
  const type = profile.value?.userType
  if (type === 'student') return t('profile.student')
  if (type === 'teacher') return t('profile.teacher')
  if (type === 'dean') return t('profile.dean')
  return ''
})

const statusLabel = computed(() =>
  profile.value?.status === 1 ? t('profile.statusActive') : t('profile.statusInactive'),
)

async function loadProfile() {
  try {
    const userId = authStore.user!.userId
    const tokenId = refreshToken.value
    profile.value = tokenId
      ? await authApi.getProfileWithToken(userId, tokenId)
      : await authApi.getProfile(userId)
  } catch (e) {
    message.error((e as Error).message || t('profile.loadFail'))
  }
}

function startEdit() {
  if (!profile.value) return
  form.value = {
    email: profile.value.email ?? '',
    phone: profile.value.phone ?? '',
    gender: profile.value.gender ?? '',
    description: profile.value.description ?? '',
  }
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

async function saveProfile() {
  saving.value = true
  try {
    const userId = authStore.user!.userId
    await authApi.updateProfile(userId, {
      email: form.value.email || undefined,
      phone: form.value.phone || undefined,
      gender: form.value.gender || undefined,
      description: form.value.description || undefined,
    })
    message.success(t('profile.saveSuccess'))
    await loadProfile()
    editing.value = false
  } catch (e) {
    message.error((e as Error).message || t('profile.saveFail'))
  } finally {
    saving.value = false
  }
}

async function handleAvatarUpload(file: File) {
  uploading.value = true
  try {
    const userId = authStore.user!.userId
    const filename = await authApi.uploadAvatar(userId, file)
    if (authStore.user) {
      authStore.user.avatar = filename
    }
    await loadProfile()
    message.success(t('profile.saveSuccess'))
  } catch (e) {
    message.error((e as Error).message || t('profile.saveFail'))
  } finally {
    uploading.value = false
  }
}

function triggerUpload() {
  document.getElementById('avatar-upload-input')?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    handleAvatarUpload(file)
  }
  input.value = ''
}

function displayValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return t('profile.notSet')
  return String(val)
}

onMounted(loadProfile)
</script>

<template>
  <div style="max-width: 720px; margin: 24px auto; padding: 0 16px">
    <NSpace justify="space-between" align="center" style="margin-bottom: 16px">
      <h2 style="margin: 0">{{ $t('profile.title') }}</h2>
      <NButton v-if="!editing" type="primary" @click="startEdit">
        {{ $t('profile.editProfile') }}
      </NButton>
    </NSpace>

    <NCard>
      <!-- Avatar section -->
      <div style="text-align: center; margin-bottom: 24px">
        <div
          style="cursor: pointer; display: inline-block; position: relative"
          @click="triggerUpload"
        >
          <NAvatar
            :size="80"
            :src="avatarSrc"
            round
            :style="{ opacity: uploading ? 0.5 : 1 }"
          >
            <template v-if="!avatarSrc">{{ profile?.name?.charAt(0) }}</template>
            <template #fallback>{{ profile?.name?.charAt(0) }}</template>
          </NAvatar>
          <div
            style="
              position: absolute;
              bottom: 0;
              right: 0;
              background: #2080f0;
              color: #fff;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              line-height: 1;
            "
          >
            +
          </div>
        </div>
        <input
          id="avatar-upload-input"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          style="display: none"
          @change="onFileChange"
        />
      </div>

      <NForm v-if="profile" label-placement="left" label-width="100">
        <NGrid :cols="2" :x-gap="24">
          <NGi>
            <NFormItem :label="$t('profile.name')">
              <span>{{ profile.name }}</span>
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem :label="$t('profile.account')">
              <span>{{ authStore.user?.account }}</span>
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem :label="$t('profile.userType')">
              <span>{{ userTypeLabel }}</span>
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem :label="$t('profile.status')">
              <span>{{ statusLabel }}</span>
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem :label="$t('profile.email')">
              <NInput v-if="editing" v-model:value="form.email" />
              <span v-else>{{ displayValue(profile.email) }}</span>
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem :label="$t('profile.phone')">
              <NInput v-if="editing" v-model:value="form.phone" />
              <span v-else>{{ displayValue(profile.phone) }}</span>
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem :label="$t('profile.gender')">
              <NSelect
                v-if="editing"
                v-model:value="form.gender"
                :options="genderOptions"
              />
              <span v-else>{{ displayValue(profile.gender) }}</span>
            </NFormItem>
          </NGi>

          <!-- Student fields -->
          <template v-if="isStudent">
            <NGi>
              <NFormItem :label="$t('profile.identifier')">
                <span>{{ displayValue(profile.identifier) }}</span>
              </NFormItem>
            </NGi>
            <NGi>
              <NFormItem :label="$t('profile.major')">
                <span>{{ displayValue(profile.major) }}</span>
              </NFormItem>
            </NGi>
            <NGi>
              <NFormItem :label="$t('profile.grade')">
                <span>{{ displayValue(profile.grade) }}</span>
              </NFormItem>
            </NGi>
            <NGi>
              <NFormItem :label="$t('profile.className')">
                <span>{{ displayValue(profile.className) }}</span>
              </NFormItem>
            </NGi>
            <NGi>
              <NFormItem :label="$t('profile.enrollmentYear')">
                <span>{{ displayValue(profile.enrollmentYear) }}</span>
              </NFormItem>
            </NGi>
          </template>

          <!-- Teacher fields -->
          <template v-if="isTeacher">
            <NGi>
              <NFormItem :label="$t('profile.identifier')">
                <span>{{ displayValue(profile.identifier) }}</span>
              </NFormItem>
            </NGi>
            <NGi>
              <NFormItem :label="$t('profile.title')">
                <span>{{ displayValue(profile.title) }}</span>
              </NFormItem>
            </NGi>
            <NGi>
              <NFormItem :label="$t('profile.department')">
                <span>{{ displayValue(profile.department) }}</span>
              </NFormItem>
            </NGi>
          </template>

          <!-- Dean fields -->
          <template v-if="isDean">
            <NGi>
              <NFormItem :label="$t('profile.identifier')">
                <span>{{ displayValue(profile.identifier) }}</span>
              </NFormItem>
            </NGi>
            <NGi>
              <NFormItem :label="$t('profile.department')">
                <span>{{ displayValue(profile.department) }}</span>
              </NFormItem>
            </NGi>
            <NGi>
              <NFormItem :label="$t('profile.position')">
                <span>{{ displayValue(profile.position) }}</span>
              </NFormItem>
            </NGi>
          </template>

          <NGi :span="2">
            <NFormItem :label="$t('profile.description')">
              <NInput v-if="editing" v-model:value="form.description" type="textarea" />
              <span v-else>{{ displayValue(profile.description) }}</span>
            </NFormItem>
          </NGi>

          <NGi>
            <NFormItem :label="$t('profile.lastLoginTime')">
              <span>{{ displayValue(profile.lastLoginTime) }}</span>
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem :label="$t('profile.createTime')">
              <span>{{ displayValue(profile.createTime) }}</span>
            </NFormItem>
          </NGi>
        </NGrid>
      </NForm>
    </NCard>

    <NSpace v-if="editing" justify="end" style="margin-top: 16px">
      <NButton @click="cancelEdit">{{ $t('profile.cancel') }}</NButton>
      <NButton type="primary" :loading="saving" @click="saveProfile">
        {{ $t('profile.save') }}
      </NButton>
    </NSpace>
  </div>
</template>
