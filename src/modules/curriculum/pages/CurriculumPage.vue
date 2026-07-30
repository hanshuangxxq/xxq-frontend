<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NTabs,
  NTabPane,
  NModal,
  NSpin,
  NEmpty,
  NDataTable,
  NScrollbar,
  NButton,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchTeachInfoList, fetchClassCourses, fetchAllTimes, fetchCurrentSemester } from '../api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { TeachInfo, ClassCourse, ClassCourseResponse, TimeSlot, Semester } from '../types'

const { t } = useI18n()
const message = useMessage()
const { isTeacher, isStudent } = useRoleCheck()

const activeTab = ref(isStudent.value ? 'courses' : 'myCourses')

const timeMap = ref<Map<number, TimeSlot>>(new Map())

async function loadTimes() {
  try {
    const res = await fetchAllTimes()
    const map = new Map<number, TimeSlot>()
    for (const slot of res.data) {
      map.set(slot.id, slot)
    }
    timeMap.value = map
  } catch {
    // times are auxiliary, don't block on failure
  }
}

function formatTime(time: string): string {
  return time.substring(0, 5)
}

function getTimeLabel(timeId: number): string {
  const slot = timeMap.value.get(timeId)
  if (!slot) return String(timeId)
  return `${formatTime(slot.startPeriod)}-${formatTime(slot.endPeriod)}`
}

function getDayLabel(day: number): string {
  const days = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return days[day] ?? String(day)
}

const mondayDate = ref<string>('')

function getDayDate(day: number): string {
  if (!mondayDate.value) return ''
  const [y, m, d] = mondayDate.value.split('-').map(Number) as [number, number, number]
  const target = new Date(y, m - 1, d + day - 1)
  return `${target.getMonth() + 1}/${target.getDate()}`
}

function getWeekRangeLabel(startWeek: number, endWeek: number): string {
  return startWeek === endWeek ? `第${startWeek}周` : `第${startWeek}-${endWeek}周`
}

// ---- Student: Class Courses ----
const classCoursesLoading = ref(false)
const classCourses = ref<ClassCourse[]>([])

async function loadClassCourses() {
  classCoursesLoading.value = true
  try {
    const res = await fetchClassCourses()
    const body = res.data as unknown as ClassCourseResponse | ClassCourse[]
    if (Array.isArray(body)) {
      classCourses.value = body
    } else {
      mondayDate.value = body.mondayDate
      classCourses.value = body.courses
    }
  } catch (e) {
    message.error((e as Error).message || t('curriculum.loadFail'))
  } finally {
    classCoursesLoading.value = false
  }
}

// ---- Student: Course detail modal ----
const courseDetailVisible = ref(false)
const courseDetailItem = ref<ClassCourse | null>(null)

// ---- Schedule tab (timetable grid) ----
const loading = ref(false)
const data = ref<TeachInfo[]>([])
const scheduleWeek = ref(1)
const currentSemester = ref<Semester | null>(null)

const totalWeeks = computed(() => currentSemester.value?.endWeek ?? 20)

const weekOptions = computed(() =>
  Array.from({ length: totalWeeks.value }, (_, i) => i + 1),
)

async function loadSemester() {
  try {
    const res = await fetchCurrentSemester()
    currentSemester.value = res.data
    if (!scheduleWeek.value || scheduleWeek.value < 1) {
      scheduleWeek.value = res.data.startWeek
    }
  } catch {
    // non-blocking, fall back to default totalWeeks (20)
  }
}

function selectWeek(week: number) {
  if (week === scheduleWeek.value) return
  scheduleWeek.value = week
  loadData()
}

const scheduleMap = computed(() => {
  const map = new Map<string, TeachInfo>()
  for (const item of data.value) {
    map.set(`${item.timeId}-${item.dayOfWeek}`, item)
  }
  return map
})

const orderedTimeSlots = computed(() => {
  const slots: { timeId: number; label: string }[] = []
  for (const [id, ts] of timeMap.value) {
    slots.push({
      timeId: id,
      label: `${formatTime(ts.startPeriod)}-${formatTime(ts.endPeriod)}`,
    })
  }
  slots.sort((a, b) => a.label.localeCompare(b.label))
  return slots
})

function getCourseAt(timeId: number, day: number): TeachInfo | undefined {
  return scheduleMap.value.get(`${timeId}-${day}`)
}

const DAYS = [1, 2, 3, 4, 5, 6, 7]

