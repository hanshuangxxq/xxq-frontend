import type { GlobalThemeOverrides } from 'naive-ui'

/**
 * 全站设计令牌:B 风紧凑骨架(小圆角/细边框/弱阴影) + A 风按钮(6px 圆角/主色实心)。
 * 浅色/深色两套 override 共享骨架令牌,仅色彩随主题变化。
 * Menu 的选中/悬停色引用 global.css 的 CSS 变量,明暗切换自动跟随。
 */
const commonBase = {
  primaryColor: '#2563eb',
  primaryColorHover: '#4472ee',
  primaryColorPressed: '#1d4fd7',
  primaryColorSuppl: '#2563eb',
  borderRadius: '4px',
  borderRadiusSmall: '3px',
}

const buttonBase = {
  borderRadiusTiny: '5px',
  borderRadiusSmall: '6px',
  borderRadiusMedium: '6px',
  borderRadiusLarge: '6px',
}

/** 紧凑行高:上下 6-7px 内边距,small 按钮(20-24px)置入后上下各留 ~6px 不贴线 */
const dataTableBase = {
  thFontWeight: '600',
  thPaddingMedium: '7px 12px',
  tdPaddingMedium: '6px 12px',
}

const cardBase = {
  borderRadius: '6px',
  paddingMedium: '12px 16px',
}

const menuBase = {
  borderRadius: '8px',
  itemHeight: '36px',
  itemColorHover: 'var(--app-hover-bg)',
  itemColorActive: 'var(--app-active-bg)',
  itemColorActiveHover: 'var(--app-active-bg)',
  itemTextColorActive: 'var(--app-primary)',
  itemIconColorActive: 'var(--app-primary)',
}

export const lightThemeOverrides: GlobalThemeOverrides = {
  common: { ...commonBase },
  Button: { ...buttonBase },
  DataTable: {
    ...dataTableBase,
    thColor: '#fafafa',
    tdColor: '#ffffff',
    borderColor: '#ececf0',
  },
  Card: { ...cardBase, borderColor: '#ececf0' },
  Menu: { ...menuBase },
}

export const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    ...commonBase,
    primaryColor: '#3b82f6',
    primaryColorHover: '#60a5fa',
    primaryColorPressed: '#2563eb',
    primaryColorSuppl: '#3b82f6',
  },
  Button: { ...buttonBase },
  DataTable: {
    ...dataTableBase,
    thColor: '#232328',
    tdColor: '#18181c',
    borderColor: '#2c2c32',
  },
  Card: { ...cardBase, borderColor: '#2c2c32' },
  Menu: { ...menuBase },
}
