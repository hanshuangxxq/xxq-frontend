<script setup lang="ts">
import { ref, computed, h, reactive, onMounted } from 'vue'
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
  NSelect,
  NDatePicker,
  NTimePicker,
  NInputNumber,
  NTag,
  NSpin,
  NPopconfirm,
  NAlert,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { createExam, updateExam, deleteExam, fetchExams, fetchClassCourseOptions } from '../api'
import { fetchCourses } from '@/modules/course/api'
import { courseKey, parseCourseKey, isPublicCourse } from '@/modules/course/utils'
import { fetchAllSemesters } from '@/modules/curriculum/api'
import { fetchLocals } from '@/modules/locals/api'
import { fetchClassNames } from '@/modules/class-names/api'
import { fetchAllPages } from '@/shared/pagination'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import type { Course } from '@/modules/course/types'
import type { Semester } from '@/modules/curriculum/types'
import type { Local } from '@/modules/locals/types'
import type { ClassName } from '@/modules/class-names/types'
import type {
  ExamView,
  ExamTypeCode,
  ExamStatusCode,
  ExamCreateRequest,
  ClassCourseOptionDto,
} from '../types'
import { calcDurationMinutes } from '../utils'

const { t } = useI18n()
const message = useMessage()

const loading = ref(false)
const data = ref<ExamView[]>([])
/** 考试列表本地分页（需客户端过滤补考/重修，故分块拉全量后客户端分页） */
const examPagination = reactive({
  pageSize: 20,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
})

const semesterOptions = ref<Array<{ label: string; value: number }>>([])

/** 当前所选班级的可排考课程（由后端按班级在库中查询返回） */
const classCourseOptions = ref<ClassCourseOptionDto[]>([])
const loadingCourses = ref(false)

/** classId -> className 缓存：PagedSelect 翻页时累积，供保存时由 classId 反查 className */
const classNameById = ref<Record<number, string>>({})
/** 编辑时考试行无 classId，记录原 className 供不改班级时回填 */
const editingClassName = ref<string | null>(null)
/** 编辑回显地点下拉用 */
const editingLocalLabel = ref<string | undefined>(undefined)

/** 拉班级分页并累积 classId->className 映射，供 PagedSelect 与保存逻辑共用 */
function fetchClassNamesTracked(page: number, pageSize: number) {
  return fetchClassNames(page, pageSize).then((res) => {
    for (const c of res.data.records) classNameById.value[c.id] = c.className
    return res
  })
}

const filterSemesterId = ref<number | null>(null)
const filterCourseKey = ref<string | null>(null)
const filterExamType = ref<ExamTypeCode | null>(null)

const examTypeOptions = computed(() => [
  { label: t('exam.typeFinal'), value: 'FINAL' as ExamTypeCode },
  { label: t('exam.typeMidterm'), value: 'MIDTERM' as ExamTypeCode },
])
const statusOptions = computed(() => [
  { label: t('exam.statusScheduled'), value: 'SCHEDULED' as ExamStatusCode },
  { label: t('exam.statusCanceled'), value: 'CANCELED' as ExamStatusCode },
  { label: t('exam.statusCompleted'), value: 'COMPLETED' as ExamStatusCode },
])

function statusTagType(status: string): 'success' | 'info' | 'warning' | 'error' | 'default' {
  switch (status) {
    case '已安排':
      return 'info'
    case '已完成':
      return 'success'
    case '已取消':
      return 'error'
    default:
      return 'default'
  }
}

function statusToCode(status: string): ExamStatusCode | null {
  switch (status) {
    case '已安排':
      return 'SCHEDULED'
    case '已取消':
      return 'CANCELED'
    case '已完成':
      return 'COMPLETED'
    default:
      return null
  }
}

async function loadSemesters() {
  try {
    const semRes = await fetchAllSemesters()
    semesterOptions.value = semRes.data.map((s: Semester) => ({ label: s.name, value: s.id }))
  } catch {
    // 非阻塞
  }
}

