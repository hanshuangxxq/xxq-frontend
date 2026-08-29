<script setup lang="ts">
import { ref, h, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NDataTable,
  NButton,
  NTag,
  NSpin,
  NEmpty,
  NInput,
  NSelect,
  NPopconfirm,
  NGrid,
  NGi,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { solve, getSolution, stopSolving } from '../api'
import {
  fetchTeachInfoList,
  fetchAllTimes,
  submitDrafts,
  fetchDrafts,
  fetchDraftClassSummary,
  clearAllDrafts,
  clearDraftsByClass,
  deleteSingleDraft,
  fetchTeachers,
  fetchCurrentSemester,
  fetchAllSemesters,
} from '@/modules/curriculum/api'
import type {
  TeachInfo,
  TimeSlot,
  DraftClassSummary,
  DraftItem,
  Semester,
  Teacher,
} from '@/modules/curriculum/types'
import { fetchClassNames } from '@/modules/class-names/api'
import { fetchColleges } from '@/modules/college/api'
import { fetchCourses } from '@/modules/course/api'
import { isPublicCourse } from '@/modules/course/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import type { ClassName } from '@/modules/class-names/types'
import type { College } from '@/modules/college/types'
import type { Course } from '@/modules/course/types'
import type { ScheduledLesson } from '../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin, canManageDrafts } = useRoleCheck()

// ---- Scheduling ----
const status = ref<'NOT_SOLVING' | 'SOLVING' | 'FINISHED'>('NOT_SOLVING')
const score = ref('')
const scheduleId = ref<number | null>(null)
const solving = ref(false)
const lessons = ref<ScheduledLesson[]>([])
let pollTimer: ReturnType<typeof setInterval> | null = null

// ---- Data preview ----
const showData = ref(false)
const dataLoading = ref(false)
const teachInfoList = ref<TeachInfo[]>([])
const timeMap = ref<Map<number, TimeSlot>>(new Map())

// ---- Draft management ----
const showDrafts = ref(false)
const draftLoading = ref(false)
const drafts = ref<DraftItem[]>([])
const summary = ref<DraftClassSummary | null>(null)
const selectedClasses = ref<string[]>([])
interface DraftEntry {
  courseId: number | null
  teacherId: number | null
  startWeek: number | null
  endWeek: number | null
}
const entries = ref<DraftEntry[]>([
  { courseId: null, teacherId: null, startWeek: null, endWeek: null },
])
const submitting = ref(false)

/** 排课草稿仅用常规课（排除公选课）；端点不支持按 source 过滤，故按页客户端过滤 */
function fetchRegularCourses(page: number, pageSize: number) {
  return fetchCourses(page, pageSize).then((res) => ({
    ...res,
    data: { ...res.data, records: res.data.records.filter((c) => !isPublicCourse(c)) },
  }))
}

// ---- Semester ----
const semesterOptions = ref<{ label: string; value: number }[]>([])
const selectedSemesterId = ref<number | null>(null)
const currentSemester = ref<Semester | null>(null)

async function loadSemesters() {
  try {
    const [allRes, curRes] = await Promise.all([
      fetchAllSemesters(),
      fetchCurrentSemester().catch(() => ({ data: null as Semester | null })),
    ])
    semesterOptions.value = allRes.data.map((s) => ({
      label: `${s.name} (${s.startDate ? s.startDate : `第${s.startWeek}周`} ~ ${s.endDate ? s.endDate : `第${s.endWeek}周`})`,
      value: s.id,
    }))
    const cur = curRes.data
    if (cur) {
      currentSemester.value = cur
      if (!selectedSemesterId.value) {
        selectedSemesterId.value = cur.id
      }
    }
  } catch {
    // non-blocking
  }
}

const DAY_MAP: Record<string, string> = {
  MONDAY: '周一',
  TUESDAY: '周二',
  WEDNESDAY: '周三',
  THURSDAY: '周四',
  FRIDAY: '周五',
  SATURDAY: '周六',
  SUNDAY: '周日',
}

const DAY_NUM_MAP: Record<number, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
}