// ---- Teacher: My Courses ----
const teacherLoading = ref(false)
const teacherCourses = ref<TeachInfo[]>([])

const teacherColumns: DataTableColumns<TeachInfo> = [
  { title: t('curriculum.columnCourseName'), key: 'courseName', width: 140, ellipsis: { tooltip: true } },
  { title: t('curriculum.columnClassName'), key: 'className', width: 140, ellipsis: { tooltip: true } },
  { title: t('curriculum.columnCollege'), key: 'college', width: 120, ellipsis: { tooltip: true } },
  { title: t('curriculum.columnCourseHour'), key: 'courseHour', width: 60, align: 'center' },
  { title: t('curriculum.columnCourseType'), key: 'courseType', width: 80 },
  { title: t('curriculum.columnBuilding'), key: 'building', width: 100, ellipsis: { tooltip: true } },
  { title: t('curriculum.columnClassroom'), key: 'classroom', width: 80, ellipsis: { tooltip: true } },
]

function teacherRowKey(row: TeachInfo): string {
  return `${row.courseName}-${row.className}`
}

async function loadTeacherCourses() {
  teacherLoading.value = true
  try {
    const res = await fetchTeachInfoList()
    teacherCourses.value = res.data.courses
  } catch (e) {
    message.error((e as Error).message || t('curriculum.loadFail'))
  } finally {
    teacherLoading.value = false
  }
}

// ---- Detail modal ----
const detailVisible = ref(false)
const detailItem = ref<TeachInfo | null>(null)

const detailFields = computed(() => {
  const item = detailItem.value
  if (!item) return []
  return [
    { label: t('curriculum.columnCourseName'), value: item.courseName },
    { label: t('curriculum.columnCredit'), value: item.credit },
    { label: t('curriculum.columnCourseHour'), value: item.courseHour },
    { label: t('curriculum.columnCourseType'), value: item.courseType },
    { label: t('curriculum.columnTeacherName'), value: item.teacherName },
    { label: t('curriculum.columnDepartment'), value: item.department },
    { label: t('curriculum.columnClassName'), value: item.className },
    { label: t('curriculum.columnCollege'), value: item.college },
    { label: t('curriculum.columnDayOfWeek'), value: `${getDayLabel(item.dayOfWeek)} ${getDayDate(item.dayOfWeek)}` },
    { label: t('curriculum.columnWeek'), value: getWeekRangeLabel(item.startWeek, item.endWeek) },
    { label: t('curriculum.columnTime'), value: getTimeLabel(item.timeId) },
    { label: t('curriculum.columnBuilding'), value: item.building },
    { label: t('curriculum.columnClassroom'), value: item.classroom },
  ]
})

function openDetail(item: TeachInfo) {
  detailItem.value = item
  detailVisible.value = true
}

// ---- Data loading ----
async function loadData() {
  loading.value = true
  try {
    const res = await fetchTeachInfoList({ week: scheduleWeek.value })
    mondayDate.value = res.data.mondayDate
    data.value = res.data.courses
  } catch (e) {
    message.error((e as Error).message || t('curriculum.loadFail'))
  } finally {
    loading.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'schedule') {
    if (timeMap.value.size === 0) loadTimes()
    if (data.value.length === 0) loadData()
  }
})

// ---- Init ----
onMounted(async () => {
  await loadTimes()
  await loadSemester()
  if (isStudent.value) {
    await loadClassCourses()
  } else if (isTeacher.value) {
    await loadTeacherCourses()
  }
})
</script>

