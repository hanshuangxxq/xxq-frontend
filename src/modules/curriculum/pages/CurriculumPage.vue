<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NDataTable,
  NInput,
  NButton,
  NModal,
  NSpin,
  NEmpty,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchTeachInfoList, fetchTeachInfo } from '../api'
import type { TeachInfo } from '../types'

const { t } = useI18n()
const message = useMessage()

const loading = ref(false)
const data = ref<TeachInfo[]>([])
const teacherIdFilter = ref('')
const courseIdFilter = ref('')

const columns = computed<DataTableColumns<TeachInfo>>(() => [
  { title: t('curriculum.columnId'), key: 'id', width: 60, titleAlign: 'center', align: 'center' },
  {
    title: t('curriculum.columnCourseName'),
    key: 'courseName',
    width: 140,
    ellipsis: { tooltip: true },
  },
  { title: t('curriculum.columnCourseCode'), key: 'courseCode', width: 110 },
  { title: t('curriculum.columnCredit'), key: 'credit', width: 60, align: 'center' },
  { title: t('curriculum.columnCourseHour'), key: 'courseHour', width: 60, align: 'center' },
  { title: t('curriculum.columnCourseType'), key: 'courseType', width: 80 },
  {
    title: t('curriculum.columnTeacherName'),
    key: 'teacherName',
    width: 100,
    ellipsis: { tooltip: true },
  },
  { title: t('curriculum.columnTeacherNo'), key: 'teacherNo', width: 110 },
  { title: t('curriculum.columnTitle'), key: 'title', width: 80 },
  {
    title: t('curriculum.columnDepartment'),
    key: 'department',
    width: 100,
    ellipsis: { tooltip: true },
  },
  {
    title: t('curriculum.columnClassName'),
    key: 'className',
    width: 110,
    ellipsis: { tooltip: true },
  },
  {
    title: t('curriculum.columnCollege'),
    key: 'college',
    width: 120,
    ellipsis: { tooltip: true },
  },
  {
    title: t('curriculum.columnDayOfWeek'),
    key: 'dayOfWeek',
    width: 50,
    align: 'center',
  },
  {
    title: t('curriculum.columnPeriod'),
    key: 'period',
    width: 70,
    align: 'center',
    render(row) {
      return `${row.startPeriod}-${row.endPeriod}`
    },
  },
  {
    title: t('curriculum.columnBuilding'),
    key: 'building',
    width: 100,
    ellipsis: { tooltip: true },
  },
  {
    title: t('curriculum.columnClassroom'),
    key: 'classroom',
    width: 70,
    ellipsis: { tooltip: true },
  },
])

const detailVisible = ref(false)
const detailItem = ref<TeachInfo | null>(null)
const detailLoading = ref(false)

const detailFields = computed(() => {
  const item = detailItem.value
  if (!item) return []
  return [
    { label: t('curriculum.columnId'), value: item.id },
    { label: t('curriculum.columnCourseName'), value: item.courseName },
    { label: t('curriculum.columnCourseCode'), value: item.courseCode },
    { label: t('curriculum.columnCredit'), value: item.credit },
    { label: t('curriculum.columnCourseHour'), value: item.courseHour },
    { label: t('curriculum.columnCourseType'), value: item.courseType },
    { label: t('curriculum.columnTeacherName'), value: item.teacherName },
    { label: t('curriculum.columnTeacherNo'), value: item.teacherNo },
    { label: t('curriculum.columnTitle'), value: item.title },
    { label: t('curriculum.columnDepartment'), value: item.department },
    { label: t('curriculum.columnClassName'), value: item.className },
    { label: t('curriculum.columnCollege'), value: item.college },
    { label: t('curriculum.columnDayOfWeek'), value: item.dayOfWeek },
    { label: t('curriculum.columnPeriod'), value: `${item.startPeriod}-${item.endPeriod}` },
    { label: t('curriculum.columnBuilding'), value: item.building },
    { label: t('curriculum.columnClassroom'), value: item.classroom },
  ]
})

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

function rowProps(row: TeachInfo) {
  return {
    style: 'cursor: pointer',
    onClick: () => handleRowClick(row),
  }
}

async function handleRowClick(row: TeachInfo) {
  detailVisible.value = true
  detailLoading.value = true
  try {
    const res = await fetchTeachInfo(row.id)
    detailItem.value = res.data
  } catch {
    message.error(t('curriculum.notFound'))
    detailItem.value = row
  } finally {
    detailLoading.value = false
  }
}

function rowKey(row: TeachInfo): number {
  return row.id
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="curriculum-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('curriculum.title')">
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
      </NCard>

      <NCard>
        <NSpin :show="loading">
          <NEmpty v-if="!loading && data.length === 0" :description="$t('curriculum.empty')" />
          <NDataTable
            v-else
            :columns="columns"
            :data="data"
            :row-key="rowKey"
            :row-props="rowProps"
            :single-line="false"
            :bordered="false"
            class="teachinfo-table"
          />
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="detailVisible"
      preset="card"
      :title="$t('curriculum.detail')"
      class="detail-modal"
    >
      <NSpin :show="detailLoading">
        <div v-if="detailItem" class="detail-content">
          <div v-for="field in detailFields" :key="field.label" class="detail-row">
            <span class="detail-label">{{ field.label }}</span>
            <span class="detail-value">{{ field.value }}</span>
          </div>
        </div>
      </NSpin>
    </NModal>
  </div>
</template>

<style scoped src="./CurriculumPage.css"></style>
