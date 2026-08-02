/**
 * 图表通用基底样式：浅色主题下统一轴文字、细网格线与 tooltip 外观，
 * 供各模块 ECharts option 复用，保证全站图表观感一致。
 */
export const chartAxisTextStyle = {
  color: '#606266',
  fontSize: 12,
}

/** 坐标轴线：细、浅色 */
export const chartAxisLine = {
  lineStyle: { color: '#dcdfe6' },
}

/** 网格线：1px 实线浅灰（非虚线），弱化背景 */
export const chartSplitLine = {
  lineStyle: { color: '#ebeef5', width: 1, type: 'solid' as const },
}

/** tooltip 通用外观 */
export const chartTooltip = {
  backgroundColor: 'rgba(255, 255, 255, 0.96)',
  borderColor: '#e4e7ed',
  borderWidth: 1,
  textStyle: { color: '#303133', fontSize: 12 },
  confine: true,
}

/** 及格线（60 分）markLine 通用配置：细虚线红色参考线，axis 指定所依附的坐标轴 */
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

/** 基础坐标轴结构，避免每个图表重复书写 */
export const chartGrid = {
  containLabel: true,
}