function formatDay(day: string): string {
  return DAY_MAP[day] ?? day
}

function formatDayNum(day: number): string {
  return DAY_NUM_MAP[day] ?? String(day)
}

function formatTime(time: string): string {
  return time.substring(0, 5)
}

function formatTimeLabel(timeId: number): string {
  const slot = timeMap.value.get(timeId)
  if (!slot) return String(timeId)
  return `${formatTime(slot.startPeriod)}-${formatTime(slot.endPeriod)}`
}

function draftRowKey(row: DraftItem): string {
  return `${row.courseId}-${row.teacherId}-${row.className}`
}

const teachInfoRowKey = (row: TeachInfo) =>
  `${row.courseName}-${row.className}-${row.dayOfWeek}-${row.timeId}`
const lessonRowKey = (row: ScheduledLesson) => row.id

// ---- Columns ----
const columns: DataTableColumns<ScheduledLesson> = [
  {
    title: t('scheduling.columnCourseName'),
    key: 'courseName',
    width: 140,
    ellipsis: { tooltip: true },
  },
  {
    title: t('scheduling.columnTeacherName'),
    key: 'teacherName',
    width: 100,
  },
  {
    title: t('scheduling.columnClassName'),
    key: 'className',
    width: 140,
    render(row) {
      return row.studentGroups
        .map((g) => g.name)
        .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
        .join(', ')
    },
  },
  {
    title: t('scheduling.columnDayOfWeek'),
    key: 'day',
    width: 70,
    render(row) {
      return formatDay(row.timeslot.dayOfWeek)
    },
  },
  {
    title: t('scheduling.columnTime'),
    key: 'time',
    width: 110,
    render(row) {
      return `${formatTime(row.timeslot.startTime)}-${formatTime(row.timeslot.endTime)}`
    },
  },
  {
    title: t('scheduling.columnBuilding'),
    key: 'building',
    width: 100,
    render(row) {
      return row.room.building
    },
  },
  {
    title: t('scheduling.columnClassroom'),
    key: 'classroom',
    width: 70,
    render(row) {
      return row.room.roomName
    },
  },
]

const dataColumns: DataTableColumns<TeachInfo> = [
  {
    title: t('scheduling.columnCourseName'),
    key: 'courseName',
    width: 140,
    ellipsis: { tooltip: true },
  },
  {
    title: t('scheduling.columnTeacherName'),
    key: 'teacherName',
    width: 100,
  },
  {
    title: t('scheduling.columnClassName'),
    key: 'className',
    width: 140,
    ellipsis: { tooltip: true },
  },
  {
    title: t('scheduling.columnCollege'),
    key: 'college',
    width: 120,
    ellipsis: { tooltip: true },
  },
  {
    title: t('scheduling.columnCredit'),
    key: 'credit',
    width: 60,
    align: 'center',
  },
  {
    title: t('scheduling.columnCourseHour'),
    key: 'courseHour',
    width: 60,
    align: 'center',
  },
  {
    title: t('scheduling.columnCourseType'),
    key: 'courseType',
    width: 80,
  },
  {
    title: t('scheduling.columnDayOfWeek'),
    key: 'dayOfWeek',
    width: 70,
    render(row) {
      return formatDayNum(row.dayOfWeek)
    },
  },
  {
    title: t('scheduling.columnWeek'),
    key: 'week',
    width: 100,
    render(row) {
      return row.startWeek === row.endWeek
        ? `第${row.startWeek}周`
        : `第${row.startWeek}-${row.endWeek}周`
    },
  },
  {
    title: t('scheduling.columnTime'),
    key: 'time',
    width: 110,
    render(row) {
      return formatTimeLabel(row.timeId)
    },
  },
  {
    title: t('scheduling.columnBuilding'),
    key: 'building',
    width: 100,
    ellipsis: { tooltip: true },
  },
  {
    title: t('scheduling.columnClassroom'),
    key: 'classroom',
    width: 80,
    ellipsis: { tooltip: true },
  },
]