async function loadData() {
  loading.value = true
  try {
    const sel = filterCourseKey.value ? parseCourseKey(filterCourseKey.value) : null
    // 服务端 examType 无法表达「期末或期中、排除补考」，故分块拉全量后客户端过滤+分页
    const all = await fetchAllPages((page, pageSize) =>
      fetchExams({
        semesterId: filterSemesterId.value ?? undefined,
        courseId: sel?.id,
        source: sel?.source === 'SELECTION_CAMPAIGN' ? 'SELECTION_CAMPAIGN' : undefined,
        examType: filterExamType.value ?? undefined,
        page,
        pageSize,
      }),
    )
    // 仅展示期末/期中（补考/重修在专门页面）
    data.value = all.filter((e) => e.examType === '期末考试' || e.examType === '期中考试')
  } catch (e) {
    message.error((e as Error).message || t('exam.mgLoadFail'))
    data.value = []
  } finally {
    loading.value = false
  }
}

function handleReset() {
  filterSemesterId.value = null
  filterCourseKey.value = null
  filterExamType.value = null
  loadData()
}

const fetchCoursesPage = (page: number, pageSize: number) => fetchCourses(page, pageSize)
const courseLabelOf = (c: Course) =>
  isPublicCourse(c) ? `${c.courseName}（${t('common.publicTag')}）` : c.courseName
const courseValueOf = (c: Course) => courseKey(c.id, c.source)
function onFilterCourseChange(v: string | number | null | Array<string | number>) {
  filterCourseKey.value = (v as string) ?? null
}

// ---- 日期/时间转换 ----
function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function tsToDateStr(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function tsToTimeStr(ts: number): string {
  const d = new Date(ts)
  // 选择器只精确到分，发送给后端时固定补秒 00（后端 LocalTime 为 HH:mm:ss）
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}
function dateStrToTs(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d!).getTime()
}
function timeStrToTs(s: string): number {
  const [h, mi, se] = s.split(':').map(Number)
  const d = new Date()
  d.setHours(h ?? 0, mi ?? 0, se ?? 0, 0)
  return d.getTime()
}

// ---- 表单 ----
interface ExamForm {
  examName: string
  classId: number | null
  teachInfoId: number | null
  courseId: number | null
  semesterId: number | null
  examType: ExamTypeCode
  examDateTs: number | null
  startTimeTs: number | null
  durationMinutes: number | null
  localId: number | null
  notes: string
  status: ExamStatusCode | null
}

const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)

function emptyForm(): ExamForm {
  return {
    examName: '',
    classId: null,
    teachInfoId: null,
    courseId: null,
    semesterId: null,
    examType: 'FINAL',
    examDateTs: null,
    startTimeTs: null,
    durationMinutes: null,
    localId: null,
    notes: '',
    status: null,
  }
}
const form = ref<ExamForm>(emptyForm())

const courseSelectOptions = computed(() =>
  classCourseOptions.value.map((o) => {
    const combined = o.className.includes(',')
    const teacher = o.teacherName ? ` · ${o.teacherName}` : ''
    const label =
      `${o.courseName}${teacher} · ${o.semesterName}` + (combined ? `（合班:${o.className}）` : '')
    return { label, value: o.teachInfoId }
  }),
)

const coursePlaceholder = computed(() => {
  if (form.value.classId == null) return t('exam.mgCourseSelectClassFirst')
  if (classCourseOptions.value.length === 0) return t('exam.mgCourseEmpty')
  return t('exam.mgCoursePlaceholder')
})

/** 按所选班级拉取可排考课程（前端主动发起，后端按 class_id 在库中查询后返回）。 */
async function loadClassCourses(classId: number) {
  loadingCourses.value = true
  try {
    const res = await fetchClassCourseOptions(classId)
    classCourseOptions.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('exam.mgCourseLoadFail'))
    classCourseOptions.value = []
  } finally {
    loadingCourses.value = false
  }
}

