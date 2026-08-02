<script setup lang="ts">
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

defineProps<{
  option: EChartsOption
  loading?: boolean
}>()
</script>

<template>
  <VChart class="base-chart" :option="option" :loading="loading" autoresize />
</template>

<style scoped src="./BaseChart.css"></style>
