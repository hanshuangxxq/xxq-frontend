<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NButton,
  NInput,
  NSelect,
  NDataTable,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { batchImportUsers } from '../api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { BatchImportUser, BatchImportDetail } from '../types'

const { t } = useI18n()
const message = useMessage()
const { canManageBatchImport } = useRoleCheck()

const userTypeOptions = computed(() => [
  { label: t('batch-import.student'), value: 'student' },
  { label: t('batch-import.teacher'), value: 'teacher' },
])

const genderOptions = computed(() => [
  { label: t('batch-import.male'), value: '男' },
  { label: t('batch-import.female'), value: '女' },
  { label: t('batch-import.unknown'), value: '未知' },
])

interface RowData {
  key: number
  username: string
  password: string
  userType: 'student' | 'teacher'
  identifier: string
  className: string
  gender: string
  department: string
}

let nextKey = 0

function createRow(): RowData {
  return {
    key: nextKey++,
    username: '',
    password: '',
    userType: 'student',
    identifier: '',
    className: '',
    gender: '未知',
    department: '',
  }
}

const rows = ref<RowData[]>([createRow()])
const submitting = ref(false)
const importResult = ref<{
  total: number
  successCount: number
  failCount: number
  details: BatchImportDetail[]
} | null>(null)

function addRow() {
  rows.value = [...rows.value, createRow()]
}

function removeRow(key: number) {
  if (rows.value.length <= 1) return
  rows.value = rows.value.filter((r) => r.key !== key)
}

function validateRows(): string | null {
  for (let i = 0; i < rows.value.length; i++) {
    const row = rows.value[i]!
    if (!row.username.trim()) {
      return t('batch-import.usernameRequired')
    }
    if (!row.password.trim()) {
      return t('batch-import.passwordRequired')
    }
  }
  return null
}

async function handleSubmit() {
  const validationError = validateRows()
  if (validationError) {
    message.warning(validationError)
    return
  }

  submitting.value = true
  try {
    const users: BatchImportUser[] = rows.value.map((row) => ({
      username: row.username.trim(),
      password: row.password,
      userType: row.userType,
      ...(row.identifier.trim() && { identifier: row.identifier.trim() }),
      ...(row.userType === 'student' && row.className.trim() && { className: row.className.trim() }),
      ...(row.gender !== '未知' && { gender: row.gender }),
      ...(row.department.trim() && { department: row.department.trim() }),
    }))

    const result = await batchImportUsers({ users })
    importResult.value = result.data
    message.success(t('batch-import.submitSuccess'))
  } catch (e) {
    message.error((e as Error).message || t('batch-import.submitFail'))
  } finally {
    submitting.value = false
  }
}

const batchImportDetailRowKey = (row: BatchImportDetail) => row.index

const resultColumns: DataTableColumns<BatchImportDetail> = [
  { title: t('batch-import.index'), key: 'index', width: 60 },
  { title: t('batch-import.username'), key: 'username', width: 120, ellipsis: { tooltip: true } },
  {
    title: t('batch-import.status'),
    key: 'success',
    width: 80,
    render(row) {
      return row.success
        ? h(NTag, { type: 'success', size: 'small' }, () => t('batch-import.success'))
        : h(NTag, { type: 'error', size: 'small' }, () => t('batch-import.failed'))
    },
  },
  { title: t('batch-import.message'), key: 'message', ellipsis: { tooltip: true } },
]

function getIdentifierPlaceholder(userType: 'student' | 'teacher'): string {
  return userType === 'student' ? t('batch-import.identifierStudent') : t('batch-import.identifierTeacher')
}

function getDepartmentLabel(userType: 'student' | 'teacher'): string {
  return userType === 'student' ? t('batch-import.departmentStudent') : t('batch-import.departmentTeacher')
}
</script>

<template>
  <div class="bi-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('batch-import.title')">
        <template #header-extra>
          <NButton type="primary" :loading="submitting" :disabled="!canManageBatchImport" @click="handleSubmit">
            {{ submitting ? $t('batch-import.submitting') : $t('batch-import.submit') }}
          </NButton>
        </template>

        <div class="bi-toolbar">
          <NButton size="small" @click="addRow">{{ $t('batch-import.addRow') }}</NButton>
        </div>

        <div class="bi-table-wrapper">
          <table class="bi-table">
            <thead>
              <tr>
                <th class="bi-col-num">#</th>
                <th class="bi-col-username">{{ $t('batch-import.username') }} *</th>
                <th class="bi-col-password">{{ $t('batch-import.password') }} *</th>
                <th class="bi-col-type">{{ $t('batch-import.userType') }}</th>
                <th class="bi-col-identifier">{{ $t('batch-import.identifier') }}</th>
                <th class="bi-col-class">{{ $t('batch-import.className') }}</th>
                <th class="bi-col-gender">{{ $t('batch-import.gender') }}</th>
                <th class="bi-col-department">{{ $t('batch-import.department') }}</th>
                <th class="bi-col-action">{{ $t('batch-import.removeRow') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in rows" :key="row.key">
                <td class="bi-col-num">{{ idx + 1 }}</td>
                <td class="bi-col-username">
                  <NInput v-model:value="row.username" size="small" :placeholder="$t('batch-import.username')" />
                </td>
                <td class="bi-col-password">
                  <NInput v-model:value="row.password" type="password" size="small" :placeholder="$t('batch-import.password')" />
                </td>
                <td class="bi-col-type">
                  <NSelect v-model:value="row.userType" :options="userTypeOptions" size="small" />
                </td>
                <td class="bi-col-identifier">
                  <NInput v-model:value="row.identifier" size="small" :placeholder="getIdentifierPlaceholder(row.userType)" />
                </td>
                <td class="bi-col-class">
                  <NInput v-if="row.userType === 'student'" v-model:value="row.className" size="small" :placeholder="$t('batch-import.className')" />
                  <span v-else class="bi-na">—</span>
                </td>
                <td class="bi-col-gender">
                  <NSelect v-model:value="row.gender" :options="genderOptions" size="small" />
                </td>
                <td class="bi-col-department">
                  <NInput v-model:value="row.department" size="small" :placeholder="getDepartmentLabel(row.userType)" />
                </td>
                <td class="bi-col-action">
                  <NButton size="tiny" :disabled="rows.length <= 1" @click="removeRow(row.key)">
                    {{ $t('batch-import.removeRow') }}
                  </NButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </NCard>

      <NCard v-if="importResult" :title="$t('batch-import.importResult')">
        <div class="bi-result-summary">
          <NSpace>
            <span>{{ $t('batch-import.total') }}: <strong>{{ importResult.total }}</strong></span>
            <span>{{ $t('batch-import.successCount') }}: <strong class="bi-success">{{ importResult.successCount }}</strong></span>
            <span>{{ $t('batch-import.failCount') }}: <strong class="bi-fail">{{ importResult.failCount }}</strong></span>
          </NSpace>
        </div>
        <NDataTable
          :columns="resultColumns"
          :data="importResult.details"
          :row-key="batchImportDetailRowKey"
          :bordered="false"
          :single-line="false"
          size="small"
        />
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped src="./BatchImportPage.css"></style>