async function onClassChange(classId: number | null) {
  form.value.classId = classId
  // 班级变更后清空已选课程及派生字段
  form.value.teachInfoId = null
  form.value.courseId = null
  form.value.semesterId = null
  classCourseOptions.value = []
  if (classId == null) return
  await loadClassCourses(classId)
}

const classNameLabelOf = (c: ClassName) => c.className
const classNameValueOf = (c: ClassName) => c.id
function onClassModelChange(v: string | number | null | Array<string | number>) {
  onClassChange(v as number | null)
}

function onCourseSelect(teachInfoId: number | null) {
  form.value.teachInfoId = teachInfoId
  const opt = classCourseOptions.value.find((o) => o.teachInfoId === teachInfoId)
  if (opt) {
    form.value.courseId = opt.courseId
    form.value.semesterId = opt.semesterId
  } else {
    form.value.courseId = null
    form.value.semesterId = null
  }
}

const fetchLocalsPage = (page: number, pageSize: number) => fetchLocals({ page, pageSize })
const localLabelOf = (l: Local) => `${l.building} ${l.classRoom}`
const localValueOf = (l: Local) => l.id
function onLocalChange(v: string | number | null | Array<string | number>) {
  form.value.localId = v as number | null
}

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  editingClassName.value = null
  editingLocalLabel.value = undefined
  classCourseOptions.value = []
  showForm.value = true
}

async function startEdit(row: ExamView) {
  formMode.value = 'edit'
  editingId.value = row.id
  // 考试行无 classId，编辑时班级置空；不改班级则保留原 className（见 handleSave）
  editingClassName.value = row.className ?? null
  editingLocalLabel.value = row.localName ?? undefined
  form.value = {
    examName: row.examName,
    classId: null,
    teachInfoId: row.teachInfoId,
    courseId: row.courseId,
    semesterId: row.semesterId,
    examType: row.examType === '期中考试' ? 'MIDTERM' : 'FINAL',
    examDateTs: row.examDate ? dateStrToTs(row.examDate) : null,
    startTimeTs: row.startTime ? timeStrToTs(row.startTime) : null,
    // 后端存储的是 startTime+endTime，前端据此反算考试时长回填表单
    durationMinutes: calcDurationMinutes(row.startTime, row.endTime),
    localId: row.localId,
    notes: row.notes ?? '',
    status: statusToCode(row.status),
  }
  // 用考试行合成当前授课安排选项，回显已有 teachInfo（考试行无 classId，无法按班级重拉）
  classCourseOptions.value =
    row.teachInfoId != null
      ? [
          {
            teachInfoId: row.teachInfoId,
            courseId: row.courseId ?? 0,
            courseName: row.courseName,
            teacherName: null,
            className: row.className ?? '',
            semesterId: row.semesterId,
            semesterName: '',
          },
        ]
      : []
  showForm.value = true
}

