<script setup lang="ts">
/**
 * 学生管理页（教务）：学生列表服务端分页 + 姓名/年级/班级/专业/未分配多条件筛选，
 * 编辑弹窗维护学号/班级/年级/入学年份，留空的字段保留原值不修改。
 *
 * 归属链为 院系 → 专业 → 班级 → 学生：学生不再直存专业，专业与院系均经班级推导，
 * 故编辑表单里专业是**只读展示**（改专业 = 换班级），班级下拉只列已挂专业的班。
 */
import { ref, computed, h, watch, onMounted } from 'vue'
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
  NText,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchStudents, updateStudent } from '../api'
import { fetchClassNames } from '@/modules/class-names/api'
import { indexMajors, majorNameOfClass } from '@/modules/class-names/chain'
import { fetchMajors } from '@/modules/majors/api'
import { fetchGrades } from '@/modules/grades/api'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import { useLoading } from '@/shared/composables/useLoading'
import { isReportedError } from '@/shared/api'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import type { Student, StudentQuery, StudentUpdateForm } from '../types'
import type { ClassName } from '@/modules/class-names/types'
import type { Major } from '@/modules/majors/types'

const { t } = useI18n()
const message = useMessage()

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

// 未分班 ⇒ 没有班级 ⇒ 没有专业，major 与 unassigned 组合恒为空集，服务端不会为此报错
// 只是永远返回空列表，故选中未分班时清空并禁用专业筛选
watch(filterUnassigned, (v) => {
  if (v !== null) filterMajor.value = ''
})

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
    // 未分班或班级未挂专业时为空，属正常状态，不当异常提示
    render: (r) => r.majorName ?? '-',
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
  try {
    const q: StudentQuery = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
    if (filterName.value) q.name = filterName.value
    if (filterGradeId.value != null) q.gradeId = filterGradeId.value
    if (filterClassName.value) q.className = filterClassName.value
    if (filterMajor.value && filterUnassigned.value === null) q.major = filterMajor.value
    if (filterUnassigned.value !== null) q.unassigned = true
    const res = await fetchStudents(q)
    data.value = res.data.records
    pagination.itemCount = res.data.total
  } catch (e) {
    if (!isReportedError(e))
      message.error((e as Error).message || t('student-management.loadFail'))
  }
}

// 查询/重置前先 reset() 把分页归回第一页，避免带着旧页码查新条件
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
const { loading: saving, withLoading: withSaving } = useLoading()

const emptyForm = (): StudentUpdateForm => ({
  studentNo: '',
  className: '',
  gradeName: '',
  enrollmentYear: undefined,
})
const form = ref<StudentUpdateForm>(emptyForm())
const originalForm = ref<StudentUpdateForm>(emptyForm())
/** 该生当前专业（服务端经班级推导），仅供表单只读展示 */
const editingMajorName = ref<string | null>(null)

const majors = ref<Major[]>([])
/** 专业 id -> 专业；表单里班级反显专业用，不逐行发请求 */
const majorById = computed(() => indexMajors(majors.value))
/** 班级名 -> 班级实体；PagedSelect 翻页时累积，供专业反显按名反查 */
const classByName = ref<Record<string, ClassName>>({})

const fetchClassNamesPage = (page: number, pageSize: number) => fetchClassNames(page, pageSize)

/**
 * 班级下拉只列已挂专业的班：选到未挂专业的班会被服务端 400 拒绝，
 * 且该生会因链断而失去专业与院系。过滤由服务端完成（hasMajor），
 * 保证 total/pages 与实际可选条数一致；顺带累积本次所见的班供按名反查。
 */
function fetchSelectableClasses(page: number, pageSize: number) {
  return fetchClassNames(page, pageSize, true).then((res) => {
    for (const c of res.data.records) classByName.value[c.className] = c
    return res
  })
}

const classNameLabelOf = (c: ClassName) => c.className
const classNameValueOf = (c: ClassName) => c.className

/** 专业筛选下拉：选项取自已加载的专业字典，value 用专业名（服务端 major 参数按名模糊匹配） */
const majorFilterOptions = computed(() =>
  majors.value.map((m) => ({ label: m.majorName, value: m.majorName })),
)

function onClassNameChange(v: string | number | null | Array<string | number>) {
  form.value.className = (v as string) ?? ''
}

// 筛选栏的班级值可能是 number，而查询参数要求名称字符串
function onFilterClassNameChange(v: string | number | null | Array<string | number>) {
  const picked = Array.isArray(v) ? v[0] : v
  filterClassName.value = picked == null ? '' : String(picked)
}

/** 选了班级则按所选班级推导专业，未改班级时回退该生当前专业 */
const derivedMajorName = computed<string | null>(() => {
  const picked = form.value.className ? classByName.value[form.value.className] : undefined
  return picked ? majorNameOfClass(picked, majorById.value) : editingMajorName.value
})

const majorDisplay = computed(
  () => derivedMajorName.value ?? t('student-management.majorUnset'),
)

/** 打开编辑弹窗：原值同时存为 placeholder 与回填基准，表单本身从空值开始 */
function startEdit(row: Student) {
  editingStudentId.value = row.studentId
  editingStudentName.value = row.name
  editingMajorName.value = row.majorName
  originalForm.value = {
    studentNo: row.studentNo ?? '',
    className: row.className ?? '',
    gradeName: row.gradeName ?? '',
    enrollmentYear: row.enrollmentYear ?? undefined,
  }
  form.value = emptyForm()
  showForm.value = true
}

function handleSave() {
  return withSaving(async () => {
    try {
      // 留空字段回退原值，保证提交体完整、未修改项不被清空
      const body: StudentUpdateForm = {
        studentNo: form.value.studentNo || originalForm.value.studentNo,
        className: form.value.className || originalForm.value.className,
        gradeName: form.value.gradeName || originalForm.value.gradeName,
        enrollmentYear: form.value.enrollmentYear ?? originalForm.value.enrollmentYear,
      }
      await updateStudent(editingStudentId.value!, body)
      message.success(t('student-management.saveSuccess'))
      showForm.value = false
      await loadData()
    } catch (e) {
      if (!isReportedError(e))
        message.error((e as Error).message || t('student-management.saveFail'))
    }
  })
}

const gradeOptions = ref<Array<{ label: string; value: number }>>([])

async function loadDropdownData() {
  try {
    const [majorRes, gradeRes] = await Promise.all([fetchMajors(), fetchGrades()])
    majors.value = majorRes.data
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
          <PagedSelect
            :model-value="filterClassName || null"
            :fetch-page="fetchClassNamesPage"
            :label-of="classNameLabelOf"
            :value-of="classNameValueOf"
            :placeholder="$t('student-management.className')"
            clearable
            class="sm-filter-class"
            @update:model-value="onFilterClassNameChange"
          />
          <NSelect
            v-model:value="filterMajor"
            :placeholder="$t('student-management.major')"
            :options="majorFilterOptions"
            :disabled="filterUnassigned !== null"
            clearable
            filterable
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
            :fetch-page="fetchSelectableClasses"
            :label-of="classNameLabelOf"
            :value-of="classNameValueOf"
            :initial-label="originalForm.className || undefined"
            :placeholder="originalForm.className || $t('student-management.className')"
            clearable
            @update:model-value="onClassNameChange"
          />
        </NFormItem>
        <NFormItem
          :label="$t('student-management.major')"
          :feedback="$t('student-management.majorFollowsClass')"
        >
          <NText :depth="derivedMajorName ? 1 : 3">{{ majorDisplay }}</NText>
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
