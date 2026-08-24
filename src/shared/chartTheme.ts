import { computed } from 'vue'
import { useThemeStore } from '@/stores/useThemeStore'

export interface ChartThemeTokens {
  axisTextStyle: { color: string; fontSize: number }
  axisLine: { lineStyle: { color: string } }
  splitLine: { lineStyle: { color: string; width: number; type: 'solid' } }
  splitAreaColors: [string, string]
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
  splitAreaColors: ['#fafafa', '#fff'],
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
  splitAreaColors: ['#2c2c32', '#242428'],
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

/**
 * 饼图「从起始角依次环形加载」入场动画:
 * expansion 模式下每个扇区从自身起点角扫到终点角;按扇区实际视觉角度
 * (与 echarts pieLayout 的 minAngle 钳制/重分配算法一致)错开各扇区的
 * 延迟与时长,并使用线性缓动——揭示点以恒定角速度连续绕圈,各颜色首尾
 * 相接依次加载,不会在扇区交界处减速停顿(默认 cubicOut 会一段一顿)。
 *
 * 注意:页面中图表挂载时数据为空、数据随后到达,ECharts 此时经 updateProps
 * 走「update」动画通道做 expansion 展开,因此配置必须同时覆盖 Update 变体
 * (仅配 animationDuration/animationDelay 会被忽略,退化为所有颜色同时
 * 从各自起始位置展开)。
 *
 * @param values 各扇区数值(与 data 顺序一致)
 * @param minAngle 与 series 的 minAngle 保持一致,用于修正时长比例
 * @param totalMs 扫满一圈的总时长
 */
export function pieSweepAnimation(values: number[], minAngle = 0, totalMs = 2000) {
  const total = values.reduce((a, v) => a + v, 0)
  // 镜像 echarts pieLayout 的角度分配:小于 minAngle 的扇区被钳制到 minAngle,
  // 剩余角度在其余扇区间按数值比例分配(全部被钳制时退化为均分)
  const FULL_ANGLE = 360
  const angles = new Array<number>(values.length).fill(0)
  if (total > 0) {
    let restAngle = FULL_ANGLE
    let restValue = 0
    const clamped = values.map((v) => (v / total) * FULL_ANGLE < minAngle)
    values.forEach((v, i) => {
      if (clamped[i]) {
        angles[i] = minAngle
        restAngle -= minAngle
      } else {
        restValue += v
      }
    })
    if (restAngle <= 0) {
      angles.fill(FULL_ANGLE / values.length)
    } else {
      values.forEach((v, i) => {
        if (!clamped[i]) angles[i] = restValue > 0 ? (v / restValue) * restAngle : 0
      })
    }
  }
  const delays: number[] = []
  const durations: number[] = []
  let acc = 0
  for (const a of angles) {
    delays.push((acc / FULL_ANGLE) * totalMs)
    durations.push((a / FULL_ANGLE) * totalMs)
    acc += a
  }
  return {
    animationType: 'expansion' as const,
    animationEasing: 'linear' as const,
    animationEasingUpdate: 'linear' as const,
    animationDuration: (idx: number) => durations[idx] ?? 0,
    animationDelay: (idx: number) => delays[idx] ?? 0,
    animationDurationUpdate: (idx: number) => durations[idx] ?? 0,
    animationDelayUpdate: (idx: number) => delays[idx] ?? 0,
  }
}
