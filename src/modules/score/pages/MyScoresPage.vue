<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NSelect,
  NDataTable,
  NSpin,
  NEmpty,
  NTag,
  NButton,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NTabs,
  NTabPane,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import type { EChartsOption } from 'echarts'
import BaseChart from '@/shared/components/BaseChart.vue'
import StatCard from '@/shared/components/StatCard.vue'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import {
  chartAxisTextStyle,
  chartAxisLine,
  chartSplitLine,
  chartTooltip,
  chartGrid,
  passMarkLine,
} from '@/shared/chartTheme'
import { fetchMyScores, applyReview } from '../api'
import { fetchAllSemesters } from '@/modules/curriculum/api'
import type { Semester } from '@/modules/curriculum/types'
import type { ScoreView } from '../types'
import { levelColor, levelTagType } from '../utils'

const { t } = useI18n()
const message = useMessage()
const { isStudent } = useRoleCheck()

const loading = ref(false)
const scores = ref<ScoreView[]>([])
const semesterOptions = ref<Array<{ label: string; value: number }>>([])
const filterSemesterId = ref<number | null>(null)
const activeTab = ref<'detail' | 'analysis'>('detail')

const semesterMap = computed(() => {
  const m = new Map<number, string>()
  for (const s of semesterOptions.value) m.set(s.value, s.label)
  return m
})

function semesterLabel(id: number): string {
  return semesterMap.value.get(id) ?? `${t('score.mySemester')} ${id}`
}

async function loadSemesters() {
  try {
    const res = await fetchAllSemesters()
    semesterOptions.value = res.data.map((s: Semester) => ({ label: s.name, value: s.id }))
  } catch {
    // 非阻塞
  }
}

async function loadData() {
  loading.value = true
  try {
    // 一次拉取全部学期成绩，学期筛选在前端完成：
    // 表格/条形图/饼图取当前筛选结果，趋势图需要跨学期数据，不能随筛选缩到单个学期
    const res = await fetchMyScores()
    scores.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('score.myLoadFail'))
    scores.value = []
  } finally {
    loading.value = false
  }
}

/** 当前学期筛选下的成绩（表格、条形图、饼图使用） */
const visibleScores = computed(() => {
  if (filterSemesterId.value == null) return scores.value
  return scores.value.filter((s) => s.semesterId === filterSemesterId.value)
})

// ---- 概要统计 ----
const stats = computed(() => {
  const list = visibleScores.value
  const total = list.length
  const courseSet = new Set<number>()
  let sum = 0
  let pass = 0
  let fail = 0
  for (const s of list) {
    courseSet.add(s.courseId)
    sum += s.totalScore
    if (s.totalScore >= 60) pass++
    else fail++
  }
  return {
    courses: courseSet.size,
    avg: total > 0 ? (sum / total).toFixed(2) : '0.00',
    passRate: total > 0 ? Number(((pass / total) * 100).toFixed(1)) : 0,
    fail,
  }
})

// ---- 申请复核（行内） ----
const showApply = ref(false)
const applyTarget = ref<ScoreView | null>(null)
const applyReason = ref('')
const applySaving = ref(false)

function openApply(row: ScoreView) {
  applyTarget.value = row
  applyReason.value = ''
  showApply.value = true
}

async function handleApply() {
  if (applyTarget.value == null) return
  if (!applyReason.value.trim()) {
    message.warning(t('score.rvReasonRequired'))
    return
  }
  applySaving.value = true
  try {
    await applyReview({ scoreId: applyTarget.value.id, reason: applyReason.value.trim() })
    message.success(t('score.rvSaveSuccess'))
    showApply.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('score.rvSaveFail'))
  } finally {
    applySaving.value = false
  }
}