async function handleSave() {
  const f = form.value
  if (!f.examName.trim()) return message.warning(t('exam.mgExamNameRequired'))
  // 编辑时班级可不改（classId 为空表示沿用原班级）
  if (formMode.value === 'create' && f.classId == null)
    return message.warning(t('exam.mgClassRequired'))
  if (f.teachInfoId == null || f.courseId == null)
    return message.warning(t('exam.mgCourseRequired'))
  if (f.semesterId == null) return message.warning(t('exam.mgSemesterRequired'))
  if (f.examDateTs == null) return message.warning(t('exam.mgExamDateRequired'))
  if (f.startTimeTs == null) return message.warning(t('exam.mgStartTimeRequired'))
  if (f.durationMinutes == null || f.durationMinutes <= 0) {
    return message.warning(t('exam.mgDurationRequired'))
  }

  // 排考班级：改选了班级取新班级名，未改则沿用原 className
  const className =
    f.classId != null ? (classNameById.value[f.classId] ?? null) : (editingClassName.value ?? null)
  const body: ExamCreateRequest = {
    examName: f.examName.trim(),
    courseId: f.courseId,
    teachInfoId: f.teachInfoId,
    className,
    examType: f.examType,
    semesterId: f.semesterId,
    examDate: tsToDateStr(f.examDateTs),
    startTime: tsToTimeStr(f.startTimeTs),
    durationMinutes: f.durationMinutes,
    localId: f.localId,
    notes: f.notes || undefined,
    status: f.status,
  }
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createExam(body)
    } else {
      await updateExam(editingId.value!, body)
    }
    message.success(t('exam.mgSaveSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('exam.mgSaveFail'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deleteExam(id)
    message.success(t('exam.mgDeleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('exam.mgDeleteFail'))
  }
}

const examRowKey = (row: ExamView) => row.id

const columns = computed<DataTableColumns<ExamView>>(() => [
  { title: t('exam.mgExamName'), key: 'examName', minWidth: 200, ellipsis: { tooltip: true } },
  { title: t('exam.mgCourse'), key: 'courseName', width: 140, ellipsis: { tooltip: true } },
  { title: t('exam.mgClass'), key: 'className', width: 120, render: (r) => r.className || '-' },
  { title: t('exam.mgExamType'), key: 'examType', width: 100 },
  { title: t('exam.mgDate'), key: 'examDate', width: 120 },
  {
    title: t('exam.mgTime'),
    key: 'time',
    width: 150,
    render: (r) => `${r.startTime?.slice(0, 5) ?? ''} - ${r.endTime?.slice(0, 5) ?? ''}`,
  },
  {
    title: t('exam.mgDuration'),
    key: 'duration',
    width: 130,
    align: 'center',
    render: (r) => {
      const m = calcDurationMinutes(r.startTime, r.endTime)
      return m == null ? '-' : String(m)
    },
  },
  { title: t('exam.mgLocation'), key: 'localName', width: 120, render: (r) => r.localName || '-' },
  {
    title: t('exam.mgNotes'),
    key: 'notes',
    width: 140,
    ellipsis: { tooltip: true },
    render: (r) => r.notes || '-',
  },
  {
    title: t('exam.mgStatus'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(NTag, { type: statusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
  {
    title: t('exam.mgActions'),
    key: 'actions',
    width: 130,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'small', onClick: () => startEdit(row) }, () => t('exam.mgEdit')),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row.id) },
          {
            default: () => t('exam.mgDeleteConfirm'),
            trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('exam.mgDelete')),
          },
        ),
      ]),
  },
])

onMounted(() => {
  loadSemesters()
  loadData()
})
</script>