const draftColumns: DataTableColumns<DraftItem> = [
  { title: t('teach-drafts.className'), key: 'className', width: 150, ellipsis: { tooltip: true } },
  {
    title: t('scheduling.columnCourseName'),
    key: 'courseName',
    width: 140,
    ellipsis: { tooltip: true },
  },
  { title: t('scheduling.columnTeacherName'), key: 'teacherName', width: 100 },
  { title: t('scheduling.columnCollege'), key: 'college', width: 120, ellipsis: { tooltip: true } },
  {
    title: t('teach-drafts.week'),
    key: 'week',
    width: 100,
    align: 'center',
    render(row: DraftItem) {
      return row.startWeek === row.endWeek
        ? `第${row.startWeek}周`
        : `第${row.startWeek}-${row.endWeek}周`
    },
  },
  {
    title: t('teach-drafts.actions'),
    key: 'actions',
    width: 80,
    align: 'center',
    render(row) {
      if (!isAcademicAdmin.value) return ''
      return h(
        NPopconfirm,
        { onPositiveClick: () => handleDeleteSingle(row) },
        {
          default: () => t('teach-drafts.deleteSingleConfirm'),
          trigger: () =>
            h(NButton, { size: 'tiny', type: 'error' }, () => t('teach-drafts.deleteSingle')),
        },
      )
    },
  },
]

// ---- Data preview ----
async function loadSchedulingData() {
  dataLoading.value = true
  try {
    const [teachRes, timeRes] = await Promise.all([fetchTeachInfoList(), fetchAllTimes()])
    teachInfoList.value = teachRes.data.courses
    const map = new Map<number, TimeSlot>()
    for (const slot of timeRes.data) {
      map.set(slot.id, slot)
    }
    timeMap.value = map
  } catch (e) {
    message.error((e as Error).message || t('scheduling.loadFail'))
  } finally {
    dataLoading.value = false
  }
}

function toggleData() {
  showData.value = !showData.value
  if (showData.value && teachInfoList.value.length === 0) {
    loadSchedulingData()
  }
}

// ---- Draft management ----
const colleges = ref<College[]>([])

async function loadColleges() {
  try {
    const res = await fetchColleges()
    colleges.value = res.data
  } catch {
    colleges.value = []
  }
}

/** 班级下拉展示：班级名（院系名），院系缺失时仅班级名 */
function classNameLabel(c: ClassName): string {
  const name =
    c.collegeId != null ? colleges.value.find((x) => x.id === c.collegeId)?.collegeName : null
  return name ? `${c.className} (${name})` : c.className
}

const fetchClassNamesPage = (page: number, pageSize: number) => fetchClassNames(page, pageSize)
const classNameLabelOf = (c: ClassName) => classNameLabel(c)
const classNameValueOf = (c: ClassName) => c.className

function onSelectedClassesChange(v: string | number | null | Array<string | number>) {
  selectedClasses.value = v as string[]
}

const courseLabelOf = (c: Course) => `${c.courseName} (${c.courseCode})`
const courseValueOf = (c: Course) => c.id

function onEntryCourseChange(
  entry: DraftEntry,
  v: string | number | null | Array<string | number>,
) {
  entry.courseId = v as number | null
}

const fetchTeachersPage = (page: number, pageSize: number) => fetchTeachers(page, pageSize)
const teacherLabelOf = (tch: Teacher) => `${tch.name} (${tch.title})`
const teacherValueOf = (tch: Teacher) => tch.id

function onEntryTeacherChange(
  entry: DraftEntry,
  v: string | number | null | Array<string | number>,
) {
  entry.teacherId = v as number | null
}

function onEntryStartWeekChange(entry: DraftEntry, v: string) {
  entry.startWeek = v ? parseInt(v, 10) : null
}

function onEntryEndWeekChange(entry: DraftEntry, v: string) {
  entry.endWeek = v ? parseInt(v, 10) : null
}

