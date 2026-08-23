<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NSelect,
  NInput,
  NButton,
  NDataTable,
  NSpin,
  NEmpty,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import type { EChartsOption } from 'echarts'
import BaseChart from '@/shared/components/BaseChart.vue'
import StatCard from '@/shared/components/StatCard.vue'
import { fetchScoreStatistics } from '../api'
import { fetchCourses } from '@/modules/course/api'
import { fetchAllSemesters } from '@/modules/curriculum/api'
import { courseKey, parseCourseKey, isPublicCourse } from '@/modules/course/utils'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import type { Course } from '@/modules/course/types'
import type { Semester } from '@/modules/curriculum/types'
import type { ScoreStatisticsDto } from '../types'
import { levelColor } from '../utils'
import { useChartTheme } from '@/shared/chartTheme'

const { t } = useI18n()
const message = useMessage()
const { tokens } = useChartTheme()

const loading = ref(false)
const data = ref<ScoreStatisticsDto[]>([])

const semesterOptions = ref<Array<{ label: string; value: number }>>([])

const filterCourseKey = ref<string | null>(null)
const filterClassName = ref('')
const filterSemesterId = ref<number | null>(null)

async function loadDropdowns() {
  try {
    const semRes = await fetchAllSemesters()
    semesterOptions.value = semRes.data.map((s: Semester) => ({ label: s.name, value: s.id }))
  } catch {
    // 下拉数据加载失败不阻塞
  }
}

async function loadData() {
  loading.value = true
  try {
    const sel = filterCourseKey.value ? parseCourseKey(filterCourseKey.value) : null
    const res = await fetchScoreStatistics({
      courseId: sel?.id,
      source: sel?.source === 'SELECTION_CAMPAIGN' ? 'SELECTION_CAMPAIGN' : undefined,
      className: filterClassName.value || undefined,
      semesterId: filterSemesterId.value ?? undefined,
    })
    data.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('score.statLoadFail'))
    data.value = []
  } finally {
    loading.value = false
  }
}

function handleReset() {
  filterCourseKey.value = null
  filterClassName.value = ''
  filterSemesterId.value = null
  loadData()
}

const columns = computed<DataTableColumns<ScoreStatisticsDto>>(() => [
  { title: t('score.statCourse'), key: 'courseName', width: 160, ellipsis: { tooltip: true } },
  { title: t('score.statTotalCount'), key: 'totalCount', width: 80, align: 'center' },
  { title: t('score.statExcellent'), key: 'excellentCount', width: 70, align: 'center' },
  { title: t('score.statGood'), key: 'goodCount', width: 70, align: 'center' },
  { title: t('score.statMedium'), key: 'mediumCount', width: 70, align: 'center' },
  { title: t('score.statPass'), key: 'passCount', width: 70, align: 'center' },
  { title: t('score.statFail'), key: 'failCount', width: 70, align: 'center' },
  { title: t('score.statAvg'), key: 'avgScore', width: 80, align: 'center' },
  { title: t('score.statMax'), key: 'maxScore', width: 80, align: 'center' },
  { title: t('score.statMin'), key: 'minScore', width: 80, align: 'center' },
  { title: t('score.statPassRate'), key: 'passRate', width: 90, align: 'center' },
])

// ---- 概要统计 ----
type CountField = 'excellentCount' | 'goodCount' | 'mediumCount' | 'passCount' | 'failCount'
function sumCount(field: CountField): number {
  return data.value.reduce((a, d) => a + d[field], 0)
}

const stats = computed(() => {
  const courses = data.value.length
  const students = data.value.reduce((a, d) => a + d.totalCount, 0)
  const fail = sumCount('failCount')
  const passRate = students > 0 ? Number((((students - fail) / students) * 100).toFixed(1)) : 0
  const totalAvgScore = data.value.reduce((a, d) => a + d.avgScore * d.totalCount, 0)
  const avg = students > 0 ? (totalAvgScore / students).toFixed(2) : '0.00'
  return { courses, students, avg, passRate }
})