const columns = computed<DataTableColumns<ScoreView>>(() => {
  const cols: DataTableColumns<ScoreView> = [
    { title: t('score.mySemester'), key: 'semesterId', width: 150, render: (r) => semesterLabel(r.semesterId) },
    { title: t('score.myCourseName'), key: 'courseName', minWidth: 160, ellipsis: { tooltip: true } },
    { title: t('score.myTeacher'), key: 'teacherName', width: 100 },
    {
      title: t('score.myScoreType'),
      key: 'scoreType',
      width: 80,
      align: 'center',
      render: (r) =>
        h(NTag, { size: 'small', bordered: false, type: r.scoreType === '正常' ? 'default' : 'info' }, () => r.scoreType),
    },
    { title: t('score.myRegularScore'), key: 'regularScore', width: 80, align: 'center' },
    { title: t('score.myFinalScore'), key: 'finalScore', width: 80, align: 'center' },
    { title: t('score.myTotalScore'), key: 'totalScore', width: 80, align: 'center' },
    {
      title: t('score.myScoreLevel'),
      key: 'scoreLevel',
      width: 80,
      align: 'center',
      render: (r) => h(NTag, { type: levelTagType(r.scoreLevel), size: 'small', bordered: false }, () => r.scoreLevel),
    },
  ]
  if (isStudent.value) {
    cols.push({
      title: t('score.rvActions'),
      key: 'actions',
      width: 110,
      align: 'center',
      fixed: 'right',
      render: (row) =>
        h(NButton, { size: 'small', type: 'primary', ghost: true, onClick: () => openApply(row) }, () => t('score.rvApply')),
    })
  }
  return cols
})

// ---- 图表 ----
/** 按总评降序排列的当前筛选成绩，条形图读取 */
const barData = computed(() => [...visibleScores.value].sort((a, b) => b.totalScore - a.totalScore))

const scoreBarOption = computed<EChartsOption>(() => {
  const manyCourses = barData.value.length > 10
  const passLine = passMarkLine(t('score.myPassLine'), 'xAxis')
  return {
    tooltip: {
      ...chartTooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as Array<{ dataIndex: number }>
        const s = barData.value[list[0]?.dataIndex ?? -1]
        if (!s) return ''
        return [
          `<b>${s.courseName}</b>`,
          `${t('score.mySemester')}：${semesterLabel(s.semesterId)}`,
          `${t('score.myTeacher')}：${s.teacherName}`,
          `${t('score.myRegularScore')}：${s.regularScore}`,
          `${t('score.myFinalScore')}：${s.finalScore}`,
          `<b>${t('score.myTotalScore')}：${s.totalScore}（${s.scoreLevel}）</b>`,
        ].join('<br/>')
      },
    },
    grid: { top: 24, right: 40, bottom: manyCourses ? 44 : 24, left: 8, ...chartGrid },
    xAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { formatter: (v: number) => String(v), ...chartAxisTextStyle },
      axisLine: chartAxisLine,
      splitLine: chartSplitLine,
    },
    yAxis: {
      type: 'category',
      data: barData.value.map((s) => s.courseName),
      inverse: true,
      axisLabel: { width: 130, overflow: 'truncate', ...chartAxisTextStyle },
      axisTick: { show: false },
      axisLine: chartAxisLine,
    },
    series: [
      {
        name: t('score.myTotalScore'),
        type: 'bar',
        data: barData.value.map((s) => ({
          value: s.totalScore,
          itemStyle: { color: levelColor(s.scoreLevel), borderRadius: [0, 4, 4, 0] },
        })),
        label: { show: true, position: 'right', formatter: '{c}', color: '#606266', fontSize: 12 },
        barMaxWidth: 22,
        markLine: {
          ...passLine,
          label: { ...passLine.label, position: 'insideEndTop' },
        },
      },
    ],
    // 课程过多时支持滚动查看
    ...(manyCourses
      ? {
          dataZoom: [
            { type: 'inside' as const, yAxisIndex: 0 },
            { type: 'slider' as const, yAxisIndex: 0, height: 14, bottom: 4, borderColor: 'transparent' },
          ],
        }
      : {}),
  }
})

