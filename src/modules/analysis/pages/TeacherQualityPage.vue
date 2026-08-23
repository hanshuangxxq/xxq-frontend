<script setup lang="ts">
import { ref, computed, h, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NSelect,
  NDataTable,
  NSpin,
  NEmpty,
  NTag,
  NModal,
  NDescriptions,
  NDescriptionsItem,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import type { EChartsOption } from 'echarts'
import BaseChart from '@/shared/components/BaseChart.vue'
import StatCard from '@/shared/components/StatCard.vue'
import { fetchAllPages } from '@/shared/pagination'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import { getMyTeacherQuality, fetchTeacherQualityList } from '../api'
import { fetchAllSemesters } from '@/modules/curriculum/api'
import type { Semester } from '@/modules/curriculum/types'
import type { TeacherQualityDto } from '../types'
import { useChartTheme } from '@/shared/chartTheme'

const { t } = useI18n()
const message = useMessage()
const { isTeacher } = useRoleCheck()
const { tokens } = useChartTheme()

const semesterOptions = ref<Array<{ label: string; value: number }>>([])
const filterSemesterId = ref<number | null>(null)

async function loadSemesters() {
  try {
    const res = await fetchAllSemesters()
    semesterOptions.value = res.data.map((s: Semester) => ({ label: s.name, value: s.id }))
  } catch {
    // 非阻塞
  }
}

/** 取一个适合图表量纲的上限（对齐常见满分 5/10/20/50/100） */
function niceChartMax(...vals: number[]): number {
  const m = Math.max(5, ...vals.filter((v) => !Number.isNaN(v)))
  if (m <= 5) return 5
  if (m <= 10) return 10
  if (m <= 20) return 20
  if (m <= 50) return 50
  if (m <= 100) return 100
  return Math.ceil(m)
}

/** 是否有指标均分数据可供绘图 */
function hasItems(dto: TeacherQualityDto | null | undefined): boolean {
  return !!dto && Object.keys(dto.itemAverages ?? {}).length > 0
}

/** 雷达图：按 itemAverages 动态生成指标（指标名为后端快照名） */
function radarOption(dto: TeacherQualityDto): EChartsOption {
  const entries = Object.entries(dto.itemAverages ?? {})
  const chartMax = niceChartMax(...entries.map(([, v]) => v), dto.avgEvaluationScore)
  return {
    tooltip: { ...tokens.value.tooltip },
    radar: {
      indicator: entries.map(([name]) => ({ name, max: chartMax })),
      axisName: { color: '#606266', fontSize: 12 },
      splitLine: { lineStyle: { color: '#ebeef5' } },
      splitArea: { areaStyle: { color: ['#fafafa', '#fff'] } },
      axisLine: { lineStyle: { color: '#dcdfe6' } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: entries.map(([, v]) => v),
            name: dto.teacherName,
            itemStyle: { color: '#2080f0' },
            areaStyle: { color: 'rgba(32,128,240,0.18)' },
            lineStyle: { width: 2 },
          },
        ],
      },
    ],
  }
}

// ---- 教师：本人质量 ----
const myLoading = ref(false)
const myQuality = ref<TeacherQualityDto | null>(null)

async function loadMyQuality() {
  myLoading.value = true
  try {
    const res = await getMyTeacherQuality(filterSemesterId.value ?? undefined)
    myQuality.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('analysis.tqLoadFail'))
    myQuality.value = null
  } finally {
    myLoading.value = false
  }
}

// ---- 管理员/院系：列表 + 对比 ----
const listLoading = ref(false)
const list = ref<TeacherQualityDto[]>([])
/** 列表本地分页（对比柱状图需全集，故分块拉全量后客户端分页） */
const listPagination = reactive({
  pageSize: 20,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
})

async function loadList() {
  listLoading.value = true
  try {
    list.value = await fetchAllPages((page, pageSize) =>
      fetchTeacherQualityList(filterSemesterId.value ?? undefined, page, pageSize),
    )
  } catch (e) {
    message.error((e as Error).message || t('analysis.tqLoadFail'))
    list.value = []
  } finally {
    listLoading.value = false
  }
}

