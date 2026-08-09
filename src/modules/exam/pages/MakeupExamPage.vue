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
  NDatePicker,
  NTimePicker,
  NSpin,
  NEmpty,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import type { EChartsOption } from 'echarts'
import BaseChart from '@/shared/components/BaseChart.vue'
import {
  fetchMakeupCandidates,
  createMakeupExam,
  fetchMakeupExams,
  enterMakeupGrades,
} from '../api'
import { fetchCourses } from '@/modules/course/api'
import { courseKey, parseCourseKey, isPublicCourse } from '@/modules/course/utils'
import { fetchAllSemesters } from '@/modules/curriculum/api'
import { fetchLocals } from '@/modules/locals/api'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import type { Course } from '@/modules/course/types'
import type { Semester } from '@/modules/curriculum/types'
import type { Local } from '@/modules/locals/types'
import type {
  ExamView,
  MakeupCandidateDto,
  MakeupExamCreateRequest,
  MakeupScoreEntryRequest,
} from '../types'
import { calcDurationMinutes } from '../utils'

const { t } = useI18n()
const message = useMessage()

const semesterOptions = ref<Array<{ label: string; value: number }>>([])

/** 建补考/重修考试仅支持常规课（公选课无 course.id）；端点不支持按 source 过滤，故按页客户端过滤 */
function fetchRegularCourses(page: number, pageSize: number) {
  return fetchCourses(page, pageSize).then((res) => ({
    ...res,
    data: { ...res.data, records: res.data.records.filter((c) => !isPublicCourse(c)) },
  }))
}

// ---- 候选名单 ----
const candCourseKey = ref<string | null>(null)
const candSemesterId = ref<number | null>(null)
const candidates = ref<MakeupCandidateDto[]>([])
const loadingCand = ref(false)

const makeupTypeOptions = computed(() => [
  { label: t('exam.typeMakeup'), value: 'MAKEUP' as const },
  { label: t('exam.typeRetake'), value: 'RETAKE' as const },
])

async function loadCandidates() {
  if (candCourseKey.value == null) {
    message.warning(t('exam.mkCandidateCoursePlaceholder'))
    return
  }
  const sel = parseCourseKey(candCourseKey.value)
  loadingCand.value = true
  try {
    const res = await fetchMakeupCandidates({
      courseId: sel.id,
      source: sel.source === 'SELECTION_CAMPAIGN' ? 'SELECTION_CAMPAIGN' : undefined,
      semesterId: candSemesterId.value ?? undefined,
    })
    candidates.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('exam.mkLoadFail'))
    candidates.value = []
  } finally {
    loadingCand.value = false
  }
}

const candidateColumns = computed<DataTableColumns<MakeupCandidateDto>>(() => [
  { title: t('exam.mkStudentNo'), key: 'studentNo', width: 130 },
  { title: t('exam.mkStudentName'), key: 'studentName', width: 120 },
  { title: t('exam.mkTotalScore'), key: 'totalScore', width: 100, align: 'center' },
  { title: t('exam.mkScoreLevel'), key: 'scoreLevel', width: 90, align: 'center' },
])

const failDistOption = computed<EChartsOption>(() => {
  let low = 0
  let mid = 0
  let high = 0
  for (const c of candidates.value) {
    if (c.totalScore < 50) low++
    else if (c.totalScore < 55) mid++
    else high++
  }
  const rangeLabels = ['0-49', '50-54', '55-59']
  const rangeData = [low, mid, high]
  return {
    title: {
      text: t('exam.mkFailDist'),
      top: 10,
      left: 10,
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b} : {c}',
    },
    toolbox: {
      show: true,
      top: 10,
      right: 10,
      feature: {
        mark: { show: true },
        magicType: { show: true, type: ['line', 'bar'] },
        restore: { show: true },
        saveAsImage: { show: true },
      },
    },
    grid: {
      top: 60,
      right: 70,
      bottom: 30,
      left: 60,
    },
    legend: {
      top: 32,
      left: 'center',
      data: [t('score.statTotalCount')],
    },
    xAxis: {
      type: 'category',
      data: rangeLabels,
    },
    yAxis: {
      type: 'value',
      name: t('score.statTotalCount'),
      nameLocation: 'center',
      nameGap: 40,
      nameRotate: 0,
      nameTextStyle: { fontSize: 16 },
      min: 0,
      axisLabel: {
        show: true,
        showMinLabel: true,
        showMaxLabel: true,
        formatter: (value: number) => String(value),
      },
    },
    series: [
      {
        name: t('score.statTotalCount'),
        type: 'bar',
        yAxisIndex: 0,
        data: rangeData,
      },
    ],
  }
})

