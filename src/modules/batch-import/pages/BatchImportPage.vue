<script setup lang="ts">
/**
 * 批量导入页(仅教务管理员):以可编辑表格逐行录入学生/教师账号(用户名/密码必填),
 * 一次性提交批量创建;提交成功后下方展示逐条导入结果与失败原因。
 */
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
  NText,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { batchImportUsers } from '../api'
import { isReportedError } from '@/shared/api'
import { useLoading } from '@/shared/composables/useLoading'
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
  /** 学号（学生）或工号（教师） */
  identifier: string
  /** 年级名，仅学生用。后端 JSON 字段名为历史遗留的 className，实为年级 */
  gradeName: string
  gender: string
  /** 学生填班级名、教师填院系名。后端 JSON 字段名为历史遗留的 department */
  classOrCollege: string
}

// 行主键自增;用独立 key 而非数组下标,删除中间行后剩余行的 key 保持稳定
let nextKey = 0

function createRow(): RowData {
  return {
    key: nextKey++,
    username: '',
    password: '',
    userType: 'student',
    identifier: '',
    gradeName: '',
    gender: '未知',
    classOrCollege: '',
  }
}

const rows = ref<RowData[]>([createRow()])
const { loading: submitting, withLoading: withSubmitting } = useLoading()
// 最近一次导入的汇总结果(总数/成功数/失败数/逐条明细),非空时展示结果卡片
const importResult = ref<{
  total: number
  successCount: number
  failCount: number
  details: BatchImportDetail[]
} | null>(null)

function addRow() {
  rows.value = [...rows.value, createRow()]
}

// 至少保留一行,避免清空后无法提交
function removeRow(key: number) {
  if (rows.value.length <= 1) return
  rows.value = rows.value.filter((r) => r.key !== key)
}

// 提交前的本地校验:用户名/密码必填,其余可选字段留空则不提交
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

// 逐行 trim 后组装请求体:可选字段为空则整字段省略,年级仅学生类型携带,性别"未知"不传
function handleSubmit() {
  const validationError = validateRows()
  if (validationError) {
    message.warning(validationError)
    return
  }

  return withSubmitting(async () => {
    try {
      const users: BatchImportUser[] = rows.value.map((row) => ({
        username: row.username.trim(),
        password: row.password,
        userType: row.userType,
        ...(row.identifier.trim() && { identifier: row.identifier.trim() }),
        // 后端 UserImportItem.className 存的是年级名（历史字段命名），仅学生携带
        ...(row.userType === 'student' &&
          row.gradeName.trim() && { className: row.gradeName.trim() }),
        ...(row.gender !== '未知' && { gender: row.gender }),
        // 后端 UserImportItem.department 对学生是班级名、对教师是院系名
        ...(row.classOrCollege.trim() && { department: row.classOrCollege.trim() }),
      }))

      const result = await batchImportUsers({ users })
      importResult.value = result.data
      message.success(t('batch-import.submitSuccess'))
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('batch-import.submitFail'))
      }
    }
  })
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

function getClassOrCollegePlaceholder(userType: 'student' | 'teacher'): string {
  return userType === 'student'
    ? t('batch-import.classNameStudent')
    : t('batch-import.collegeTeacher')
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
          <NText depth="3">{{ $t('batch-import.chainHint') }}</NText>
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
                <th class="bi-col-class">{{ $t('batch-import.grade') }}</th>
                <th class="bi-col-gender">{{ $t('batch-import.gender') }}</th>
                <th class="bi-col-department">{{ $t('batch-import.classOrCollege') }}</th>
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
                  <NInput v-if="row.userType === 'student'" v-model:value="row.gradeName" size="small" :placeholder="$t('batch-import.grade')" />
                  <span v-else class="bi-na">—</span>
                </td>
                <td class="bi-col-gender">
                  <NSelect v-model:value="row.gender" :options="genderOptions" size="small" />
                </td>
                <td class="bi-col-department">
                  <NInput v-model:value="row.classOrCollege" size="small" :placeholder="getClassOrCollegePlaceholder(row.userType)" />
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
