<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
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
  clearDraftsByClass,
  deleteSingleDraft,
  fetchTeachers,
  fetchAllSemesters,
  fetchCurrentSemester,
} from '../api'
import { fetchClassNames } from '@/modules/class-names/api'
import { fetchColleges } from '@/modules/college/api'
import { fetchCourses } from '@/modules/course/api'
import { isPublicCourse } from '@/modules/course/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import type { DraftItem, DraftClassSummary, Semester } from '../types'
import type { ClassName } from '@/modules/class-names/types'
import type { College } from '@/modules/college/types'
import type { Course } from '@/modules/course/types'
import type { Teacher } from '@/modules/curriculum/types'

function draftRowKey(row: DraftItem): string {
  return `${row.courseId}-${row.teacherId}-${row.className}`
}

const { t } = useI18n()
const message = useMessage()
const { canManageDrafts } = useRoleCheck()

const loading = ref(false)
const drafts = ref<DraftItem[]>([])
const summary = ref<DraftClassSummary | null>(null)

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

const selectedClasses = ref<string[]>([])
const entries = ref<
  {
    courseId: number | null
    teacherId: number | null
    startWeek: number | null
    endWeek: number | null
  }[]
>([{ courseId: null, teacherId: null, startWeek: null, endWeek: null }])
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
    if (cur && !selectedSemesterId.value) {
      selectedSemesterId.value = cur.id
    }
  } catch {
    // non-blocking
  }
}

const draftColumns: DataTableColumns<DraftItem> = [
  {
    title: t('curriculum.columnClassName'),
    key: 'className',
    width: 140,
    ellipsis: { tooltip: true },
  },
  {
    title: t('curriculum.columnCourseName'),
    key: 'courseName',
    width: 140,
    ellipsis: { tooltip: true },
  },
  { title: t('curriculum.columnTeacherName'), key: 'teacherName', width: 100 },
  {
    title: t('curriculum.columnWeek'),
    key: 'week',
    width: 100,
    align: 'center',
    render(row) {
      return row.startWeek === row.endWeek
        ? `第${row.startWeek}周`
        : `第${row.startWeek}-${row.endWeek}周`
    },
  },
  { title: t('curriculum.columnCollege'), key: 'college', width: 100, ellipsis: { tooltip: true } },
  {
    title: t('teach-drafts.actions'),
    key: 'actions',
    width: 80,
    render(row) {
      if (!canManageDrafts.value) return null
      return h(
        NPopconfirm,
        { onPositiveClick: () => handleDeleteSingle(row) },
        {
          default: () => t('teach-drafts.deleteSingleConfirm'),
          trigger: () =>
            h(NButton, { type: 'error', size: 'tiny' }, () => t('teach-drafts.deleteSingle')),
        },
      )
    },
  },
]

async function loadData() {
  loading.value = true
  try {
    const [draftRes, summaryRes] = await Promise.all([fetchDrafts(), fetchDraftClassSummary()])
    if (semesterOptions.value.length === 0) loadSemesters()
    drafts.value = draftRes.data
    summary.value = summaryRes.data
  } catch (e) {
    message.error((e as Error).message || t('teach-drafts.loadFail'))
  } finally {
    loading.value = false
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
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('teach-drafts.submitFail'))
  } finally {
    submitting.value = false
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

async function handleDeleteSingle(row: DraftItem) {
  try {
    await deleteSingleDraft(row.courseId, row.teacherId, row.className)
    message.success(t('teach-drafts.deleteSingleSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('teach-drafts.deleteSingleFail'))
  }
}

onMounted(() => {
  loadData()
  loadColleges()
})
</script>

<template>
  <div class="draft-page">
    <NSpace vertical :size="16">
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
            :fetch-page="(page: number, pageSize: number) => fetchClassNames(page, pageSize)"
            :label-of="(c: ClassName) => classNameLabel(c)"
            :value-of="(c: ClassName) => c.className"
            :placeholder="$t('teach-drafts.classNamePlaceholder')"
            multiple
            @update:model-value="
              (v: string | number | null | Array<string | number>) =>
                (selectedClasses = v as string[])
            "
          />
          <div v-for="(entry, index) in entries" :key="index">
            <NSpace align="center">
              <PagedSelect
                :model-value="entry.courseId"
                :fetch-page="fetchRegularCourses"
                :label-of="(c: Course) => `${c.courseName} (${c.courseCode})`"
                :value-of="(c: Course) => c.id"
                :placeholder="$t('teach-drafts.courseIdPlaceholder')"
                class="draft-select-crs"
                clearable
                filterable
                @update:model-value="
                  (v: string | number | null | Array<string | number>) =>
                    (entry.courseId = v as number | null)
                "
              />
              <PagedSelect
                :model-value="entry.teacherId"
                :fetch-page="(page: number, pageSize: number) => fetchTeachers(page, pageSize)"
                :label-of="(tch: Teacher) => `${tch.name} (${tch.title})`"
                :value-of="(tch: Teacher) => tch.id"
                :placeholder="$t('teach-drafts.teacherIdPlaceholder')"
                class="draft-select-tch"
                clearable
                filterable
                @update:model-value="
                  (v: string | number | null | Array<string | number>) =>
                    (entry.teacherId = v as number | null)
                "
              />
              <NInput
                :value="entry.startWeek !== null ? String(entry.startWeek) : ''"
                :placeholder="$t('teach-drafts.startWeekPlaceholder')"
                class="draft-input-num"
                @update:value="(v: string) => (entry.startWeek = v ? parseInt(v, 10) : null)"
              />
              <NInput
                :value="entry.endWeek !== null ? String(entry.endWeek) : ''"
                :placeholder="$t('teach-drafts.endWeekPlaceholder')"
                class="draft-input-num"
                @update:value="(v: string) => (entry.endWeek = v ? parseInt(v, 10) : null)"
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
            <NGi
              v-for="cls in [...summary.classes].sort((a, b) =>
                a.localeCompare(b, 'zh-CN', { numeric: true }),
              )"
              :key="cls"
            >
              <NCard size="small" class="draft-class-card">
                <div class="draft-class-name">{{ cls }}</div>
                <div class="draft-class-count">{{ summary.countByClass[cls] }} 门课</div>
                <NButton
                  v-if="canManageDrafts"
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

      <!-- All Drafts -->
      <NCard :title="$t('teach-drafts.title')">
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
.draft-page :deep(.n-base-selection-placeholder) {
  user-select: none;
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