// ---- 创建补考/重修考试 ----
const showCreate = ref(false)
const creating = ref(false)
const createForm = ref({
  examName: '',
  courseId: null as number | null,
  examType: 'MAKEUP' as 'MAKEUP' | 'RETAKE',
  semesterId: null as number | null,
  sourceSemesterId: null as number | null,
  examDateTs: null as number | null,
  startTimeTs: null as number | null,
  durationMinutes: null as number | null,
  localId: null as number | null,
  notes: '',
})

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

function openCreate() {
  // 建补考仅支持常规课；若当前筛选的是公选课，预填 null 由用户在常规课列表中重选
  const sel = candCourseKey.value ? parseCourseKey(candCourseKey.value) : null
  const presetCourseId = sel && sel.source !== 'SELECTION_CAMPAIGN' ? sel.id : null
  createForm.value = {
    examName: '',
    courseId: presetCourseId,
    examType: 'MAKEUP',
    semesterId: null,
    sourceSemesterId: candSemesterId.value,
    examDateTs: null,
    startTimeTs: null,
    durationMinutes: null,
    localId: null,
    notes: '',
  }
  showCreate.value = true
}

async function handleCreate() {
  const f = createForm.value
  if (!f.examName.trim()) return message.warning(t('exam.mkExamNameRequired'))
  if (f.courseId == null) return message.warning(t('exam.mkCourseRequired'))
  if (f.semesterId == null) return message.warning(t('exam.mkSemesterRequired'))
  if (f.examDateTs == null) return message.warning(t('exam.mkExamDateRequired'))
  if (f.startTimeTs == null) return message.warning(t('exam.mkStartTimeRequired'))
  if (f.durationMinutes == null || f.durationMinutes <= 0) {
    return message.warning(t('exam.mkDurationRequired'))
  }
  const body: MakeupExamCreateRequest = {
    examName: f.examName.trim(),
    courseId: f.courseId,
    examType: f.examType,
    semesterId: f.semesterId,
    sourceSemesterId: f.sourceSemesterId ?? undefined,
    examDate: tsToDateStr(f.examDateTs),
    startTime: tsToTimeStr(f.startTimeTs),
    durationMinutes: f.durationMinutes,
    localId: f.localId,
    notes: f.notes || undefined,
  }
  creating.value = true
  try {
    await createMakeupExam(body)
    message.success(t('exam.mkSaveSuccess'))
    showCreate.value = false
    await loadMakeupExams()
  } catch (e) {
    message.error((e as Error).message || t('exam.mkSaveFail'))
  } finally {
    creating.value = false
  }
}

// ---- 补考/重修考试列表 ----
const listSemesterId = ref<number | null>(null)
const makeupExams = ref<ExamView[]>([])
const loadingList = ref(false)

async function loadMakeupExams() {
  loadingList.value = true
  try {
    const res = await fetchMakeupExams(listSemesterId.value ?? undefined)
    makeupExams.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('exam.mkLoadFail'))
    makeupExams.value = []
  } finally {
    loadingList.value = false
  }
}

// ---- 录入成绩 ----
interface GradeRow extends MakeupCandidateDto {
  score: number | null
}
const showGrades = ref(false)
const gradeExam = ref<ExamView | null>(null)
const gradeRows = ref<GradeRow[]>([])
const loadingGrades = ref(false)
const gradeSaving = ref(false)

async function openGrades(row: ExamView) {
  gradeExam.value = row
  showGrades.value = true
  gradeRows.value = []
  // 补考/重修考试仅针对常规课建考（公选课 courseId 为 null，理论上不会出现在此列表）
  if (row.courseId == null) {
    loadingGrades.value = false
    return
  }
  loadingGrades.value = true
  try {
    // ExamView 未暴露来源学期，按考试学期回退（后端建考时已写入考生名单）
    const res = await fetchMakeupCandidates({
      courseId: row.courseId,
      semesterId: row.semesterId,
    })
    gradeRows.value = res.data.map((c) => ({ ...c, score: null }))
  } catch (e) {
    message.error((e as Error).message || t('exam.mkLoadFail'))
  } finally {
    loadingGrades.value = false
  }
}

async function handleSaveGrades() {
  if (gradeExam.value == null) return
  const entries: MakeupScoreEntryRequest[] = []
  for (const r of gradeRows.value) {
    if (r.score == null) continue
    if (r.score < 0 || r.score > 100) return message.warning(t('exam.mkScoreRequired'))
    entries.push({ studentUserId: r.studentUserId, score: r.score })
  }
  if (entries.length === 0) return message.warning(t('exam.mkScoreRequired'))
  gradeSaving.value = true
  try {
    await enterMakeupGrades(gradeExam.value.id, entries)
    message.success(t('exam.mkSubmitSuccess'))
    showGrades.value = false
  } catch (e) {
    message.error((e as Error).message || t('exam.mkSubmitFail'))
  } finally {
    gradeSaving.value = false
  }
}