const levelPieOption = computed<EChartsOption>(() => {
  const counts: Record<string, number> = { 优: 0, 良: 0, 中: 0, 及格: 0, 不及格: 0 }
  for (const s of visibleScores.value) counts[s.scoreLevel] = (counts[s.scoreLevel] ?? 0) + 1
  const items: Array<[string, string]> = [
    [t('score.levelExcellent'), '优'],
    [t('score.levelGood'), '良'],
    [t('score.levelMedium'), '中'],
    [t('score.levelPass'), '及格'],
    [t('score.levelFail'), '不及格'],
  ]
  const pieData = items
    .map(([label, key]) => ({
      name: label,
      value: counts[key] ?? 0,
      itemStyle: { color: levelColor(key) },
    }))
    .filter((d) => d.value > 0)
  return {
    tooltip: {
      ...chartTooltip,
      trigger: 'item',
      formatter: '{b}：{c}（{d}%）',
    },
    legend: { bottom: 0, type: 'scroll', textStyle: chartAxisTextStyle },
    series: [
      {
        type: 'pie',
        radius: ['38%', '64%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        minAngle: 5,
        data: pieData,
        // 外侧标签 + 引导线：小扇区也能完整显示名称与占比
        label: { position: 'outside', formatter: '{b} {d}%', color: '#606266', fontSize: 12 },
        labelLine: { length: 12, length2: 8, lineStyle: { color: '#c0c4cc' } },
      },
    ],
  }
})

const trendOption = computed<EChartsOption>(() => {
  const bySem = new Map<number, number[]>()
  for (const s of scores.value) {
    const arr = bySem.get(s.semesterId)
    if (arr) arr.push(s.totalScore)
    else bySem.set(s.semesterId, [s.totalScore])
  }
  const labels: string[] = []
  const avgs: number[] = []
  for (const opt of semesterOptions.value) {
    const arr = bySem.get(opt.value)
    if (arr && arr.length) {
      labels.push(opt.label)
      avgs.push(Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)))
    }
  }
  const lastIndex = avgs.length - 1
  return {
    tooltip: {
      ...chartTooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#c0c4cc', width: 1 } },
    },
    grid: { left: 8, right: 24, top: 24, bottom: 8, ...chartGrid },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { rotate: 30, interval: 0, hideOverlap: false, ...chartAxisTextStyle },
      axisLine: chartAxisLine,
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: t('score.myAvgScore'),
      nameTextStyle: chartAxisTextStyle,
      // 成绩普遍偏高时自动抬高下限，避免折线被压平；至少保留及格线(60)可视
      min: (v: { min: number }) => Math.min(55, Math.max(0, Math.floor((v.min - 5) / 10) * 10)),
      max: 100,
      axisLabel: chartAxisTextStyle,
      axisLine: chartAxisLine,
      splitLine: chartSplitLine,
    },
    series: [
      {
        type: 'line',
        data: avgs,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 2, color: '#2080f0' },
        itemStyle: { color: '#2080f0', borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          // 10% 透明度面积填充，突出走势
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(32, 128, 240, 0.15)' },
              { offset: 1, color: 'rgba(32, 128, 240, 0)' },
            ],
          },
        },
        markLine: passMarkLine(t('score.myPassLine')),
        // 只标注最后一个点，避免每点标注造成杂乱
        label: {
          show: true,
          position: 'top',
          color: '#606266',
          fontSize: 12,
          formatter: (p: { dataIndex: number }) => (p.dataIndex === lastIndex ? String(avgs[p.dataIndex]) : ''),
        },
      },
    ],
  }
})

const hasData = computed(() => scores.value.length > 0)

onMounted(() => {
  loadSemesters()
  loadData()
})
</script>

