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
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchStudents, updateStudent, fetchMajors } from '../api'
import { fetchClassNames } from '@/modules/class-names/api'
import { fetchGrades } from '@/modules/grades/api'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import type { Student, StudentQuery, StudentUpdateForm } from '../types'
import type { ClassName } from '@/modules/class-names/types'

const { t } = useI18n()
const message = useMessage()

const loading = ref(false)
const data = ref<Student[]>([])
const { pagination, reset } = useRemotePagination(loadData)

const filterName = ref('')
const filterGradeId = ref<number | null>(null)
const filterClassName = ref('')
const filterMajor = ref('')
const filterUnassigned = ref<string | null>(null)

const unassignedOptions = computed(() => [
  { label: t('student-management.unassignedYes'), value: 'true' },
])

const studentRowKey = (row: Student) => row.studentId

const columns: DataTableColumns<Student> = [
  { title: t('student-management.name'), key: 'name', width: 100, ellipsis: { tooltip: true } },
  {
    title: t('student-management.studentNo'),
    key: 'studentNo',
    width: 130,
    ellipsis: { tooltip: true },
  },
  {
    title: t('student-management.className'),
    key: 'className',
    width: 140,
    ellipsis: { tooltip: true },
  },
  { title: t('student-management.grade'), key: 'gradeName', width: 100 },
  {
    title: t('student-management.major'),
    key: 'majorName',
    width: 180,
    ellipsis: { tooltip: true },
  },
  { title: t('student-management.enrollmentYear'), key: 'enrollmentYear', width: 110 },
  {
    title: t('student-management.actions'),
    key: 'actions',
    width: 100,
    render(row) {
      return h(NButton, { size: 'small', onClick: () => startEdit(row) }, () =>
        t('student-management.edit'),
      )
    },
  },
]

async function loadData() {
  loading.value = true
  try {
    const q: StudentQuery = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
    if (filterName.value) q.name = filterName.value
    if (filterGradeId.value != null) q.gradeId = filterGradeId.value
    if (filterClassName.value) q.className = filterClassName.value
    if (filterMajor.value) q.major = filterMajor.value
    if (filterUnassigned.value !== null) q.unassigned = true
    const res = await fetchStudents(q)
    data.value = res.data.records
    pagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('student-management.loadFail'))
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  reset()
  loadData()
}

function handleReset() {
  filterName.value = ''
  filterGradeId.value = null
  filterClassName.value = ''
  filterMajor.value = ''
  filterUnassigned.value = null
  reset()
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
  gradeName: '',
  enrollmentYear: undefined,
})
const form = ref<StudentUpdateForm>(emptyForm())
const originalForm = ref<StudentUpdateForm>(emptyForm())

const fetchClassNamesPage = (page: number, pageSize: number) => fetchClassNames(page, pageSize)
const classNameLabelOf = (c: ClassName) => c.className
const classNameValueOf = (c: ClassName) => c.className

function onClassNameChange(v: string | number | null | Array<string | number>) {
  form.value.className = (v as string) ?? ''
}

function startEdit(row: Student) {
  editingStudentId.value = row.studentId
  editingStudentName.value = row.name
  originalForm.value = {
    studentNo: row.studentNo ?? '',
    className: row.className ?? '',
    majorName: row.majorName ?? '',
    gradeName: row.gradeName ?? '',
    enrollmentYear: row.enrollmentYear ?? undefined,
  }
  form.value = emptyForm()
  showForm.value = true
}

async function handleSave() {
  saving.value = true
  try {
    const body: StudentUpdateForm = {
      studentNo: form.value.studentNo || originalForm.value.studentNo,
      className: form.value.className || originalForm.value.className,
      majorName: form.value.majorName || originalForm.value.majorName,
      gradeName: form.value.gradeName || originalForm.value.gradeName,
      enrollmentYear: form.value.enrollmentYear ?? originalForm.value.enrollmentYear,
    }
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

const majorOptions = ref<Array<{ label: string; value: string }>>([])
const gradeOptions = ref<Array<{ label: string; value: number }>>([])

async function loadDropdownData() {
  try {
    const [majorRes, gradeRes] = await Promise.all([fetchMajors(), fetchGrades()])
    majorOptions.value = majorRes.data.map((m) => ({ label: m.majorName, value: m.majorName }))
    gradeOptions.value = gradeRes.data.map((g) => ({ label: g.name, value: g.id }))
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
          <NSelect
            v-model:value="filterGradeId"
            :placeholder="$t('student-management.grade')"
            :options="gradeOptions"
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
          <NButton type="primary" @click="handleQuery">{{
            $t('student-management.query')
          }}</NButton>
          <NButton @click="handleReset">{{ $t('student-management.reset') }}</NButton>
        </NSpace>
      </NCard>

      <NCard>
        <NSpin :show="loading">
          <NDataTable
            :columns="columns"
            :data="data"
            :row-key="studentRowKey"
            :single-line="false"
            :bordered="false"
            remote
            :pagination="pagination"
          >
            <template #empty>{{ $t('student-management.empty') }}</template>
          </NDataTable>
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
          <NInput
            v-model:value="form.studentNo"
            :placeholder="originalForm.studentNo"
            autocomplete="off"
          />
        </NFormItem>
        <NFormItem :label="$t('student-management.className')">
          <PagedSelect
            :model-value="form.className || null"
            :fetch-page="fetchClassNamesPage"
            :label-of="classNameLabelOf"
            :value-of="classNameValueOf"
            :initial-label="originalForm.className || undefined"
            :placeholder="originalForm.className || $t('student-management.className')"
            clearable
            @update:model-value="onClassNameChange"
          />
        </NFormItem>
        <NFormItem :label="$t('student-management.major')">
          <NSelect
            v-model:value="form.majorName"
            :options="majorOptions"
            :placeholder="originalForm.majorName || $t('student-management.major')"
            filterable
            clearable
          />
        </NFormItem>
        <NFormItem :label="$t('student-management.grade')">
          <NSelect
            v-model:value="form.gradeName"
            :options="gradeOptions.map((g) => ({ label: g.label, value: g.label }))"
            :placeholder="originalForm.gradeName || $t('student-management.grade')"
            filterable
            clearable
          />
        </NFormItem>
        <NFormItem :label="$t('student-management.enrollmentYear')">
          <NInputNumber
            v-model:value="form.enrollmentYear"
            :placeholder="
              originalForm.enrollmentYear != null ? String(originalForm.enrollmentYear) : ''
            "
            :min="2000"
            :max="2100"
            style="width: 100%"
          />
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