<template>
  <div class="exam-mg-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('exam.mgTitle')">
        <NSpace align="center" :size="12" wrap>
          <NSelect
            v-model:value="filterSemesterId"
            :options="semesterOptions"
            :placeholder="$t('exam.mgSemester')"
            clearable
            style="width: 180px"
          />
          <PagedSelect
            :model-value="filterCourseKey"
            :fetch-page="fetchCoursesPage"
            :label-of="courseLabelOf"
            :value-of="courseValueOf"
            :placeholder="$t('exam.mgCourse')"
            clearable
            style="width: 180px"
            @update:model-value="onFilterCourseChange"
          />
          <NSelect
            v-model:value="filterExamType"
            :options="examTypeOptions"
            :placeholder="$t('exam.mgExamType')"
            clearable
            style="width: 140px"
          />
          <NButton type="primary" @click="loadData">{{ $t('exam.mgQuery') }}</NButton>
          <NButton @click="handleReset">{{ $t('exam.mgReset') }}</NButton>
          <NButton type="primary" @click="startCreate">{{ $t('exam.mgAdd') }}</NButton>
        </NSpace>
        <NAlert type="info" :show-icon="true" class="mg-hint">{{ $t('exam.mgMakeupHint') }}</NAlert>
      </NCard>

      <NCard>
        <NSpin :show="loading">
          <NDataTable
            :columns="columns"
            :data="data"
            :row-key="examRowKey"
            :single-line="false"
            :bordered="false"
            :scroll-x="1450"
            :pagination="examPagination"
          >
            <template #empty>{{ $t('exam.mgEmpty') }}</template>
          </NDataTable>
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showForm"
      preset="card"
      :title="formMode === 'create' ? $t('exam.mgAddTitle') : $t('exam.mgEditTitle')"
      class="exam-form-modal"
    >
      <NForm :model="form" label-placement="top">
        <NFormItem :label="$t('exam.mgExamName')" required>
          <NInput v-model:value="form.examName" :placeholder="$t('exam.mgExamNamePlaceholder')" />
        </NFormItem>
        <NSpace :size="12" wrap>
          <NFormItem :label="$t('exam.mgClass')" required style="width: 240px">
            <PagedSelect
              :model-value="form.classId"
              :fetch-page="fetchClassNamesTracked"
              :label-of="classNameLabelOf"
              :value-of="classNameValueOf"
              :placeholder="editingClassName || $t('exam.mgClassPlaceholder')"
              filterable
              @update:model-value="onClassModelChange"
            />
          </NFormItem>
          <NFormItem :label="$t('exam.mgExamType')" required style="width: 160px">
            <NSelect v-model:value="form.examType" :options="examTypeOptions" />
          </NFormItem>
        </NSpace>
        <NFormItem :label="$t('exam.mgCourse')" required>
          <NSelect
            :value="form.teachInfoId"
            :options="courseSelectOptions"
            :placeholder="coursePlaceholder"
            :disabled="form.classId == null"
            :loading="loadingCourses"
            filterable
            clearable
            @update:value="onCourseSelect"
          />
        </NFormItem>
        <NSpace :size="12" wrap>
          <NFormItem :label="$t('exam.mgSemester')" required style="width: 200px">
            <NSelect
              v-model:value="form.semesterId"
              :options="semesterOptions"
              disabled
              :placeholder="$t('exam.mgSemesterAutoHint')"
            />
          </NFormItem>
          <NFormItem :label="$t('exam.mgExamDate')" required style="width: 200px">
            <NDatePicker
              v-model:value="form.examDateTs"
              type="date"
              format="yyyy-MM-dd"
              clearable
            />
          </NFormItem>
          <NFormItem :label="$t('exam.mgStartTime')" required style="width: 160px">
            <NTimePicker v-model:value="form.startTimeTs" format="HH:mm" clearable />
          </NFormItem>
          <NFormItem :label="$t('exam.mgDuration')" required style="width: 160px">
            <NInputNumber
              v-model:value="form.durationMinutes"
              :min="1"
              :placeholder="$t('exam.mgDurationPlaceholder')"
              clearable
              style="width: 100%"
            />
          </NFormItem>
        </NSpace>
        <NSpace :size="12" wrap>
          <NFormItem :label="$t('exam.mgLocal')" style="width: 240px">
            <PagedSelect
              :model-value="form.localId"
              :fetch-page="fetchLocalsPage"
              :label-of="localLabelOf"
              :value-of="localValueOf"
              :initial-label="editingLocalLabel"
              :placeholder="$t('exam.mgLocalPlaceholder')"
              clearable
              filterable
              @update:model-value="onLocalChange"
            />
          </NFormItem>
          <NFormItem :label="$t('exam.mgStatus')" style="width: 180px">
            <NSelect
              v-model:value="form.status"
              :options="statusOptions"
              :placeholder="$t('exam.mgStatusPlaceholder')"
              clearable
            />
          </NFormItem>
        </NSpace>
        <NFormItem :label="$t('exam.mgNotes')">
          <NInput
            v-model:value="form.notes"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :placeholder="$t('exam.mgNotesPlaceholder')"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">{{ $t('exam.mgCancel') }}</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">{{
            $t('exam.mgSave')
          }}</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./ExamManagementPage.css"></style>

<style>
.exam-form-modal {
  width: 640px;
  max-width: 92vw;
}
</style>
