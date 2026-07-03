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
} from '@/modules/curriculum/api'
import type { TeachInfo, TimeSlot, DraftClassSummary, DraftItem } from '@/modules/curriculum/types'
import { fetchClassNames } from '@/modules/class-names/api'
import { fetchCourses } from '@/modules/course/api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { ScheduleSolution, ScheduledLesson } from '../types'

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
const classOptions = ref<{ label: string; value: string }[]>([])
const courseOptions = ref<{ label: string; value: number }[]>([])
const teacherOptions = ref<{ label: string; value: number }[]>([])
const selectedClasses = ref<string[]>([])
const entries = ref<{ courseId: number | null; teacherId: number | null; week: number | null }[]>([
  { courseId: null, teacherId: null, week: null },
])
const submitting = ref(false)

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
  { title: t('scheduling.columnCourseName'), key: 'courseName', width: 140, ellipsis: { tooltip: true } },
  { title: t('scheduling.columnTeacherName'), key: 'teacherName', width: 100 },
  { title: t('scheduling.columnCollege'), key: 'college', width: 120, ellipsis: { tooltip: true } },
  { title: t('teach-drafts.week'), key: 'week', width: 60, align: 'center' },
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
    const [teachRes, timeRes] = await Promise.all([
      fetchTeachInfoList(),
      fetchAllTimes(),
    ])
    teachInfoList.value = teachRes.data
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
async function loadDraftData() {
  draftLoading.value = true
  try {
    const [draftRes, summaryRes, classRes, courseRes, teacherRes] = await Promise.all([
      fetchDrafts(),
      fetchDraftClassSummary(),
      fetchClassNames(),
      fetchCourses(),
      fetchTeachers(),
    ])
    drafts.value = draftRes.data
    summary.value = summaryRes.data
    classOptions.value = classRes.data
      .sort((a, b) => a.className.localeCompare(b.className, 'zh-CN', { numeric: true }))
      .map((c) => ({ label: `${c.className} (${c.college})`, value: c.className }))
    courseOptions.value = courseRes.data
      .sort((a, b) => a.courseName.localeCompare(b.courseName, 'zh-CN'))
      .map((c) => ({ label: `${c.courseName} (${c.courseCode})`, value: c.id }))
    teacherOptions.value = teacherRes.data
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      .map((t) => ({ label: `${t.name} (${t.title})`, value: t.id }))
  } catch (e) {
    message.error((e as Error).message || t('teach-drafts.loadFail'))
  } finally {
    draftLoading.value = false
  }
}

function toggleDrafts() {
  showDrafts.value = !showDrafts.value
  if (showDrafts.value && drafts.value.length === 0) {
    loadDraftData()
  }
}

function addEntry() {
  entries.value.push({ courseId: null, teacherId: null, week: null })
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
      week: e.week ?? undefined,
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
    entries.value = [{ courseId: null, teacherId: null, week: null }]
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
          <NButton
            v-if="isAcademicAdmin"
            @click="toggleDrafts"
          >
            {{ showDrafts ? $t('scheduling.hideDrafts') : $t('scheduling.viewDrafts') }}
          </NButton>
          <NButton
            v-if="isAcademicAdmin"
            @click="toggleData"
          >
            {{ showData ? $t('scheduling.hideData') : $t('scheduling.viewData') }}
          </NButton>
          <NButton
            v-if="status === 'SOLVING'"
            type="warning"
            @click="handleStop"
          >
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
              v-model:value="selectedClasses"
              multiple
              :options="classOptions"
              :placeholder="$t('teach-drafts.classNamePlaceholder')"
            />
            <div v-for="(entry, index) in entries" :key="index">
              <NSpace align="center">
                <NSelect
                  v-model:value="entry.courseId"
                  :options="courseOptions"
                  :placeholder="$t('teach-drafts.courseIdPlaceholder')"
                  class="scheduling-draft-select-crs"
                  clearable
                  filterable
                />
                <NSelect
                  v-model:value="entry.teacherId"
                  :options="teacherOptions"
                  :placeholder="$t('teach-drafts.teacherIdPlaceholder')"
                  class="scheduling-draft-select-tch"
                  clearable
                  filterable
                />
                <NInput
                  :value="entry.week !== null ? String(entry.week) : ''"
                  :placeholder="$t('teach-drafts.weekPlaceholder')"
                  class="scheduling-draft-input-num"
                  @update:value="(v: string) => (entry.week = v ? parseInt(v, 10) : null)"
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
              <NTag type="info">{{ $t('teach-drafts.totalDrafts') }}: {{ summary.totalDrafts }}</NTag>
            </div>
            <NGrid :cols="4" :x-gap="12" :y-gap="8">
              <NGi v-for="cls in [...summary.classes].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))" :key="cls">
                <NCard size="small" class="scheduling-draft-class-card">
                  <div class="scheduling-draft-class-name">{{ cls }}</div>
                  <div class="scheduling-draft-class-count">{{ summary.countByClass[cls] }} 门课</div>
                  <NButton v-if="isAcademicAdmin || canManageDrafts" size="tiny" type="error" @click="handleClearByClass(cls)">
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
            <NEmpty v-if="!draftLoading && drafts.length === 0" :description="$t('teach-drafts.empty')" />
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
            :row-key="(row: TeachInfo) => `${row.courseName}-${row.className}-${row.dayOfWeek}-${row.timeId}`"
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
        <NEmpty
          v-if="lessons.length === 0"
          :description="$t('scheduling.empty')"
        />
        <NDataTable
          v-else
          :columns="columns"
          :data="lessons"
          :row-key="(l: ScheduledLesson) => l.id"
          :single-line="false"
          :bordered="false"
        />
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped src="./SchedulingPage.css"></style>
