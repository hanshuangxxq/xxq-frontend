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

const genderOptions = computed(() => [
  { label: t('profile.notSet'), value: '' },
  { label: t('profile.genderMale'), value: '男' },
  { label: t('profile.genderFemale'), value: '女' },
])

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
const isDepartmentAdmin = computed(() => profile.value?.userType === 'department')
const isAcademicAdmin = computed(() => profile.value?.userType === 'academic_admin')

const userTypeLabel = computed(() => {
  const type = profile.value?.userType
  if (type === 'student') return t('profile.student')
  if (type === 'teacher') return t('profile.teacher')
  if (type === 'dean') return t('profile.dean')
  if (type === 'department') return t('profile.departmentAdmin')
  if (type === 'academic_admin') return t('profile.academicAdmin')
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
      authStore.persistUser()
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
  <div class="profile-page">
    <NSpace justify="space-between" align="center" class="profile-header">
      <h2 class="profile-title">{{ $t('profile.title') }}</h2>
      <NButton v-if="!editing" type="primary" @click="startEdit">
        {{ $t('profile.editProfile') }}
      </NButton>
    </NSpace>

    <NCard>
      <!-- Avatar section -->
      <div class="profile-avatar-section">
        <div
          class="profile-avatar-wrapper"
          @click="triggerUpload"
        >
          <NAvatar
            :size="80"
            :src="avatarSrc"
            round
            :class="{ 'avatar-uploading': uploading }"
          >
            <template v-if="!avatarSrc">{{ profile?.name?.charAt(0) }}</template>
            <template #fallback>{{ profile?.name?.charAt(0) }}</template>
          </NAvatar>
          <div class="profile-avatar-badge">+</div>
        </div>
        <input
          id="avatar-upload-input"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          class="hidden-input"
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
                <span>{{ displayValue(profile.className?.className) }}</span>
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

          <!-- Department Admin fields -->
          <template v-if="isDepartmentAdmin">
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

          <!-- Academic Admin fields -->
          <template v-if="isAcademicAdmin">
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

    <NSpace v-if="editing" justify="end" class="profile-actions">
      <NButton @click="cancelEdit">{{ $t('profile.cancel') }}</NButton>
      <NButton type="primary" :loading="saving" @click="saveProfile">
        {{ $t('profile.save') }}
      </NButton>
    </NSpace>

  </div>
</template>

<style scoped src="./ProfilePage.css"></style>
