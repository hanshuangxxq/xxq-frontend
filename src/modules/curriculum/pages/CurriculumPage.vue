<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NTabs,
  NTabPane,
  NInput,
  NButton,
  NModal,
  NSpin,
  NEmpty,
  useMessage,
} from 'naive-ui'
import { fetchTeachInfoList, fetchClassCourses, fetchAllTimes } from '../api'
import type { TeachInfo, ClassCourse, TimeSlot } from '../types'

const { t } = useI18n()
const message = useMessage()

const activeTab = ref('courses')

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

// ---- Class Courses tab ----
const classCoursesLoading = ref(false)
const classCourses = ref<ClassCourse[]>([])

async function loadClassCourses() {
  classCoursesLoading.value = true
  try {
    const res = await fetchClassCourses()
    classCourses.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('curriculum.loadFail'))
  } finally {
    classCoursesLoading.value = false
  }
}

// ---- Schedule tab (timetable grid) ----
const loading = ref(false)
const data = ref<TeachInfo[]>([])
const teacherIdFilter = ref('')
const courseIdFilter = ref('')

const scheduleMap = computed(() => {
  const map = new Map<string, TeachInfo>()
  for (const item of data.value) {
    map.set(`${item.timeId}-${item.dayOfWeek}`, item)
  }
  return map
})

const orderedTimeSlots = computed(() => {
  const seen = new Set<number>()
  const slots: { timeId: number; label: string }[] = []
  for (const item of data.value) {
    if (seen.has(item.timeId)) continue
    seen.add(item.timeId)
    const ts = timeMap.value.get(item.timeId)
    slots.push({
      timeId: item.timeId,
      label: ts ? `${formatTime(ts.startPeriod)}-${formatTime(ts.endPeriod)}` : String(item.timeId),
    })
  }
  slots.sort((a, b) => a.label.localeCompare(b.label))
  return slots
})

function getCourseAt(timeId: number, day: number): TeachInfo | undefined {
  return scheduleMap.value.get(`${timeId}-${day}`)
}

const DAYS = [1, 2, 3, 4, 5, 6, 7]

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
    { label: t('curriculum.columnDayOfWeek'), value: getDayLabel(item.dayOfWeek) },
    { label: t('curriculum.columnWeek'), value: item.week },
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
    const query: { teacherId?: number; courseId?: number } = {}
    const tid = parseInt(teacherIdFilter.value, 10)
    const cid = parseInt(courseIdFilter.value, 10)
    if (!isNaN(tid)) query.teacherId = tid
    if (!isNaN(cid)) query.courseId = cid
    const res = await fetchTeachInfoList(Object.keys(query).length > 0 ? query : undefined)
    data.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('curriculum.loadFail'))
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  loadData()
}

function handleReset() {
  teacherIdFilter.value = ''
  courseIdFilter.value = ''
  loadData()
}

watch(activeTab, (tab) => {
  if (tab === 'schedule' && data.value.length === 0) {
    loadData()
  }
})

onMounted(async () => {
  await loadTimes()
  loadClassCourses()
})
</script>

<template>
  <div class="curriculum-page">
    <NCard>
      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane name="courses" :tab="$t('curriculum.tabCourses')">
          <NSpin :show="classCoursesLoading">
            <NEmpty
              v-if="!classCoursesLoading && classCourses.length === 0"
              :description="$t('curriculum.empty')"
            />
            <div v-else class="course-card-grid">
              <NCard
                v-for="(course, index) in classCourses"
                :key="`${course.courseName}-${course.teacherName}-${index}`"
                class="course-card"
                hoverable
              >
                <div class="course-card-name">{{ course.courseName }}</div>
                <div class="course-card-meta">{{ course.teacherName }}</div>
                <div class="course-card-location">
                  {{ course.building }} {{ course.classroom }}
                </div>
              </NCard>
            </div>
          </NSpin>
        </NTabPane>

        <NTabPane name="schedule" :tab="$t('curriculum.tabSchedule')">
          <NSpace vertical :size="16">
            <div class="filter-bar">
              <NSpace align="center" :wrap="true">
                <span class="filter-label">{{ $t('curriculum.teacherId') }}</span>
                <NInput
                  v-model:value="teacherIdFilter"
                  :placeholder="$t('curriculum.teacherIdPlaceholder')"
                  class="filter-input"
                  clearable
                  @keyup.enter="handleSearch"
                />
                <span class="filter-label">{{ $t('curriculum.courseId') }}</span>
                <NInput
                  v-model:value="courseIdFilter"
                  :placeholder="$t('curriculum.courseIdPlaceholder')"
                  class="filter-input"
                  clearable
                  @keyup.enter="handleSearch"
                />
                <NButton type="primary" @click="handleSearch">{{ $t('curriculum.search') }}</NButton>
                <NButton @click="handleReset">{{ $t('curriculum.reset') }}</NButton>
              </NSpace>
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
                        {{ getDayLabel(day) }}
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
          </NSpace>
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
  </div>
</template>

<style scoped src="./CurriculumPage.css"></style>
<style>
.detail-modal {
  width: 420px !important;
  max-width: 90vw;
}
</style>