const listColumns = computed<DataTableColumns<TeacherQualityDto>>(() => [
  { title: t('analysis.tqTeacherName'), key: 'teacherName', width: 100 },
  { title: t('analysis.tqDepartment'), key: 'department', width: 120, ellipsis: { tooltip: true } },
  {
    title: t('analysis.tqAvgEvaluationScore'),
    key: 'avgEvaluationScore',
    width: 110,
    align: 'center',
    render: (r) => {
      const score = r.avgEvaluationScore
      // 无评教数据时不渲染彩色标签背景，仅显示占位符，避免空标签突兀
      if (!score) return '-'
      return h(NTag, { type: 'success', size: 'small', bordered: false }, () => score)
    },
  },
  { title: t('analysis.tqEvalCount'), key: 'evalCount', width: 80, align: 'center' },
  { title: t('analysis.tqCourseCount'), key: 'courseCount', width: 80, align: 'center' },
  { title: t('analysis.tqCourseAvgScore'), key: 'courseAvgScore', width: 100, align: 'center' },
  {
    title: t('analysis.tqCoursePassRate'),
    key: 'coursePassRate',
    width: 90,
    align: 'center',
    render: (r) => `${r.coursePassRate}%`,
  },
  { title: t('analysis.tqStudentCount'), key: 'studentCount', width: 90, align: 'center' },
  {
    title: t('analysis.tqDetail'),
    key: 'actions',
    width: 90,
    align: 'center',
    render: (row) =>
      h(
        'a',
        { class: 'link-btn', onClick: () => openDetail(row) },
        { default: () => t('analysis.tqDetail') },
      ),
  },
])

const comparisonChartMax = computed(() =>
  niceChartMax(...list.value.map((d) => d.avgEvaluationScore)),
)