// ---- 图表 ----
const levelStackOption = computed<EChartsOption>(() => {
  const levels: Array<{ key: CountField; label: string; lv: string }> = [
    { key: 'excellentCount', label: t('score.statExcellent'), lv: '优' },
    { key: 'goodCount', label: t('score.statGood'), lv: '良' },
    { key: 'mediumCount', label: t('score.statMedium'), lv: '中' },
    { key: 'passCount', label: t('score.statPass'), lv: '及格' },
    { key: 'failCount', label: t('score.statFail'), lv: '不及格' },
  ]
  // 过滤掉所有课程中总数均为 0 的等级，避免空系列在图表中阻挡
  const visibleLevels = levels.filter((lv) => sumCount(lv.key) > 0)
  return {
    tooltip: { ...tokens.value.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, textStyle: tokens.value.axisTextStyle },
    grid: { left: 8, right: 24, top: 40, bottom: 8, ...tokens.value.grid },
    xAxis: {
      type: 'category',
      data: data.value.map((d) => d.courseName),
      axisLabel: { ...tokens.value.axisTextStyle, rotate: 30, interval: 0, hideOverlap: false },
      axisLine: tokens.value.axisLine,
    },
    yAxis: {
      type: 'value',
      name: t('score.statTotalCount'),
      axisLabel: tokens.value.axisTextStyle,
      splitLine: tokens.value.splitLine,
      axisLine: tokens.value.axisLine,
    },
    series: visibleLevels.map((lv) => ({
      name: lv.label,
      type: 'bar',
      stack: 'total',
      itemStyle: { color: levelColor(lv.lv) },
      barMaxWidth: 40,
      data: data.value.map((d) => d[lv.key]),
    })),
  }
})

const levelPieOption = computed<EChartsOption>(() => {
  const items: Array<{ key: CountField; label: string; lv: string }> = [
    { key: 'excellentCount', label: t('score.statExcellent'), lv: '优' },
    { key: 'goodCount', label: t('score.statGood'), lv: '良' },
    { key: 'mediumCount', label: t('score.statMedium'), lv: '中' },
    { key: 'passCount', label: t('score.statPass'), lv: '及格' },
    { key: 'failCount', label: t('score.statFail'), lv: '不及格' },
  ]
  const pieData = items
    .map((it) => ({
      name: it.label,
      value: sumCount(it.key),
      itemStyle: { color: levelColor(it.lv) },
    }))
    .filter((d) => d.value > 0)
  return {
    tooltip: { ...tokens.value.tooltip, trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 8, type: 'scroll', textStyle: tokens.value.axisTextStyle },
    series: [
      {
        type: 'pie',
        radius: ['38%', '64%'],
        center: ['50%', '46%'],
        minAngle: 5,
        avoidLabelOverlap: true,
        data: pieData,
        label: { position: 'inside', formatter: '{d}%', color: '#fff', fontSize: 11 },
      },
    ],
  }
})

