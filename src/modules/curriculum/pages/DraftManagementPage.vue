<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NDataTable,
  NButton,
  NInput,
  NSelect,
  NPopconfirm,
  NSpin,
  NEmpty,
  NTag,
  NGrid,
  NGi,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  submitDrafts,
  fetchDrafts,
  fetchDraftClassSummary,
  clearAllDrafts,
  clearDraftsByClass,
  fetchTeachers,
} from '../api'
import { fetchClassNames } from '@/modules/class-names/api'
import { fetchCourses } from '@/modules/course/api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { TeachInfo, DraftClassSummary } from '../types'

function draftRowKey(row: TeachInfo): string {
  return `${row.courseName}-${row.teacherName}-${row.className}-${row.week}`
}

const { t } = useI18n()
const message = useMessage()
const { canManageDrafts } = useRoleCheck()

const loading = ref(false)
const drafts = ref<TeachInfo[]>([])
const summary = ref<DraftClassSummary | null>(null)
const classOptions = ref<{ label: string; value: string }[]>([])
const courseOptions = ref<{ label: string; value: number }[]>([])
const teacherOptions = ref<{ label: string; value: number }[]>([])

const selectedClasses = ref<string[]>([])
const entries = ref<{ courseId: number | null; teacherId: number | null; week: number | null }[]>([
  { courseId: null, teacherId: null, week: null },
])
const submitting = ref(false)

const draftColumns: DataTableColumns<TeachInfo> = [
  { title: t('curriculum.columnClassName'), key: 'className', width: 140, ellipsis: { tooltip: true } },
  { title: t('curriculum.columnCourseName'), key: 'courseName', width: 140, ellipsis: { tooltip: true } },
  { title: t('curriculum.columnTeacherName'), key: 'teacherName', width: 100 },
  { title: t('curriculum.columnWeek'), key: 'week', width: 60, align: 'center' },
  { title: t('curriculum.columnCollege'), key: 'college', width: 100, ellipsis: { tooltip: true } },
]

async function loadData() {
  loading.value = true
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
      .map((c) => ({
        label: `${c.className} (${c.college})`,
        value: c.className,
      }))
    courseOptions.value = courseRes.data
      .sort((a, b) => a.courseName.localeCompare(b.courseName, 'zh-CN'))
      .map((c) => ({ label: `${c.courseName} (${c.courseCode})`, value: c.id }))
    teacherOptions.value = teacherRes.data
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      .map((t) => ({ label: `${t.name} (${t.title})`, value: t.id }))
  } catch (e) {
    message.error((e as Error).message || t('teach-drafts.loadFail'))
  } finally {
    loading.value = false
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

async function handleSubmit() {
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
    await loadData()
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
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('teach-drafts.clearAllFail'))
  }
}

async function handleClearByClass(classNameVal: string) {
  try {
    await clearDraftsByClass(classNameVal)
    message.success(t('teach-drafts.clearByClassSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('teach-drafts.clearByClassFail'))
  }
}

onMounted(loadData)
</script>

<template>
  <div class="draft-page">
    <NSpace vertical :size="16">
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
                class="draft-select-crs"
                clearable
                filterable
              />
              <NSelect
                v-model:value="entry.teacherId"
                :options="teacherOptions"
                :placeholder="$t('teach-drafts.teacherIdPlaceholder')"
                class="draft-select-tch"
                clearable
                filterable
              />
              <NInput
                :value="entry.week !== null ? String(entry.week) : ''"
                :placeholder="$t('teach-drafts.weekPlaceholder')"
                class="draft-input-num"
                @update:value="(v: string) => (entry.week = v ? parseInt(v, 10) : null)"
              />
              <NButton size="small" secondary @click="removeEntry(index)">
                {{ $t('teach-drafts.removeCourse') }}
              </NButton>
            </NSpace>
          </div>
          <NSpace>
            <NButton secondary @click="addEntry">{{ $t('teach-drafts.addCourse') }}</NButton>
            <NButton type="primary" :loading="submitting" @click="handleSubmit">
              {{ $t('teach-drafts.submitDrafts') }}
            </NButton>
          </NSpace>
        </NSpace>
      </NCard>

      <!-- Class Summary -->
      <NCard v-if="summary && summary.totalDrafts > 0" :title="$t('teach-drafts.summary')">
        <NSpace vertical>
          <div>
            <NTag type="info">{{ $t('teach-drafts.totalDrafts') }}: {{ summary.totalDrafts }}</NTag>
          </div>
          <NGrid :cols="4" :x-gap="12" :y-gap="8">
            <NGi v-for="cls in [...summary.classes].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))" :key="cls">
              <NCard size="small" class="draft-class-card">
                <div class="draft-class-name">{{ cls }}</div>
                <div class="draft-class-count">{{ summary.countByClass[cls] }} 门课</div>
                <NButton v-if="canManageDrafts" size="tiny" type="error" @click="handleClearByClass(cls)">
                  {{ $t('teach-drafts.clearByClass') }}
                </NButton>
              </NCard>
            </NGi>
          </NGrid>
        </NSpace>
      </NCard>

      <!-- All Drafts -->
      <NCard :title="$t('teach-drafts.title')">
        <template v-if="canManageDrafts && drafts.length > 0" #header-extra>
          <NPopconfirm @positive-click="handleClearAll">
            <template #default>{{ $t('teach-drafts.clearAllConfirm') }}</template>
            <template #trigger>
              <NButton type="error" size="small">{{ $t('teach-drafts.clearAll') }}</NButton>
            </template>
          </NPopconfirm>
        </template>
        <NSpin :show="loading">
          <NEmpty v-if="!loading && drafts.length === 0" :description="$t('teach-drafts.empty')" />
          <NDataTable
            v-else
            :columns="draftColumns"
            :data="drafts"
            :row-key="draftRowKey"
            :single-line="false"
            :bordered="false"
          />
        </NSpin>
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped>
.draft-page {
  padding: 24px;
}
.draft-select-crs {
  width: 200px;
}
.draft-select-tch {
  width: 180px;
}
.draft-input-num {
  width: 100px;
}
.draft-class-card {
  text-align: center;
}
.draft-class-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}
.draft-class-count {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}
</style>