async function loadDraftData() {
  draftLoading.value = true
  try {
    const [draftRes, summaryRes] = await Promise.all([fetchDrafts(), fetchDraftClassSummary()])
    drafts.value = draftRes.data
    summary.value = summaryRes.data
  } catch (e) {
    message.error((e as Error).message || t('teach-drafts.loadFail'))
  } finally {
    draftLoading.value = false
  }
}

function toggleDrafts() {
  showDrafts.value = !showDrafts.value
  if (showDrafts.value) {
    if (drafts.value.length === 0) loadDraftData()
    if (semesterOptions.value.length === 0) loadSemesters()
    if (colleges.value.length === 0) loadColleges()
  }
}

function addEntry() {
  entries.value.push({ courseId: null, teacherId: null, startWeek: null, endWeek: null })
}

function removeEntry(index: number) {
  if (entries.value.length > 1) {
    entries.value.splice(index, 1)
  }
}

async function handleDraftSubmit() {
  if (selectedClasses.value.length === 0) {
    message.warning(t('teach-drafts.classNamePlaceholder'))
    return
  }
  const classNameVal = selectedClasses.value.join(',')
  const body = entries.value
    .filter((e) => e.courseId !== null && e.teacherId !== null)
    .map((e) => ({
      courseId: e.courseId!,
      teacherId: e.teacherId!,
      className: classNameVal,
      startWeek: e.startWeek ?? undefined,
      endWeek: e.endWeek ?? undefined,
      semesterId: selectedSemesterId.value ?? undefined,
    }))
  if (body.length === 0) {
    message.warning(t('teach-drafts.addCourse'))
    return
  }
  submitting.value = true
  try {
    await submitDrafts(body)
    message.success(t('teach-drafts.submitSuccess'))
    selectedClasses.value = []
    entries.value = [{ courseId: null, teacherId: null, startWeek: null, endWeek: null }]
    await loadDraftData()
  } catch (e) {
    message.error((e as Error).message || t('teach-drafts.submitFail'))
  } finally {
    submitting.value = false
  }
}

async function handleClearAll() {
  try {
    await clearAllDrafts()
    message.success(t('teach-drafts.clearAllSuccess'))
    await loadDraftData()
  } catch (e) {
    message.error((e as Error).message || t('teach-drafts.clearAllFail'))
  }
}

async function handleClearByClass(classNameVal: string) {
  try {
    await clearDraftsByClass(classNameVal)
    message.success(t('teach-drafts.clearByClassSuccess'))
    await loadDraftData()
  } catch (e) {
    message.error((e as Error).message || t('teach-drafts.clearByClassFail'))
  }
}

async function handleDeleteSingle(row: DraftItem) {
  try {
    await deleteSingleDraft(row.courseId, row.teacherId, row.className)
    message.success(t('teach-drafts.deleteSingleSuccess'))
    await loadDraftData()
  } catch (e) {
    message.error((e as Error).message || t('teach-drafts.deleteSingleFail'))
  }
}