const avgPassOption = computed<EChartsOption>(() => ({
  tooltip: { ...tokens.value.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: { top: 0, textStyle: tokens.value.axisTextStyle },
  grid: { left: 8, right: 8, top: 40, bottom: 8, ...tokens.value.grid },
  xAxis: {
    type: 'category',
    data: data.value.map((d) => d.courseName),
    axisLabel: { ...tokens.value.axisTextStyle, rotate: 30, interval: 0, hideOverlap: false },
    axisLine: tokens.value.axisLine,
  },
  yAxis: [
    {
      type: 'value',
      name: t('score.statAvg'),
      min: 0,
      max: 100,
      axisLabel: tokens.value.axisTextStyle,
      splitLine: tokens.value.splitLine,
      axisLine: tokens.value.axisLine,
    },
    {
      type: 'value',
      name: t('score.statPassRate'),
      min: 0,
      max: 100,
      axisLabel: tokens.value.axisTextStyle,
      splitLine: tokens.value.splitLine,
      axisLine: tokens.value.axisLine,
    },
  ],
  series: [
    {
      name: t('score.statAvg'),
      type: 'bar',
      barMaxWidth: 40,
      itemStyle: { color: '#2080f0' },
      data: data.value.map((d) => d.avgScore),
    },
    {
      name: t('score.statPassRate'),
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      itemStyle: { color: '#18a058' },
      lineStyle: { width: 3 },
      data: data.value.map((d) => d.passRate),
    },
  ],
}))

const hasData = computed(() => data.value.length > 0)

onMounted(() => {
  loadDropdowns()
  loadData()
})
</script>

<template>
  <div class="score-stat-page">
    <NSpace vertical :size="16">
      <!-- 概要统计 -->
      <div class="stat-band">
        <StatCard :label="$t('score.statStatCourses')" :value="stats.courses" tone="primary" />
        <StatCard :label="$t('score.statStatStudents')" :value="stats.students" tone="default" />
        <StatCard :label="$t('score.statStatAvg')" :value="stats.avg" tone="success" />
        <StatCard
          :label="$t('score.statStatPassRate')"
          :value="stats.passRate"
          suffix="%"
          tone="warning"
        />
      </div>

      <!-- 筛选 -->
      <NCard>
        <NSpace align="center" :size="12" wrap>
          <PagedSelect
            :model-value="filterCourseKey"
            :fetch-page="(page: number, pageSize: number) => fetchCourses(page, pageSize)"
            :label-of="
              (c: Course) =>
                isPublicCourse(c) ? `${c.courseName}（${t('common.publicTag')}）` : c.courseName
            "
            :value-of="(c: Course) => courseKey(c.id, c.source)"
            :placeholder="$t('score.statAllCourse')"
            clearable
            style="width: 220px"
            @update:model-value="
              (v: string | number | null | Array<string | number>) =>
                (filterCourseKey = (v as string) ?? null)
            "
          />
          <NInput
            v-model:value="filterClassName"
            :placeholder="$t('score.statClassNamePlaceholder')"
            clearable
            style="width: 180px"
          />
          <NSelect
            v-model:value="filterSemesterId"
            :options="semesterOptions"
            :placeholder="$t('score.statAllSemester')"
            clearable
            style="width: 200px"
          />
          <NButton type="primary" @click="loadData">{{ $t('score.statQuery') }}</NButton>
          <NButton @click="handleReset">{{ $t('score.statReset') }}</NButton>
        </NSpace>
      </NCard>

      <!-- 图表 + 明细 -->
      <NCard>
        <NSpin :show="loading">
          <NEmpty v-if="!loading && !hasData" :description="$t('score.statEmpty')" />
          <template v-else>
            <div class="chart-full">
              <div class="chart-title">{{ $t('score.statLevelDist') }}</div>
              <div class="chart-box chart-box-tall"><BaseChart :option="levelStackOption" /></div>
            </div>
            <div class="chart-row">
              <div class="chart-card">
                <div class="chart-title">{{ $t('score.statLevelPie') }}</div>
                <div class="chart-box chart-box-tall"><BaseChart :option="levelPieOption" /></div>
              </div>
              <div class="chart-card">
                <div class="chart-title">{{ $t('score.statAvgPass') }}</div>
                <div class="chart-box chart-box-tall"><BaseChart :option="avgPassOption" /></div>
              </div>
            </div>

            <div class="table-title">{{ $t('score.statTitle') }}</div>
            <NDataTable
              :columns="columns"
              :data="data"
              :row-key="(r: ScoreStatisticsDto) => `${r.courseId}:${r.courseName}`"
              :single-line="false"
              :bordered="false"
              :scroll-x="1100"
            />
          </template>
        </NSpin>
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped src="./ScoreStatisticsPage.css"></style>
