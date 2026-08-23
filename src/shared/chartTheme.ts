import { computed } from 'vue'
import { useThemeStore } from '@/stores/useThemeStore'

export interface ChartThemeTokens {
  axisTextStyle: { color: string; fontSize: number }
  axisLine: { lineStyle: { color: string } }
  splitLine: { lineStyle: { color: string; width: number; type: 'solid' } }
  tooltip: {
    backgroundColor: string
    borderColor: string
    borderWidth: number
    textStyle: { color: string; fontSize: number }
    confine: boolean
  }
  grid: { containLabel: boolean }
}

const lightTokens: ChartThemeTokens = {
  axisTextStyle: { color: '#606266', fontSize: 12 },
  axisLine: { lineStyle: { color: '#dcdfe6' } },
  splitLine: { lineStyle: { color: '#ebeef5', width: 1, type: 'solid' } },
  tooltip: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderColor: '#e4e7ed',
    borderWidth: 1,
    textStyle: { color: '#303133', fontSize: 12 },
    confine: true,
  },
  grid: { containLabel: true },
}

const darkTokens: ChartThemeTokens = {
  axisTextStyle: { color: '#9ca3af', fontSize: 12 },
  axisLine: { lineStyle: { color: '#3a3a42' } },
  splitLine: { lineStyle: { color: '#2c2c32', width: 1, type: 'solid' } },
  tooltip: {
    backgroundColor: 'rgba(24, 24, 28, 0.96)',
    borderColor: '#3a3a42',
    borderWidth: 1,
    textStyle: { color: '#e5e7eb', fontSize: 12 },
    confine: true,
  },
  grid: { containLabel: true },
}

/**
 * 图表主题令牌,随明暗主题响应式切换。
 * 消费处要求:传给 BaseChart 的 option 必须由 computed 产出(computed 内读取 tokens.value.*),
 * 这样主题切换时 option 自动重建、ECharts 自动重渲染。
 */
export function useChartTheme() {
  const themeStore = useThemeStore()
  const tokens = computed<ChartThemeTokens>(() => (themeStore.isDark ? darkTokens : lightTokens))
  return { tokens }
}

/** 及格线(60 分)markLine 通用配置:细虚线红色参考线,axis 指定所依附的坐标轴 */
export function passMarkLine(label: string, axis: 'xAxis' | 'yAxis' = 'yAxis') {
  return {
    symbol: 'none' as const,
    lineStyle: { color: '#d03050', width: 1, type: 'dashed' as const },
    label: {
      formatter: label,
      color: '#d03050',
      fontSize: 11,
    },
    data: [{ [axis]: 60 }],
  }
}