const comparisonOption = computed<EChartsOption>(() => ({
  tooltip: { ...tokens.value.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { top: 24, right: 24, bottom: 8, left: 8, ...tokens.value.grid },
  xAxis: {
    type: 'category',
    data: list.value.map((d) => d.teacherName),
    axisLabel: {
      ...tokens.value.axisTextStyle,
      rotate: list.value.length > 6 ? 30 : 0,
      interval: 0,
    },
    axisLine: tokens.value.axisLine,
  },
  yAxis: {
    type: 'value',
    name: t('analysis.tqAvgEvaluationScore'),
    min: 0,
    max: comparisonChartMax.value,
    axisLabel: tokens.value.axisTextStyle,
    splitLine: tokens.value.splitLine,
    axisLine: tokens.value.axisLine,
  },
  series: [
    {
      name: t('analysis.tqAvgEvaluationScore'),
      type: 'bar',
      barMaxWidth: 36,
      itemStyle: { color: '#2080f0', borderRadius: [4, 4, 0, 0] },
      data: list.value.map((d) => d.avgEvaluationScore),
    },
  ],
}))

// ---- 详情弹窗 ----
const showDetail = ref(false)
const detail = ref<TeacherQualityDto | null>(null)

const myRadarOption = computed<EChartsOption>(() =>
  myQuality.value ? radarOption(myQuality.value) : {},
)
const detailRadarOption = computed<EChartsOption>(() =>
  detail.value ? radarOption(detail.value) : {},
)

function openDetail(row: TeacherQualityDto) {
  detail.value = row
  showDetail.value = true
}

function handleSemesterChange(id: number | null) {
  filterSemesterId.value = id
  if (isTeacher.value) loadMyQuality()
  else loadList()
}

onMounted(() => {
  loadSemesters()
  if (isTeacher.value) loadMyQuality()
  else loadList()
})
</script>

<template>
  <div class="analysis-tq-page">
    <NSpace vertical :size="16">
      <!-- 学期筛选 -->
      <NCard>
        <NSpace align="center" :size="12">
          <span class="toolbar-label">{{ $t('analysis.tqSemester') }}</span>
          <NSelect
            :value="filterSemesterId"
            :options="semesterOptions"
            :placeholder="$t('analysis.tqSemesterAll')"
            clearable
            style="width: 220px"
            @update:value="handleSemesterChange"
          />
        </NSpace>
      </NCard>

      <!-- 教师本人 -->
      <template v-if="isTeacher">
        <NSpin :show="myLoading">
          <NEmpty v-if="!myLoading && !myQuality" :description="$t('analysis.tqEmpty')" />
          <template v-else-if="myQuality">
            <div class="stat-band">
              <StatCard
                :label="$t('analysis.tqAvgEvaluationScore')"
                :value="myQuality.avgEvaluationScore"
                tone="primary"
              />
              <StatCard
                :label="$t('analysis.tqEvalCount')"
                :value="myQuality.evalCount"
                tone="default"
              />
              <StatCard
                :label="$t('analysis.tqCourseCount')"
                :value="myQuality.courseCount"
                tone="default"
              />
              <StatCard
                :label="$t('analysis.tqCourseAvgScore')"
                :value="myQuality.courseAvgScore"
                tone="success"
              />
              <StatCard
                :label="$t('analysis.tqCoursePassRate')"
                :value="myQuality.coursePassRate"
                suffix="%"
                tone="warning"
              />
              <StatCard
                :label="$t('analysis.tqStudentCount')"
                :value="myQuality.studentCount"
                tone="default"
              />
            </div>
            <NCard>
              <div class="chart-title">{{ $t('analysis.tqDimensionAverages') }}</div>
              <NEmpty v-if="!hasItems(myQuality)" :description="$t('analysis.tqNoItems')" />
              <div v-else class="chart-box"><BaseChart :option="myRadarOption" /></div>
            </NCard>
          </template>
        </NSpin>
      </template>

      <!-- 管理员/院系列表 -->
      <template v-else>
        <NCard v-if="list.length > 0">
          <div class="chart-title">{{ $t('analysis.tqComparison') }}</div>
          <div class="chart-box"><BaseChart :option="comparisonOption" /></div>
        </NCard>
        <NCard>
          <NSpin :show="listLoading">
            <NEmpty
              v-if="!listLoading && list.length === 0"
              :description="$t('analysis.tqEmpty')"
            />
            <NDataTable
              v-else
              :columns="listColumns"
              :data="list"
              :row-key="(r: TeacherQualityDto) => r.teacherId"
              :single-line="false"
              :bordered="false"
              :scroll-x="1000"
              :pagination="listPagination"
            />
          </NSpin>
        </NCard>
      </template>
    </NSpace>

    <!-- 详情弹窗 -->
    <NModal v-model:show="showDetail" preset="card" class="tq-detail-modal">
      <template #header> {{ $t('analysis.tqDetail') }} - {{ detail?.teacherName }} </template>
      <template v-if="detail">
        <NDescriptions :column="2" label-placement="left" bordered>
          <NDescriptionsItem :label="$t('analysis.tqDepartment')">{{
            detail.department
          }}</NDescriptionsItem>
          <NDescriptionsItem :label="$t('analysis.tqAvgEvaluationScore')">
            {{ detail.avgEvaluationScore }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('analysis.tqEvalCount')">{{
            detail.evalCount
          }}</NDescriptionsItem>
          <NDescriptionsItem :label="$t('analysis.tqCourseCount')">{{
            detail.courseCount
          }}</NDescriptionsItem>
          <NDescriptionsItem :label="$t('analysis.tqCourseAvgScore')">{{
            detail.courseAvgScore
          }}</NDescriptionsItem>
          <NDescriptionsItem :label="$t('analysis.tqCoursePassRate')"
            >{{ detail.coursePassRate }}%</NDescriptionsItem
          >
          <NDescriptionsItem :label="$t('analysis.tqStudentCount')" :span="2">
            {{ detail.studentCount }}
          </NDescriptionsItem>
        </NDescriptions>
        <div class="chart-title" style="margin-top: 16px">
          {{ $t('analysis.tqDimensionAverages') }}
        </div>
        <NEmpty v-if="!hasItems(detail)" :description="$t('analysis.tqNoItems')" />
        <div v-else class="chart-box"><BaseChart :option="detailRadarOption" /></div>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./TeacherQualityPage.css"></style>

<style>
.tq-detail-modal {
  width: 560px;
  max-width: 92vw;
}
</style>
