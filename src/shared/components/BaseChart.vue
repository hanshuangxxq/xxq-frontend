<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart, RadarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
  ToolboxComponent,
} from 'echarts/components'
import type { EChartsOption } from 'echarts'

// 按需注册 echarts 模块，供所有图表复用
use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
  ToolboxComponent,
])

const props = defineProps<{
  option: EChartsOption
  loading?: boolean
}>()

// 统一放慢所有图表动画（echarts 默认入场 1000ms、数据更新 300ms）；
// 页面 option 中若自带动画配置可覆盖这里的默认值
const mergedOption = computed<EChartsOption>(() => ({
  animationDuration: 2000,
  animationDurationUpdate: 1200,
  ...props.option,
}))
</script>

<template>
  <VChart class="base-chart" :option="mergedOption" :loading="loading" autoresize />
</template>

<style scoped src="./BaseChart.css"></style>