<template>
  <div class="curriculum-page">
    <NCard>
      <NTabs v-model:value="activeTab" type="line" animated>
        <!-- Student: Class Courses -->
        <NTabPane v-if="isStudent" name="courses" :tab="$t('curriculum.tabCourses')">
          <NSpin :show="classCoursesLoading">
            <NEmpty
              v-if="!classCoursesLoading && classCourses.length === 0"
              :description="$t('curriculum.empty')"
            />
            <div v-else class="course-card-grid">
              <NCard
                v-for="(course, index) in classCourses"
                :key="`${course.courseName}-${index}`"
                class="course-card"
              >
                <div class="course-card-name">{{ course.courseName }}</div>
              </NCard>
            </div>
          </NSpin>
        </NTabPane>

        <!-- Student: Schedule -->
        <NTabPane v-if="isStudent" name="schedule" :tab="$t('curriculum.tabSchedule')">
          <div class="schedule-week-selector">
            <NScrollbar x-scrollable>
              <div class="week-tabs">
                <NButton
                  v-for="week in weekOptions"
                  :key="week"
                  :type="scheduleWeek === week ? 'primary' : 'default'"
                  size="small"
                  @click="selectWeek(week)"
                >
                  {{ $t('curriculum.weekUnit', { n: week }) }}
                </NButton>
              </div>
            </NScrollbar>
          </div>
          <NSpin :show="loading">
            <NEmpty
              v-if="!loading && data.length === 0"
              :description="$t('curriculum.empty')"
            />
            <div v-else class="timetable-wrapper">
              <table class="timetable">
                <thead>
                  <tr>
                    <th class="timetable-time-header"></th>
                    <th v-for="day in DAYS" :key="day" class="timetable-day-header">
                      <div>{{ getDayLabel(day) }}</div>
                      <div class="timetable-day-date">{{ getDayDate(day) }}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="slot in orderedTimeSlots" :key="slot.timeId">
                    <td class="timetable-time-cell">{{ slot.label }}</td>
                    <td
                      v-for="day in DAYS"
                      :key="day"
                      class="timetable-cell"
                      :class="{ 'timetable-cell--filled': getCourseAt(slot.timeId, day) }"
                      @click="getCourseAt(slot.timeId, day) && openDetail(getCourseAt(slot.timeId, day)!)"
                    >
                      <template v-if="getCourseAt(slot.timeId, day)">
                        <div class="cell-course-name">{{ getCourseAt(slot.timeId, day)!.courseName }}</div>
                        <div class="cell-teacher">{{ getCourseAt(slot.timeId, day)!.teacherName }}</div>
                        <div class="cell-location">{{ getCourseAt(slot.timeId, day)!.building }} {{ getCourseAt(slot.timeId, day)!.classroom }}</div>
                      </template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </NSpin>
        </NTabPane>

        <!-- Teacher: My Courses -->
        <NTabPane v-if="isTeacher" name="myCourses" :tab="$t('curriculum.tabMyCourses')">
          <NSpin :show="teacherLoading">
            <NEmpty
              v-if="!teacherLoading && teacherCourses.length === 0"
              :description="$t('curriculum.empty')"
            />
            <NDataTable
              v-else
              :columns="teacherColumns"
              :data="teacherCourses"
              :row-key="teacherRowKey"
              :single-line="false"
              :bordered="false"
            />
          </NSpin>
        </NTabPane>
      </NTabs>
    </NCard>

    <NModal
      v-model:show="detailVisible"
      preset="card"
      :title="$t('curriculum.detail')"
      class="detail-modal"
    >
      <div v-if="detailItem" class="detail-content">
        <div v-for="field in detailFields" :key="field.label" class="detail-row">
          <span class="detail-label">{{ field.label }}</span>
          <span class="detail-value">{{ field.value }}</span>
        </div>
      </div>
    </NModal>

    <NModal
      v-model:show="courseDetailVisible"
      preset="card"
      :title="$t('curriculum.detail')"
      class="detail-modal"
    >
      <div v-if="courseDetailItem" class="detail-content">
        <div class="detail-row">
          <span class="detail-label">{{ $t('curriculum.columnCourseName') }}</span>
          <span class="detail-value">{{ courseDetailItem.courseName }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{ $t('curriculum.columnTeacherName') }}</span>
          <span class="detail-value">{{ courseDetailItem.teacherName }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{ $t('curriculum.columnDayOfWeek') }}</span>
          <span class="detail-value">{{ getDayLabel(courseDetailItem.dayOfWeek) }} {{ getDayDate(courseDetailItem.dayOfWeek) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{ $t('curriculum.columnWeek') }}</span>
          <span class="detail-value">{{ getWeekRangeLabel(courseDetailItem.startWeek, courseDetailItem.endWeek) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{ $t('curriculum.columnTime') }}</span>
          <span class="detail-value">{{ getTimeLabel(courseDetailItem.timeId) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{ $t('curriculum.columnBuilding') }}</span>
          <span class="detail-value">{{ courseDetailItem.building }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{ $t('curriculum.columnClassroom') }}</span>
          <span class="detail-value">{{ courseDetailItem.classroom }}</span>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped src="./CurriculumPage.css"></style>
<style>
.detail-modal {
  width: 420px !important;
  max-width: 90vw;
}
</style>