const gradeColumns = computed<DataTableColumns<GradeRow>>(() => [
  { title: t('exam.mkStudentNo'), key: 'studentNo', width: 130 },
  { title: t('exam.mkStudentName'), key: 'studentName', width: 120 },
  { title: t('exam.mkTotalScore'), key: 'totalScore', width: 100, align: 'center' },
  {
    title: t('exam.mkScore'),
    key: 'score',
    width: 140,
    render: (row) =>
      h(NInputNumber, {
        value: row.score,
        min: 0,
        max: 100,
        showButton: false,
        placeholder: '0-100',
        onUpdateValue: (v: number | null) => {
          row.score = v
        },
      }),
  },
])

const makeupListColumns = computed<DataTableColumns<ExamView>>(() => [
  { title: t('exam.mkExamName'), key: 'examName', minWidth: 200, ellipsis: { tooltip: true } },
  { title: t('exam.mkCourse'), key: 'courseName', width: 140, ellipsis: { tooltip: true } },
  { title: t('exam.mkExamType'), key: 'examType', width: 90 },
  { title: t('exam.mkDate'), key: 'examDate', width: 120 },
  {
    title: t('exam.mkTime'),
    key: 'time',
    width: 150,
    render: (r) => `${r.startTime?.slice(0, 5) ?? ''} - ${r.endTime?.slice(0, 5) ?? ''}`,
  },
  {
    title: t('exam.mkDuration'),
    key: 'duration',
    width: 130,
    align: 'center',
    render: (r) => {
      const m = calcDurationMinutes(r.startTime, r.endTime)
      return m == null ? '-' : String(m)
    },
  },
  { title: t('exam.mkLocation'), key: 'localName', width: 120, render: (r) => r.localName || '-' },
  {
    title: t('exam.mkActions'),
    key: 'actions',
    width: 120,
    render: (row) =>
      h(NButton, { size: 'small', type: 'primary', onClick: () => openGrades(row) }, () =>
        t('exam.mkEnterGrades'),
      ),
  },
])

async function loadDropdowns() {
  try {
    const semRes = await fetchAllSemesters()
    semesterOptions.value = semRes.data.map((s: Semester) => ({ label: s.name, value: s.id }))
  } catch {
    // 非阻塞
  }
}

onMounted(() => {
  loadDropdowns()
  loadMakeupExams()
})
</script>