// ---- Scheduling ----
function startPolling() {
  if (!scheduleId.value) return
  pollTimer = setInterval(async () => {
    try {
      const res = await getSolution(scheduleId.value!)
      const data = res.data
      status.value = data.solverStatus
      score.value = data.score
      if (data.solverStatus === 'FINISHED') {
        lessons.value = data.lessonList
        stopPolling()
      }
    } catch {
      // polling error, keep trying
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function handleSolve() {
  solving.value = true
  try {
    const res = await solve()
    if (!res.data) {
      throw new Error(res.message)
    }
    scheduleId.value = res.data.scheduleId
    status.value = 'SOLVING'
    score.value = ''
    lessons.value = []
    message.success(t('scheduling.solveSuccess'))
    startPolling()
  } catch (e) {
    message.error((e as Error).message || t('scheduling.solveFail'))
  } finally {
    solving.value = false
  }
}

async function handleStop() {
  if (!scheduleId.value) return
  try {
    await stopSolving(scheduleId.value)
    stopPolling()
    status.value = 'NOT_SOLVING'
    message.success(t('scheduling.stopSuccess'))
  } catch (e) {
    message.error((e as Error).message || t('scheduling.stopFail'))
  }
}

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="scheduling-page">
    <NSpace vertical :size="16">
      <!-- Action Bar -->
      <NCard :title="$t('scheduling.title')">
        <NSpace align="center">
          <NButton
            v-if="isAcademicAdmin"
            type="primary"
            :loading="solving"
            :disabled="status === 'SOLVING'"
            @click="handleSolve"
          >
            {{ $t('scheduling.startSolve') }}
          </NButton>
          <NButton v-if="isAcademicAdmin" @click="toggleDrafts">
            {{ showDrafts ? $t('scheduling.hideDrafts') : $t('scheduling.viewDrafts') }}
          </NButton>
          <NButton v-if="isAcademicAdmin" @click="toggleData">
            {{ showData ? $t('scheduling.hideData') : $t('scheduling.viewData') }}
          </NButton>
          <NButton v-if="status === 'SOLVING'" type="warning" @click="handleStop">
            {{ $t('scheduling.stopSolve') }}
          </NButton>
        </NSpace>
      </NCard>

      <!-- Draft Section -->
      <template v-if="showDrafts">
        <!-- Draft Form -->
        <NCard v-if="canManageDrafts" :title="$t('teach-drafts.addDraft')">
          <NSpace vertical :size="12">
            <NSelect
              v-model:value="selectedSemesterId"
              :options="semesterOptions"
              :placeholder="$t('semester.title')"
              style="max-width: 400px"
            />
            <PagedSelect
              :model-value="selectedClasses"
              :fetch-page="fetchClassNamesPage"
              :label-of="classNameLabelOf"
              :value-of="classNameValueOf"
              :placeholder="$t('teach-drafts.classNamePlaceholder')"
              multiple
              @update:model-value="onSelectedClassesChange"
            />
            <div v-for="(entry, index) in entries" :key="index">
              <NSpace align="center">
                <PagedSelect
                  :model-value="entry.courseId"
                  :fetch-page="fetchRegularCourses"
                  :label-of="courseLabelOf"
                  :value-of="courseValueOf"
                  :placeholder="$t('teach-drafts.courseIdPlaceholder')"
                  class="scheduling-draft-select-crs"
                  clearable
                  filterable
                  @update:model-value="(v) => onEntryCourseChange(entry, v)"
                />
                <PagedSelect
                  :model-value="entry.teacherId"
                  :fetch-page="fetchTeachersPage"
                  :label-of="teacherLabelOf"
                  :value-of="teacherValueOf"
                  :placeholder="$t('teach-drafts.teacherIdPlaceholder')"
                  class="scheduling-draft-select-tch"
                  clearable
                  filterable
                  @update:model-value="(v) => onEntryTeacherChange(entry, v)"
                />
                <NInput
                  :value="entry.startWeek !== null ? String(entry.startWeek) : ''"
                  :placeholder="$t('teach-drafts.startWeekPlaceholder')"
                  class="scheduling-draft-input-num"
                  @update:value="(v) => onEntryStartWeekChange(entry, v)"
                />
                <NInput
                  :value="entry.endWeek !== null ? String(entry.endWeek) : ''"
                  :placeholder="$t('teach-drafts.endWeekPlaceholder')"
                  class="scheduling-draft-input-num"
                  @update:value="(v) => onEntryEndWeekChange(entry, v)"
                />
                <NButton size="small" secondary @click="removeEntry(index)">
                  {{ $t('teach-drafts.removeCourse') }}
                </NButton>
              </NSpace>
            </div>
            <NSpace>
              <NButton secondary @click="addEntry">{{ $t('teach-drafts.addCourse') }}</NButton>
              <NButton type="primary" :loading="submitting" @click="handleDraftSubmit">
                {{ $t('teach-drafts.submitDrafts') }}
              </NButton>
            </NSpace>
          </NSpace>
        </NCard>

        <!-- Draft Class Summary -->
        <NCard v-if="summary && summary.totalDrafts > 0" :title="$t('teach-drafts.summary')">
          <NSpace vertical>
            <div>
              <NTag type="info"
                >{{ $t('teach-drafts.totalDrafts') }}: {{ summary.totalDrafts }}</NTag
              >
            </div>
            <NGrid :cols="4" :x-gap="12" :y-gap="8">
              <NGi
                v-for="cls in [...summary.classes].sort((a, b) =>
                  a.localeCompare(b, 'zh-CN', { numeric: true }),
                )"
                :key="cls"
              >
                <NCard size="small" class="scheduling-draft-class-card">
                  <div class="scheduling-draft-class-name">{{ cls }}</div>
                  <div class="scheduling-draft-class-count">
                    {{ summary.countByClass[cls] }} 门课
                  </div>
                  <NButton
                    v-if="isAcademicAdmin || canManageDrafts"
                    size="tiny"
                    type="error"
                    @click="handleClearByClass(cls)"
                  >
                    {{ $t('teach-drafts.clearByClass') }}
                  </NButton>
                </NCard>
              </NGi>
            </NGrid>
          </NSpace>
        </NCard>

        <!-- Draft List -->
        <NCard :title="$t('teach-drafts.title')">
          <template v-if="isAcademicAdmin && drafts.length > 0" #header-extra>
            <NPopconfirm @positive-click="handleClearAll">
              <template #default>{{ $t('teach-drafts.clearAllConfirm') }}</template>
              <template #trigger>
                <NButton type="error" size="small">{{ $t('teach-drafts.clearAll') }}</NButton>
              </template>
            </NPopconfirm>
          </template>
          <NSpin :show="draftLoading">
            <NEmpty
              v-if="!draftLoading && drafts.length === 0"
              :description="$t('teach-drafts.empty')"
            />
            <NDataTable
              v-else
              :columns="draftColumns"
              :data="drafts"
              :row-key="draftRowKey"
              :single-line="false"
              :bordered="false"
              :max-height="400"
            />
          </NSpin>
        </NCard>
      </template>

      <!-- Data Preview -->
      <NCard v-if="showData" :title="$t('scheduling.dataTitle')">
        <NSpin :show="dataLoading">
          <NEmpty
            v-if="!dataLoading && teachInfoList.length === 0"
            :description="$t('scheduling.dataEmpty')"
          />
          <NDataTable
            v-else-if="teachInfoList.length > 0"
            :columns="dataColumns"
            :data="teachInfoList"
            :row-key="teachInfoRowKey"
            :single-line="false"
            :bordered="false"
            :max-height="400"
          />
        </NSpin>
      </NCard>

      <!-- Solver Status -->
      <NCard v-if="status !== 'NOT_SOLVING'" :title="$t('scheduling.status')">
        <NSpace vertical :size="12">
          <NSpace align="center">
            <NTag v-if="status === 'SOLVING'" type="info" :bordered="false">
              <template #icon>
                <NSpin :size="14" />
              </template>
              {{ $t('scheduling.statusSolving') }}
            </NTag>
            <NTag v-else-if="status === 'FINISHED'" type="success" :bordered="false">
              {{ $t('scheduling.statusFinished') }}
            </NTag>
            <span v-if="score" class="scheduling-score">
              {{ $t('scheduling.score') }}: {{ score }}
            </span>
          </NSpace>
        </NSpace>
      </NCard>

      <!-- Solve Result -->
      <NCard v-if="status === 'FINISHED' && lessons.length > 0">
        <NEmpty v-if="lessons.length === 0" :description="$t('scheduling.empty')" />
        <NDataTable
          v-else
          :columns="columns"
          :data="lessons"
          :row-key="lessonRowKey"
          :single-line="false"
          :bordered="false"
        />
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped src="./SchedulingPage.css"></style>