<template>
  <div class="my-scores-page">
    <NSpace vertical :size="16">
      <!-- 概要统计 -->
      <div class="stat-band">
        <StatCard :label="$t('score.myStatCourses')" :value="stats.courses" tone="primary" />
        <StatCard :label="$t('score.myStatAvg')" :value="stats.avg" tone="default" />
        <StatCard
          :label="$t('score.myStatPassRate')"
          :value="stats.passRate"
          suffix="%"
          tone="success"
        />
        <StatCard :label="$t('score.myStatFail')" :value="stats.fail" :tone="stats.fail > 0 ? 'error' : 'default'" />
      </div>

      <!-- 工具栏：学期为前端即时筛选 -->
      <NCard>
        <NSpace align="center" :size="12" wrap>
          <NSelect
            v-model:value="filterSemesterId"
            :options="semesterOptions"
            :placeholder="$t('score.myAllSemester')"
            clearable
            style="width: 240px"
          />
        </NSpace>
      </NCard>

      <!-- 明细 / 分析 -->
      <NCard>
        <NTabs v-model:value="activeTab" type="line" animated>
          <NTabPane name="detail" :tab="$t('score.myTabDetail')">
            <NSpin :show="loading">
              <NEmpty v-if="!loading && !hasData" :description="$t('score.myEmpty')" />
              <NEmpty
                v-else-if="!loading && visibleScores.length === 0"
                :description="$t('score.myNoMatch')"
              />
              <NDataTable
                v-else
                :columns="columns"
                :data="visibleScores"
                :row-key="(r: ScoreView) => r.id"
                :single-line="false"
                :bordered="false"
                :scroll-x="1000"
              />
            </NSpin>
          </NTabPane>

          <NTabPane name="analysis" :tab="$t('score.myTabAnalysis')">
            <NSpin :show="loading">
              <NEmpty v-if="!loading && !hasData" :description="$t('score.myEmpty')" />
              <template v-else>
                <div class="chart-full">
                  <div class="chart-title">{{ $t('score.myScoreBar') }}</div>
                  <NEmpty
                    v-if="!loading && visibleScores.length === 0"
                    size="small"
                    :description="$t('score.myNoMatch')"
                  />
                  <div v-else class="chart-box chart-box-tall"><BaseChart :option="scoreBarOption" /></div>
                </div>
                <div class="chart-row">
                  <div class="chart-card">
                    <div class="chart-title">{{ $t('score.myLevelPie') }}</div>
                    <NEmpty
                      v-if="!loading && visibleScores.length === 0"
                      size="small"
                      :description="$t('score.myNoMatch')"
                    />
                    <div v-else class="chart-box chart-box-tall"><BaseChart :option="levelPieOption" /></div>
                  </div>
                  <div class="chart-card">
                    <div class="chart-title-row">
                      <span class="chart-title">{{ $t('score.myTrend') }}</span>
                      <span class="chart-note">{{ $t('score.myTrendHint') }}</span>
                    </div>
                    <div class="chart-box chart-box-tall"><BaseChart :option="trendOption" /></div>
                  </div>
                </div>
              </template>
            </NSpin>
          </NTabPane>
        </NTabs>
      </NCard>
    </NSpace>

    <!-- 行内申请复核 -->
    <NModal
      v-model:show="showApply"
      preset="card"
      :title="$t('score.rvApplyTitle')"
      class="my-apply-modal"
    >
      <NForm v-if="applyTarget">
        <NFormItem :label="$t('score.myCourseName')">
          <span>{{ applyTarget.courseName }}（{{ $t('score.myTotalScore') }}{{ applyTarget.totalScore }}）</span>
        </NFormItem>
        <NFormItem :label="$t('score.rvReason')" required>
          <NInput
            v-model:value="applyReason"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            :placeholder="$t('score.rvReasonPlaceholder')"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showApply = false">{{ $t('score.rvCancel') }}</NButton>
          <NButton type="primary" :loading="applySaving" @click="handleApply">
            {{ $t('score.rvSubmit') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./MyScoresPage.css"></style>

<style>
.my-apply-modal {
  width: 460px;
  max-width: 90vw;
}
</style>
