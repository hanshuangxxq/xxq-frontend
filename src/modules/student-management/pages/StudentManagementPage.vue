<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NDataTable,
  NButton,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpin,
  NEmpty,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchStudents, updateStudent, fetchMajors } from '../api'
import { fetchClassNames } from '@/modules/class-names/api'
import type { Student, StudentQuery, StudentUpdateForm } from '../types'

const { t } = useI18n()
const message = useMessage()

const loading = ref(false)
const data = ref<Student[]>([])

const filterName = ref('')
const filterGrade = ref('')
const filterClassName = ref('')
const filterMajor = ref('')
const filterUnassigned = ref<string | null>(null)

const unassignedOptions = computed(() => [
  { label: t('student-management.unassignedYes'), value: 'true' },
])

const columns: DataTableColumns<Student> = [
  { title: t('student-management.name'), key: 'name', width: 100, ellipsis: { tooltip: true } },
  { title: t('student-management.studentNo'), key: 'studentNo', width: 130, ellipsis: { tooltip: true } },
  { title: t('student-management.className'), key: 'className', width: 140, ellipsis: { tooltip: true } },
  { title: t('student-management.grade'), key: 'grade', width: 80 },
  { title: t('student-management.major'), key: 'majorName', width: 180, ellipsis: { tooltip: true } },
  { title: t('student-management.enrollmentYear'), key: 'enrollmentYear', width: 110 },
  {
    title: t('student-management.actions'),
    key: 'actions',
    width: 100,
    render(row) {
      return h(
        NButton,
        { size: 'small', onClick: () => startEdit(row) },
        () => t('student-management.edit'),
      )
    },
  },
]

async function loadData() {
  loading.value = true
  try {
    const q: StudentQuery = {}
    if (filterName.value) q.name = filterName.value
    if (filterGrade.value) q.grade = filterGrade.value
    if (filterClassName.value) q.className = filterClassName.value
    if (filterMajor.value) q.major = filterMajor.value
    if (filterUnassigned.value !== null) q.unassigned = true
    const res = await fetchStudents(q)
    data.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('student-management.loadFail'))
  } finally {
    loading.value = false
  }
}

function handleReset() {
  filterName.value = ''
  filterGrade.value = ''
  filterClassName.value = ''
  filterMajor.value = ''
  filterUnassigned.value = null
  loadData()
}

const showForm = ref(false)
const editingStudentId = ref<number | null>(null)
const editingStudentName = ref('')
const saving = ref(false)

const emptyForm = (): StudentUpdateForm => ({
  studentNo: '',
  className: '',
  majorName: '',
  enrollmentYear: undefined,
})
const form = ref<StudentUpdateForm>(emptyForm())

function startEdit(row: Student) {
  editingStudentId.value = row.studentId
  editingStudentName.value = row.name
  form.value = {
    studentNo: (row.studentNo ?? '').replace(/s$/, ''),
    className: row.className ?? '',
    majorName: row.majorName ?? '',
    enrollmentYear: row.enrollmentYear ?? undefined,
  }
  showForm.value = true
}

async function handleSave() {
  saving.value = true
  try {
    const body = { ...form.value }
    if (body.studentNo) body.studentNo += 's'
    await updateStudent(editingStudentId.value!, body)
    message.success(t('student-management.saveSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('student-management.saveFail'))
  } finally {
    saving.value = false
  }
}

const classOptions = ref<Array<{ label: string; value: string }>>([])
const majorOptions = ref<Array<{ label: string; value: string }>>([])

async function loadDropdownData() {
  try {
    const [classRes, majorRes] = await Promise.all([fetchClassNames(), fetchMajors()])
    classOptions.value = classRes.data.map((c) => ({ label: c.className, value: c.className }))
    majorOptions.value = majorRes.data.map((m) => ({ label: m.majorName, value: m.majorName }))
  } catch {
    // dropdown data load failure is non-blocking
  }
}

onMounted(() => {
  loadData()
  loadDropdownData()
})
</script>

<template>
  <div class="sm-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('student-management.title')">
        <NSpace class="sm-filter-bar" :size="12" align="center">
          <NInput
            v-model:value="filterName"
            :placeholder="$t('student-management.name')"
            clearable
            style="width: 120px"
          />
          <NInput
            v-model:value="filterGrade"
            :placeholder="$t('student-management.grade')"
            clearable
            style="width: 140px"
          />
          <NInput
            v-model:value="filterClassName"
            :placeholder="$t('student-management.className')"
            clearable
            style="width: 140px"
          />
          <NInput
            v-model:value="filterMajor"
            :placeholder="$t('student-management.major')"
            clearable
            style="width: 160px"
          />
          <NSelect
            v-model:value="filterUnassigned"
            :placeholder="$t('student-management.unassigned')"
            :options="unassignedOptions"
            clearable
            style="width: 120px"
          />
          <NButton type="primary" @click="loadData">{{ $t('student-management.query') }}</NButton>
          <NButton @click="handleReset">{{ $t('student-management.reset') }}</NButton>
        </NSpace>
      </NCard>

      <NCard>
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && data.length === 0"
            :description="$t('student-management.empty')"
          />
          <NDataTable
            v-else
            :columns="columns"
            :data="data"
            :row-key="(r: Student) => r.studentId"
            :single-line="false"
            :bordered="false"
          />
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showForm"
      preset="card"
      :title="editingStudentName"
      class="sm-form-modal"
      :style="{ width: '400px', maxWidth: '90vw' }"
    >
      <NForm :model="form">
        <NFormItem :label="$t('student-management.studentNo')">
          <NInput v-model:value="form.studentNo" autocomplete="off" />
        </NFormItem>
        <NFormItem :label="$t('student-management.className')">
          <NSelect
            v-model:value="form.className"
            :options="classOptions"
            :placeholder="$t('student-management.className')"
            filterable
            clearable
          />
        </NFormItem>
        <NFormItem :label="$t('student-management.major')">
          <NSelect
            v-model:value="form.majorName"
            :options="majorOptions"
            :placeholder="$t('student-management.major')"
            filterable
            clearable
          />
        </NFormItem>
        <NFormItem :label="$t('student-management.enrollmentYear')">
          <NInputNumber v-model:value="form.enrollmentYear" :min="2000" :max="2100" style="width: 100%" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">{{ $t('student-management.cancel') }}</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            {{ $t('student-management.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./StudentManagementPage.css"></style>