<template>
  <div class="makeup-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('exam.mkCandidates')">
        <template #header-extra>
          <NButton type="primary" :disabled="candCourseKey == null" @click="openCreate">
            {{ $t('exam.mkCreate') }}
          </NButton>
        </template>
        <NSpace align="center" :size="12" wrap>
          <PagedSelect
            :model-value="candCourseKey"
            :fetch-page="(page: number, pageSize: number) => fetchCourses(page, pageSize)"
            :label-of="
              (c: Course) =>
                isPublicCourse(c) ? `${c.courseName}（${t('common.publicTag')}）` : c.courseName
            "
            :value-of="(c: Course) => courseKey(c.id, c.source)"
            :placeholder="$t('exam.mkCandidateCoursePlaceholder')"
            style="width: 220px"
            @update:model-value="
              (v: string | number | null | Array<string | number>) =>
                (candCourseKey = (v as string) ?? null)
            "
          />
          <NSelect
            v-model:value="candSemesterId"
            :options="semesterOptions"
            :placeholder="$t('exam.mkAllSemester')"
            clearable
            style="width: 180px"
          />
          <NButton type="primary" @click="loadCandidates">{{ $t('exam.mkQuery') }}</NButton>
        </NSpace>
        <NSpin :show="loadingCand">
          <NEmpty
            v-if="!loadingCand && candidates.length === 0"
            class="candidates-empty"
            :description="$t('exam.mkNoCandidates')"
          />
          <template v-else>
            <NDataTable
              :columns="candidateColumns"
              :data="candidates"
              :row-key="(r: MakeupCandidateDto) => r.studentUserId"
              :single-line="false"
              :bordered="false"
            />
            <div class="chart-card">
              <div class="chart-box"><BaseChart :option="failDistOption" /></div>
            </div>
          </template>
        </NSpin>
      </NCard>

      <NCard :title="$t('exam.mkList')">
        <template #header-extra>
          <NSelect
            v-model:value="listSemesterId"
            :options="semesterOptions"
            :placeholder="$t('exam.mkAllSemester')"
            clearable
            style="width: 180px"
            @update:value="loadMakeupExams"
          />
        </template>
        <NSpin :show="loadingList">
          <NEmpty
            v-if="!loadingList && makeupExams.length === 0"
            :description="$t('exam.mkEmpty')"
          />
          <NDataTable
            v-else
            :columns="makeupListColumns"
            :data="makeupExams"
            :row-key="(r: ExamView) => r.id"
            :single-line="false"
            :bordered="false"
            :scroll-x="1130"
          />
        </NSpin>
      </NCard>
    </NSpace>

    <!-- 创建补考/重修考试 -->
    <NModal
      v-model:show="showCreate"
      preset="card"
      :title="$t('exam.mkCreateTitle')"
      class="makeup-form-modal"
    >
      <NForm :model="createForm" label-placement="top">
        <NFormItem :label="$t('exam.mkExamName')" required>
          <NInput
            v-model:value="createForm.examName"
            :placeholder="$t('exam.mkExamNamePlaceholder')"
          />
        </NFormItem>
        <NSpace :size="12" wrap>
          <NFormItem :label="$t('exam.mkCourse')" required style="width: 220px">
            <PagedSelect
              :model-value="createForm.courseId"
              :fetch-page="fetchRegularCourses"
              :label-of="(c: Course) => c.courseName"
              :value-of="(c: Course) => c.id"
              @update:model-value="
                (v: string | number | null | Array<string | number>) =>
                  (createForm.courseId = v as number | null)
              "
            />
          </NFormItem>
          <NFormItem :label="$t('exam.mkExamType')" required style="width: 140px">
            <NSelect v-model:value="createForm.examType" :options="makeupTypeOptions" />
          </NFormItem>
          <NFormItem :label="$t('exam.mkSemester')" required style="width: 180px">
            <NSelect v-model:value="createForm.semesterId" :options="semesterOptions" />
          </NFormItem>
        </NSpace>
        <NFormItem :label="$t('exam.mkSourceSemester')">
          <NSelect
            v-model:value="createForm.sourceSemesterId"
            :options="semesterOptions"
            clearable
            :placeholder="$t('exam.mkSourceSemesterHint')"
          />
        </NFormItem>
        <NSpace :size="12" wrap>
          <NFormItem :label="$t('exam.mkExamDate')" required style="width: 200px">
            <NDatePicker
              v-model:value="createForm.examDateTs"
              type="date"
              format="yyyy-MM-dd"
              clearable
            />
          </NFormItem>
          <NFormItem :label="$t('exam.mkStartTime')" required style="width: 160px">
            <NTimePicker v-model:value="createForm.startTimeTs" format="HH:mm" clearable />
          </NFormItem>
          <NFormItem :label="$t('exam.mkDuration')" required style="width: 160px">
            <NInputNumber
              v-model:value="createForm.durationMinutes"
              :min="1"
              :placeholder="$t('exam.mkDurationPlaceholder')"
              clearable
              style="width: 100%"
            />
          </NFormItem>
        </NSpace>
        <NFormItem :label="$t('exam.mkLocal')">
          <PagedSelect
            :model-value="createForm.localId"
            :fetch-page="(page: number, pageSize: number) => fetchLocals({ page, pageSize })"
            :label-of="(l: Local) => `${l.building} ${l.classRoom}`"
            :value-of="(l: Local) => l.id"
            clearable
            style="width: 240px"
            @update:model-value="
              (v: string | number | null | Array<string | number>) =>
                (createForm.localId = v as number | null)
            "
          />
        </NFormItem>
        <NFormItem :label="$t('exam.mkNotes')">
          <NInput
            v-model:value="createForm.notes"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreate = false">{{ $t('exam.mkCancel') }}</NButton>
          <NButton type="primary" :loading="creating" @click="handleCreate">{{
            $t('exam.mkSave')
          }}</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 录入成绩 -->
    <NModal
      v-model:show="showGrades"
      preset="card"
      :title="$t('exam.mkEnterTitle')"
      class="makeup-grade-modal"
    >
      <NSpin :show="loadingGrades">
        <NEmpty
          v-if="!loadingGrades && gradeRows.length === 0"
          :description="$t('exam.mkNoCandidates')"
        />
        <NDataTable
          v-else
          :columns="gradeColumns"
          :data="gradeRows"
          :row-key="(r: GradeRow) => r.studentUserId"
          :single-line="false"
          :bordered="false"
          :max-height="420"
        />
      </NSpin>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showGrades = false">{{ $t('exam.mkCancel') }}</NButton>
          <NButton type="primary" :loading="gradeSaving" @click="handleSaveGrades">
            {{ $t('exam.mkSubmit') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./MakeupExamPage.css"></style>

<style>
.makeup-form-modal {
  width: 620px;
  max-width: 92vw;
}

.makeup-grade-modal {
  width: 640px;
  max-width: 92vw;
}
</style>
