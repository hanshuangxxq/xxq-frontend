# 全局显示优化实施计划（地基 + 外壳 + 批次 1：auth）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立全站主题系统（明/暗双主题 + 设计令牌）与共享显示设施，改造布局外壳（面包屑/过渡/角色默认页/外观设置），并完成第一个模块（auth）的扫除样板。

**Architecture:** 三层推进——A 地基（`src/theme/` 令牌 + CSS 变量 + `useThemeStore` + 共享格式化/状态标签/操作按钮/错误收口/图表主题）；B 外壳（路由重定向与 meta、MainLayout 改造）；C 批次 1（auth 模块应用全部设施，作为后续五个批次的参照样板）。模块扫除批次 2–6（score/exam → curriculum/course/selection → practice/graduation → analysis → 管理类 CRUD）各自另行成计划，复用本计划固化的模式。

**Tech Stack:** Vue 3.5 `<script setup lang="ts">`、Naive UI（按需导入 + `NConfigProvider` 主题覆盖 + `darkTheme`）、Pinia setup-store、vue-i18n、vue-echarts。

**Spec:** `docs/superpowers/specs/2026-08-23-display-optimization-design.md`

---

## 执行约定（每个任务都必须遵守）

- **项目无测试框架，不要引入。** 验证手段 = `pnpm type-check`（vue-tsc）+ 阶段末 `pnpm build`。
- **lint/format 只对本次改动文件运行**，严禁全仓 `--fix`：
  - `pnpm exec prettier --write <改动的文件...>`
  - `pnpm exec eslint --fix <改动的文件...>`
- **文件工具一律使用完整绝对 Windows 路径（盘符 + 反斜杠）**，如 `D:\java项目\xxq-frontend\src\...`。
- **界面文案一律走 i18n**，不得在模板/脚本中硬编码展示字符串。
- 每个任务完成后立即按给出的提交信息 commit。
- TypeScript 严格模式 + `noUncheckedIndexedAccess`：索引访问结果视为可能 `undefined`。

---

## Phase A · 地基

### Task 1: 主题令牌与全局 CSS 变量

**Files:**
- Create: `src/theme/index.ts`
- Create: `src/theme/global.css`
- Modify: `src/main.ts`

- [ ] **Step 1: 创建 `src/theme/index.ts`**

```typescript
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
```

- [ ] **Step 2: 创建 `src/theme/global.css`**

```css
/* 全站语义化 CSS 变量:自定义样式(各组件 .css)只引用变量,不写死颜色 */
:root {
  --app-bg: #f5f6f8;
  --app-card-bg: #ffffff;
  --app-card-shadow: 0 2px 12px rgba(15, 35, 80, 0.06);
  --app-sidebar-bg: #fafafa;
  --app-sidebar-bottom-bg: #f0f1f3;
  --app-sidebar-bottom-hover: #e8eaed;
  --app-border: #ececf0;
  --app-border-strong: #dcdfe5;
  --app-text: #1f2329;
  --app-text-secondary: #6b7280;
  --app-hover-bg: #f4f6fa;
  --app-active-bg: #eef4ff;
  --app-primary: #2563eb;
  --app-dropdown-bg: #ffffff;
  --app-dropdown-hover: #f4f6fa;
}

/* useThemeStore 在 <html> 上同步 dark class */
html.dark {
  color-scheme: dark;
  --app-bg: #101014;
  --app-card-bg: #18181c;
  --app-card-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  --app-sidebar-bg: #18181c;
  --app-sidebar-bottom-bg: #1f1f24;
  --app-sidebar-bottom-hover: #26262c;
  --app-border: #2c2c32;
  --app-border-strong: #3a3a42;
  --app-text: #e5e7eb;
  --app-text-secondary: #9ca3af;
  --app-hover-bg: #232329;
  --app-active-bg: #22304d;
  --app-primary: #3b82f6;
  --app-dropdown-bg: #232328;
  --app-dropdown-hover: #2c2c33;
}

/* 避免暗色模式下页面边缘/加载前白闪 */
html {
  background: var(--app-bg);
}
```

- [ ] **Step 3: 修改 `src/main.ts`** — 在 `import App from './App.vue'` 之后加一行：

```typescript
import './theme/global.css'
```

- [ ] **Step 4: 验证**

Run: `pnpm type-check`
Expected: 通过（0 errors）

- [ ] **Step 5: Commit**

```bash
git add src/theme/index.ts src/theme/global.css src/main.ts
git commit -m "feat(theme): 新增主题令牌与全局 CSS 变量（明/暗双套）"
```

### Task 2: useThemeStore + App.vue 接线

**Files:**
- Create: `src/stores/useThemeStore.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: 创建 `src/stores/useThemeStore.ts`**（模式参照 `useLocaleStore`）

```typescript
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'xxq-theme'
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

function loadFromStorage(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(loadFromStorage())
  const systemDark = ref(mediaQuery.matches)

  mediaQuery.addEventListener('change', (e) => {
    systemDark.value = e.matches
  })

  /** 实际生效的暗色状态:system 模式跟随操作系统 */
  const isDark = computed(() =>
    mode.value === 'system' ? systemDark.value : mode.value === 'dark',
  )

  function setMode(next: ThemeMode) {
    mode.value = next
    localStorage.setItem(STORAGE_KEY, next)
  }

  // 同步 <html> 的 dark class,驱动 global.css 的 CSS 变量切换
  watch(
    isDark,
    (dark) => {
      document.documentElement.classList.toggle('dark', dark)
    },
    { immediate: true },
  )

  return { mode, isDark, setMode }
})
```

- [ ] **Step 2: 整体替换 `src/App.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { NConfigProvider, NMessageProvider, darkTheme } from 'naive-ui'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { darkThemeOverrides, lightThemeOverrides } from '@/theme'

const localeStore = useLocaleStore()
const themeStore = useThemeStore()
const naiveCfg = computed(() => localeStore.naiveConfig())
const naiveTheme = computed(() => (themeStore.isDark ? darkTheme : null))
const themeOverrides = computed(() =>
  themeStore.isDark ? darkThemeOverrides : lightThemeOverrides,
)
</script>

<template>
  <NConfigProvider
    :locale="naiveCfg.locale"
    :date-locale="naiveCfg.dateLocale"
    :theme="naiveTheme"
    :theme-overrides="themeOverrides"
  >
    <NMessageProvider>
      <RouterView />
    </NMessageProvider>
  </NConfigProvider>
</template>
```

- [ ] **Step 3: 验证**

Run: `pnpm type-check`
Expected: 通过

- [ ] **Step 4: Commit**

```bash
git add src/stores/useThemeStore.ts src/App.vue
git commit -m "feat(theme): 新增 useThemeStore，App 接入明暗主题切换"
```

### Task 3: 错误提示收口（discrete message 主题化 + api 层统一弹出）

**Files:**
- Create: `src/shared/discrete.ts`
- Modify: `src/shared/api.ts`（整体重写）
- Modify: `src/locales/zh-CN/common.json`
- Modify: `src/locales/en/common.json`

背景：现状 api.ts 用 `createDiscreteApi(['message'])` 弹出业务错误——既不跟随主题/语言，又与页面 catch 里的 `message.error` 形成双重 toast。本任务让业务/网络/HTTP 错误全部在 api 层弹一次，抛出的错误携带 `reported` 标记；页面 catch 只做本地状态恢复。`silent` 选项供个别页面自定义错误展示。

- [ ] **Step 1: 创建 `src/shared/discrete.ts`**

```typescript
import { computed } from 'vue'
import { createDiscreteApi, darkTheme } from 'naive-ui'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { darkThemeOverrides, lightThemeOverrides } from '@/theme'

/**
 * 脱离组件树的 message 实例(供 api 层等非组件场景使用)。
 * 通过响应式 configProviderProps 让 toast 跟随主题与语言切换。
 * 注意:组件内请继续使用 useMessage()(由 App.vue 的 NMessageProvider 提供)。
 */
export const { message } = createDiscreteApi(['message'], {
  configProviderProps: computed(() => {
    const themeStore = useThemeStore()
    const localeStore = useLocaleStore()
    const naiveCfg = localeStore.naiveConfig()
    return {
      theme: themeStore.isDark ? darkTheme : null,
      themeOverrides: themeStore.isDark ? darkThemeOverrides : lightThemeOverrides,
      locale: naiveCfg.locale,
      dateLocale: naiveCfg.dateLocale,
    }
  }),
})
```

- [ ] **Step 2: 整体重写 `src/shared/api.ts`**

```typescript
import { API_BASE_URL } from '@/config'
import { accessToken, refreshAccessToken } from '@/shared/tokenManager'
import { message } from '@/shared/discrete'
import i18n from '@/i18n'

const AUTH_WHITELIST = ['/login', '/login/refresh']

/** 网络层错误(后端不可达、DNS 失败、CORS、超时等),区别于认证失败与业务错误 */
export class ApiNetworkError extends Error {
  readonly isNetworkError = true
  /** 错误消息已在 api 层统一弹出,页面 catch 到后不应再次提示 */
  readonly reported = true
  constructor(message: string) {
    super(message)
    this.name = 'ApiNetworkError'
  }
}

/** HTTP 状态码错误(4xx/5xx),携带状态码供调用方区分认证失败与服务器暂时错误 */
export class HttpError extends Error {
  readonly status: number
  readonly reported = true
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

/** 业务错误(后端返回 code !== 200),消息已在 api 层弹出 */
export class BusinessError extends Error {
  readonly reported = true
  constructor(message: string) {
    super(message)
    this.name = 'BusinessError'
  }
}

export interface RequestOptions {
  /** 为 true 时错误消息不在 api 层弹出,由调用方自行处理 */
  silent?: boolean
}

async function request<T>(url: string, options?: RequestInit & RequestOptions): Promise<T> {
  const { silent, ...init } = options ?? {}
  const headers: Record<string, string> = {}

  const isFormData = init.body instanceof FormData
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  if (accessToken.value && !AUTH_WHITELIST.includes(url.split('?')[0]!)) {
    headers['Authorization'] = `Bearer ${accessToken.value}`
  }

  const mergedOptions: RequestInit = {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  }

  const doFetch = (opts: RequestInit): Promise<Response> =>
    fetch(`${API_BASE_URL}${url}`, opts).catch((e) => {
      if (!silent) message.error(i18n.global.t('common.error.network'))
      throw new ApiNetworkError(e instanceof Error ? e.message : String(e))
    })

  let res = await doFetch(mergedOptions)

  if (res.status === 401 && !url.startsWith('/login/refresh')) {
    const outcome = await refreshAccessToken()
    if (outcome === 'success') {
      headers['Authorization'] = `Bearer ${accessToken.value}`
      res = await doFetch({
        ...mergedOptions,
        headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
      })
    } else if (outcome === 'network_error') {
      // 后端暂时不可达(如重启中):保留登录态,不跳转登录页
      if (!silent) message.error(i18n.global.t('common.error.network'))
      throw new ApiNetworkError('刷新登录状态失败,请检查网络连接')
    } else {
      window.location.replace('/login')
      throw new Error('Session expired')
    }
  }

  if (!res.ok) {
    if (!silent) message.error(i18n.global.t('common.error.server', { status: res.status }))
    const body = await res.text()
    throw new HttpError(res.status, `HTTP ${res.status}: ${body}`)
  }

  const body = (await res.json()) as { code: number; message: string; data: unknown }
  if (body.code !== 200) {
    const text = body.message || i18n.global.t('common.error.requestFailed')
    if (!silent) message.error(text)
    throw new BusinessError(text)
  }
  return body as T
}

export const api = {
  get<T>(url: string, options?: RequestOptions): Promise<T> {
    return request<T>(url, options)
  },

  post<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(url, {
      ...options,
      method: 'POST',
      ...(data !== undefined && { body: JSON.stringify(data) }),
    })
  },

  postForm<T>(url: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return request<T>(url, { ...options, method: 'POST', body: formData })
  },

  put<T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(url, {
      ...options,
      method: 'PUT',
      ...(data !== undefined && { body: JSON.stringify(data) }),
    })
  },

  delete<T>(url: string, options?: RequestOptions): Promise<T> {
    return request<T>(url, { ...options, method: 'DELETE' })
  },
}
```

- [ ] **Step 3: `src/locales/zh-CN/common.json` 增加 `error` 命名空间** — 在 `"publicTag": "公选"` 后追加（注意前一行补逗号）：

```json
  "publicTag": "公选",
  "error": {
    "network": "网络异常，请检查网络连接",
    "requestFailed": "请求失败",
    "server": "服务器错误（HTTP {status}）"
  }
```

- [ ] **Step 4: `src/locales/en/common.json` 同样位置追加：**

```json
  "publicTag": "Public",
  "error": {
    "network": "Network error, please check your connection",
    "requestFailed": "Request failed",
    "server": "Server error (HTTP {status})"
  }
```

- [ ] **Step 5: 验证**

Run: `pnpm type-check`
Expected: 通过（269 个 api 调用点签名保持兼容——`options` 均为可选新增参数）

- [ ] **Step 6: Commit**

```bash
git add src/shared/discrete.ts src/shared/api.ts src/locales/zh-CN/common.json src/locales/en/common.json
git commit -m "refactor(api): 错误提示收口到 api 层，discrete message 跟随主题/语言"
```

### Task 4: 共享格式化工具 `format.ts`

**Files:**
- Create: `src/shared/utils/format.ts`

- [ ] **Step 1: 创建文件**

```typescript
/**
 * 全站统一展示格式化。空值(null/undefined/空串)一律返回 '-'。
 * 后端时间字符串兼容两种形态:'YYYY-MM-DDTHH:mm:ss'(ISO) 与 'YYYY-MM-DD HH:mm:ss'。
 */

/** 'YYYY-MM-DD HH:mm' */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ')
}

/** 'YYYY-MM-DD' */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  return value.slice(0, 10)
}

/** 数字原样展示,空值 '-' */
export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : String(value)
}

/** 分数展示,语义同 formatNumber(独立导出便于后续统一调整精度) */
export function formatScore(value: number | null | undefined): string {
  return formatNumber(value)
}
```

- [ ] **Step 2: 验证**

Run: `pnpm type-check`
Expected: 通过（消费方在 Task 12 及后续扫除批次接入）

- [ ] **Step 3: Commit**

```bash
git add src/shared/utils/format.ts
git commit -m "feat(shared): 新增统一日期/数字格式化工具"
```

### Task 5: StatusTag 共享组件

**Files:**
- Modify: `src/shared/types.ts`（末尾追加）
- Create: `src/shared/components/StatusTag.vue`

- [ ] **Step 1: `src/shared/types.ts` 末尾追加**

```typescript

/** StatusTag 组件的单状态定义:type 对应 NTag 类型,labelKey 为 i18n 键 */
export interface StatusTagDef {
  type: 'default' | 'info' | 'success' | 'warning' | 'error'
  labelKey: string
}
```

- [ ] **Step 2: 创建 `src/shared/components/StatusTag.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NTag } from 'naive-ui'
import type { StatusTagDef } from '@/shared/types'

/**
 * 统一状态标签:各模块在自己的 status.ts 中定义一份
 * Record<状态值, StatusTagDef>(状态值为后端枚举),页面不再各自维护颜色映射。
 * 未命中映射时降级为原文本展示。
 */
const props = defineProps<{
  value: string | null | undefined
  map: Record<string, StatusTagDef>
  size?: 'tiny' | 'small' | 'medium' | 'large'
}>()

const { t } = useI18n()

const def = computed(() => (props.value ? props.map[props.value] : undefined))
</script>

<template>
  <NTag v-if="def" :type="def.type" :size="size ?? 'small'" :bordered="false">
    {{ t(def.labelKey) }}
  </NTag>
  <span v-else>{{ value ?? '-' }}</span>
</template>
```

（该组件无需自定义样式，不加 style 块与 CSS 文件。）

- [ ] **Step 3: 验证**

Run: `pnpm type-check`
Expected: 通过

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/shared/components/StatusTag.vue
git commit -m "feat(shared): 新增 StatusTag 统一状态标签组件"
```

### Task 6: 表格操作列助手 `renderActions`

**Files:**
- Create: `src/shared/utils/tableActions.ts`

- [ ] **Step 1: 创建文件**

```typescript
import { h } from 'vue'
import { NButton, NPopconfirm, NSpace } from 'naive-ui'

export interface TableAction {
  label: string
  onClick: () => void
  /** true 时渲染为描边红色按钮(删除等危险操作);缺省为主色实心按钮 */
  danger?: boolean
  /** 提供时包一层 NPopconfirm 二次确认,值为确认文案 */
  confirm?: string
}

function renderButton(action: TableAction, withHandler: boolean) {
  return h(
    NButton,
    {
      size: 'small' as const,
      type: action.danger ? ('error' as const) : ('primary' as const),
      secondary: action.danger === true,
      ...(withHandler ? { onClick: action.onClick } : {}),
    },
    () => action.label,
  )
}

/**
 * 表格操作列统一渲染:实心主按钮 + 描边危险按钮,按钮间距 6px。
 * small 按钮配合 DataTable 紧凑行(tdPadding 6px),上下各留 ~6px 不贴表格线。
 * 用法(列定义 render 中):render: (row) => renderActions([{ label: t('x.edit'), onClick: () => startEdit(row) }, { label: t('x.delete'), danger: true, confirm: t('x.deleteConfirm'), onClick: () => handleDelete(row.id) }])
 */
export function renderActions(actions: TableAction[]) {
  return h(NSpace, { size: 6, align: 'center' }, () =>
    actions.map((action) =>
      action.confirm
        ? h(
            NPopconfirm,
            { onPositiveClick: action.onClick },
            { default: () => action.confirm, trigger: () => renderButton(action, false) },
          )
        : renderButton(action, true),
    ),
  )
}
```

- [ ] **Step 2: 验证**

Run: `pnpm type-check`
Expected: 通过

- [ ] **Step 3: Commit**

```bash
git add src/shared/utils/tableActions.ts
git commit -m "feat(shared): 新增表格操作列统一渲染助手 renderActions"
```

### Task 7: 图表主题 `useChartTheme` + 消费页适配

**Files:**
- Modify: `src/shared/chartTheme.ts`（整体重写）
- Modify: `src/modules/score/pages/MyScoresPage.vue`
- Modify: `src/modules/score/pages/ScoreStatisticsPage.vue`
- Modify: `src/modules/analysis/pages/TeacherQualityPage.vue`

- [ ] **Step 1: 整体重写 `src/shared/chartTheme.ts`**

```typescript
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
```

- [ ] **Step 2: 改造三个消费页面**（`MyScoresPage.vue`、`ScoreStatisticsPage.vue`、`TeacherQualityPage.vue`，逐个执行）

旧导入（各页面导入子集不同，按实际删除）：

```typescript
import {
  chartAxisTextStyle,
  chartAxisLine,
  chartSplitLine,
  chartTooltip,
  chartGrid,
  passMarkLine,
} from '@/shared/chartTheme'
```

替换为：

```typescript
import { useChartTheme, passMarkLine } from '@/shared/chartTheme'
```

并在 setup 顶层加：

```typescript
const { tokens } = useChartTheme()
```

符号映射（全部使用点替换）：`chartAxisTextStyle` → `tokens.value.axisTextStyle`、`chartAxisLine` → `tokens.value.axisLine`、`chartSplitLine` → `tokens.value.splitLine`、`chartTooltip` → `tokens.value.tooltip`、`chartGrid` → `tokens.value.grid`。`passMarkLine` 不变。

**硬性要求**：每个传给 `<BaseChart :option>` 的 option 必须由 `computed(() => ({ ... }))` 产出（computed 内读取 `tokens.value.*`）。若某页面现状是普通函数 + 手动调用构建 option，改为 computed 并让模板/调用处使用 `.value` 语义（模板中直接用计算属性名）。

- [ ] **Step 3: 验证**

Run: `pnpm type-check`
Expected: 通过（被删除的具名导出若有遗漏引用会直接报错）
Run: `pnpm exec eslint --fix src/shared/chartTheme.ts src/modules/score/pages/MyScoresPage.vue src/modules/score/pages/ScoreStatisticsPage.vue src/modules/analysis/pages/TeacherQualityPage.vue && pnpm exec prettier --write src/shared/chartTheme.ts src/modules/score/pages/MyScoresPage.vue src/modules/score/pages/ScoreStatisticsPage.vue src/modules/analysis/pages/TeacherQualityPage.vue`
Expected: 无 error

- [ ] **Step 4: Commit**

```bash
git add src/shared/chartTheme.ts src/modules/score/pages/MyScoresPage.vue src/modules/score/pages/ScoreStatisticsPage.vue src/modules/analysis/pages/TeacherQualityPage.vue
git commit -m "refactor(chart): chartTheme 改为 useChartTheme，图表令牌随明暗主题响应"
```

### Phase A 收尾验证

- [ ] Run: `pnpm build`（含 type-check）
Expected: 构建成功
- [ ] 人工检查点：启动 `pnpm dev`，设置弹窗暂不可见主题项（Task 10 才有），但页面主色/按钮圆角/表格紧凑度应已变化；DevTools 给 `<html>` 手动加 `dark` class，Naive 组件应不变（主题切换接线在 App，dark class 只驱动 CSS 变量——手动加 class 仅影响已迁移到变量的样式，本阶段仅有 html 背景变深，属预期）。

---

## Phase B · 外壳

### Task 8: 路由——角色默认页重定向 + 全量 `meta.titleKey` + 删除 HomePage

**Files:**
- Modify: `src/router/index.ts`
- Delete: `src/modules/layout/HomePage.vue`、`src/modules/layout/HomePage.css`
- Modify: `src/locales/zh-CN/selection.json`、`src/locales/en/selection.json`

- [ ] **Step 1: `src/router/index.ts` 顶部（`WHITELIST` 之后）加角色默认页映射**

```typescript
/** 各角色登录后的默认首页(访问 / 时重定向);未匹配到角色时回退 /profile */
const ROLE_HOME: Record<string, string> = {
  student: '/curriculum',
  teacher: '/curriculum',
  department: '/teach-drafts',
  academic_admin: '/time-restrictions',
}
```

- [ ] **Step 2: Home 子路由替换为角色重定向**

旧：

```typescript
      {
        path: '',
        name: 'Home',
        component: () => import('@/modules/layout/HomePage.vue'),
      },
```

新：

```typescript
      {
        path: '',
        redirect: () => {
          const authStore = useAuthStore()
          return ROLE_HOME[authStore.user?.userType ?? ''] ?? '/profile'
        },
      },
```

- [ ] **Step 3: 守卫中已登录访问 /login 的跳转目标改为 `/`（由角色重定向决定去向）**

旧：

```typescript
  if (authStore.isLoggedIn && WHITELIST.includes(to.path) && !authStore.isLoggingOut) {
    return '/profile'
  }
```

新：

```typescript
  if (authStore.isLoggedIn && WHITELIST.includes(to.path) && !authStore.isLoggingOut) {
    return '/'
  }
```

- [ ] **Step 4: 为全部子路由补 `meta: { titleKey: '<i18n 键>' }`**

键与侧边栏菜单保持一致（面包屑用）。对照表（路由 path → titleKey）：

| path | titleKey |
|---|---|
| `profile` | `profile.title` |
| `course` | `course.title` |
| `selection` | `selection.title` |
| `selection/:id` | `selection.detailTitle` |
| `curriculum` | `curriculum.title` |
| `time-restrictions` | `time-restrictions.title` |
| `scheduling` | `scheduling.title` |
| `course-management` | `course-management.title` |
| `class-names` | `class-names.title` |
| `locals` | `locals.title` |
| `teach-drafts` | `teach-drafts.title` |
| `batch-import` | `batch-import.title` |
| `student-management` | `student-management.title` |
| `majors` | `majors.title` |
| `semester` | `layout.semester` |
| `grades` | `grades.title` |
| `scores` | `score.mgTitle` |
| `score-statistics` | `score.statTitle` |
| `my-scores` | `score.myTitle` |
| `score-review` | `score.rvTitle` |
| `exams` | `exam.mgTitle` |
| `makeup-exams` | `exam.mkTitle` |
| `my-exams` | `exam.myTitle` |
| `analysis/warnings` | `analysis.warnings` |
| `analysis/evaluations` | `analysis.evaluations` |
| `analysis/teacher-quality` | `analysis.teacherQuality` |
| `practice/internship` | `practice.internship.mgTitle` |
| `practice/internship/my` | `practice.internship.myTitle` |
| `practice/competition` | `practice.competition.mgTitle` |
| `practice/competition/my` | `practice.competition.myTitle` |
| `practice/social-practice` | `practice.socialPractice.mgTitle` |
| `practice/social-practice/my` | `practice.socialPractice.myTitle` |
| `colleges` | `college.title` |
| `practice/graduation/student/campaigns` | `graduation.student.campaignsTitle` |
| `practice/graduation/student/proposals` | `graduation.student.myProposalsTitle` |
| `practice/graduation/student/opening` | `graduation.student.openingTitle` |
| `practice/graduation/student/midterm` | `graduation.student.midtermTitle` |
| `practice/graduation/student/thesis` | `graduation.student.thesisTitle` |
| `practice/graduation/student/defense` | `graduation.student.defenseTitle` |
| `practice/graduation/student/score` | `graduation.student.myScoreTitle` |
| `practice/graduation/teacher/pool` | `graduation.teacher.poolTitle` |
| `practice/graduation/teacher/students` | `graduation.teacher.myStudentsTitle` |
| `practice/graduation/teacher/opening-review` | `graduation.teacher.openingReviewTitle` |
| `practice/graduation/teacher/midterm-review` | `graduation.teacher.midtermReviewTitle` |
| `practice/graduation/teacher/guidance` | `graduation.teacher.guidanceTitle` |
| `practice/graduation/teacher/thesis-review` | `graduation.teacher.thesisReviewTitle` |
| `practice/graduation/teacher/scores` | `graduation.teacher.scoreEntryTitle` |
| `practice/graduation/dept/proposal-review` | `graduation.dept.proposalReviewTitle` |
| `practice/graduation/dept/allocate` | `graduation.dept.allocateTitle` |
| `practice/graduation/dept/dashboard` | `graduation.dept.dashboardTitle` |
| `practice/graduation/dept/defense` | `graduation.dept.defenseArrangeTitle` |
| `practice/graduation/dept/scores` | `graduation.dept.scoresPublishTitle` |
| `practice/graduation/admin/campaigns` | `graduation.academic.campaignMgmtTitle` |
| `practice/graduation/admin/review` | `graduation.academic.reviewTitle` |
| `practice/graduation/admin/overview` | `graduation.academic.overviewTitle` |
| `practice/graduation/admin/dashboard` | `graduation.academic.globalDashboardTitle` |
| `practice/graduation/admin/logs` | `graduation.academic.operationLogTitle` |
| `practice/graduation/admin/theses` | `graduation.academic.thesisMgmtTitle` |
| `practice/graduation/admin/scores` | `graduation.academic.scoreTableTitle` |

示例（`profile` 路由）：

```typescript
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/modules/auth/pages/ProfilePage.vue'),
        meta: { titleKey: 'profile.title' },
      },
```

- [ ] **Step 5: `src/locales/zh-CN/selection.json` 与 `src/locales/en/selection.json` 补详情页标题键**

zh-CN 顶层加（注意 JSON 逗号）：`"detailTitle": "活动详情"`；en 加 `"detailTitle": "Campaign Detail"`。

- [ ] **Step 6: 删除 HomePage**

```bash
rm "D:/java项目/xxq-frontend/src/modules/layout/HomePage.vue" "D:/java项目/xxq-frontend/src/modules/layout/HomePage.css"
grep -rn "HomePage" "D:/java项目/xxq-frontend/src" || echo "无残留引用"
```

Expected: 输出「无残留引用」

- [ ] **Step 7: 验证**

Run: `pnpm type-check`
Expected: 通过

- [ ] **Step 8: Commit**

```bash
git add src/router/index.ts src/modules/layout/HomePage.vue src/modules/layout/HomePage.css src/locales/zh-CN/selection.json src/locales/en/selection.json
git commit -m "feat(router): / 按角色重定向默认页，全量路由补 meta.titleKey，移除 HomePage"
```

### Task 9: MainLayout——面包屑 + 页面过渡

**Files:**
- Modify: `src/modules/layout/MainLayout.vue`
- Modify: `src/modules/layout/MainLayout.css`（本任务只追加，其余样式改造在 Task 10）

- [ ] **Step 1: `MainLayout.vue` naive-ui 导入追加 `NBreadcrumb, NBreadcrumbItem`**（放在 `NBadge,` 之后）

```typescript
  NBadge,
  NBreadcrumb,
  NBreadcrumbItem,
  useMessage,
```

- [ ] **Step 2: 在 `const message = useMessage()` 之后加面包屑 computed**

```typescript
/** 面包屑:取 matched 路由链上声明了 meta.titleKey 的记录 */
const breadcrumbs = computed(() =>
  route.matched
    .filter((r) => typeof r.meta.titleKey === 'string')
    .map((r) => ({ key: r.path, label: t(r.meta.titleKey as string) })),
)
```

- [ ] **Step 3: 模板中内容区改为面包屑 + 过渡**

旧：

```vue
    <NLayoutContent class="main-content" :class="{ 'sidebar-collapsed': collapsed }">
      <RouterView />
    </NLayoutContent>
```

新：

```vue
    <NLayoutContent class="main-content" :class="{ 'sidebar-collapsed': collapsed }">
      <div v-if="breadcrumbs.length" class="content-header">
        <NBreadcrumb>
          <NBreadcrumbItem v-for="item in breadcrumbs" :key="item.key">
            {{ item.label }}
          </NBreadcrumbItem>
        </NBreadcrumb>
      </div>
      <RouterView v-slot="{ Component }">
        <Transition name="fade-slide" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </NLayoutContent>
```

- [ ] **Step 4: `MainLayout.css` 末尾追加**

```css
/* 面包屑页眉:吸顶,充当页面标题栏 */
.content-header {
  padding: 12px 20px;
  background: var(--app-card-bg);
  border-bottom: 1px solid var(--app-border);
  position: sticky;
  top: 0;
  z-index: 5;
}

/* 页面过渡:150ms 淡入微位移 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
```

- [ ] **Step 5: 验证 + Commit**

Run: `pnpm type-check`
Expected: 通过

```bash
git add src/modules/layout/MainLayout.vue src/modules/layout/MainLayout.css
git commit -m "feat(layout): 内容区新增面包屑页眉与页面过渡动画"
```

### Task 10: 设置弹窗「外观」项 + 侧边栏/共享组件样式迁移到令牌变量

**Files:**
- Modify: `src/modules/layout/MainLayout.vue`
- Modify: `src/modules/layout/MainLayout.css`（整体重写）
- Modify: `src/locales/zh-CN/layout.json`、`src/locales/en/layout.json`
- Modify: `src/shared/components/StatCard.css`、`src/shared/components/PagedSelect.css`
- Modify: `src/modules/notification/NotificationPanel.css`

- [ ] **Step 1: `MainLayout.vue` 导入与状态**

naive-ui 导入追加 `NRadioGroup, NRadioButton`（放在 `NBreadcrumbItem,` 之后）：

```typescript
  NBreadcrumbItem,
  NRadioGroup,
  NRadioButton,
  useMessage,
```

store 导入区追加：

```typescript
import { useThemeStore, type ThemeMode } from '@/stores/useThemeStore'
```

`settingsTab` 类型加 `'appearance'`：

```typescript
const settingsTab = ref<'password' | 'language' | 'appearance'>('language')
```

在 `currentLocale` computed 之后加：

```typescript
const themeStore = useThemeStore()
const themeMode = computed<ThemeMode>({
  get: () => themeStore.mode,
  set: (v) => themeStore.setMode(v),
})
```

- [ ] **Step 2: 设置弹窗加「外观」导航项与内容**

导航区（密码项之后）追加：

```vue
          <div
            class="settings-nav-item"
            :class="{ active: settingsTab === 'appearance' }"
            @click="settingsTab = 'appearance'"
          >
            {{ t('layout.appearance') }}
          </div>
```

内容区：把语言模板的 `v-else` 改为 `v-else-if="settingsTab === 'language'"`，并在其后追加外观模板：

```vue
          <template v-else>
            <h4 class="settings-section-title">{{ t('layout.appearance') }}</h4>
            <NRadioGroup v-model:value="themeMode">
              <NRadioButton value="light">{{ t('layout.themeLight') }}</NRadioButton>
              <NRadioButton value="dark">{{ t('layout.themeDark') }}</NRadioButton>
              <NRadioButton value="system">{{ t('layout.themeSystem') }}</NRadioButton>
            </NRadioGroup>
          </template>
```

- [ ] **Step 3: `layout.json` 两种语言追加键**

zh-CN（`"logoutConfirmMessage"` 后，注意逗号）：

```json
  "logoutConfirmMessage": "确定要退出登录吗？",
  "appearance": "外观",
  "themeLight": "浅色",
  "themeDark": "深色",
  "themeSystem": "跟随系统"
```

en：

```json
  "logoutConfirmMessage": "Are you sure you want to logout?",
  "appearance": "Appearance",
  "themeLight": "Light",
  "themeDark": "Dark",
  "themeSystem": "System"
```

- [ ] **Step 4: 整体重写 `src/modules/layout/MainLayout.css`**

```css
.sidebar-container {
  background: var(--app-sidebar-bg);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-top {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 16px;
  min-height: 48px;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.project-name {
  position: absolute;
  left: 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
  opacity: 1;
  transition: opacity 0.2s ease;
}

.sidebar-top.collapsed .project-name {
  opacity: 0;
  pointer-events: none;
}

.sidebar-menu {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
}

/* 菜单选中项左侧主色指示条(B 风) */
.sidebar-menu :deep(.n-menu-item-content--selected) {
  box-shadow: inset 2px 0 0 var(--app-primary);
}

.toggle-icon {
  width: 18px;
  height: 18px;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.15s;
}

.toggle-icon:hover {
  opacity: 0.8;
}

.sidebar-bottom {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  margin-top: auto;
  background: var(--app-sidebar-bottom-bg);
  border-top: 1px solid var(--app-border);
  flex-shrink: 0;
  min-height: 48px;
  max-width: 100%;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: background 0.15s;
}

.sidebar-bottom:hover {
  background: var(--app-sidebar-bottom-hover);
}

.sidebar-bottom :deep(.n-avatar) {
  flex-shrink: 0;
}

.dropdown-hitbox {
  position: absolute;
  inset: 0;
  cursor: pointer;
  z-index: 1;
}

.username {
  position: absolute;
  left: 52px;
  font-size: 13px;
  font-weight: 500;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 108px;
  opacity: 1;
  transition: opacity 0.2s ease;
}

.sidebar-bottom.collapsed .username {
  opacity: 0;
  pointer-events: none;
}

.dropdown-arrow {
  position: absolute;
  right: 12px;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.sidebar-bottom:hover .dropdown-arrow {
  opacity: 0.8;
}

.sidebar-bottom.collapsed .dropdown-arrow {
  opacity: 0;
  pointer-events: none;
}

/* 暗色下反转深色 SVG 图标亮度(侧边栏图标均为 <img> 引入的深色 SVG) */
html.dark .sidebar-menu :deep(img),
html.dark .toggle-icon,
html.dark .dropdown-arrow,
html.dark .settings-close-btn {
  filter: invert(0.8);
}

.settings-layout {
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 280px;
  min-width: 0;
  overflow: hidden;
}

.settings-close-btn {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 18px;
  height: 18px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;
  z-index: 1;
}

.settings-close-btn:hover {
  opacity: 0.8;
}

.settings-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.settings-nav {
  width: 140px;
  min-width: 140px;
  background: var(--app-sidebar-bg);
  padding: 0;
  flex-shrink: 0;
  overflow: hidden;
}

.settings-nav-title {
  padding: 12px 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text);
  border-bottom: 1px solid var(--app-border);
}

.settings-nav-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  color: var(--app-text-secondary);
  transition:
    background 0.15s,
    color 0.15s;
}

.settings-nav-item:hover {
  background: var(--app-hover-bg);
  color: var(--app-text);
}

.settings-nav-item.active {
  background: var(--app-active-bg);
  color: var(--app-primary);
  font-weight: 500;
}

.settings-content {
  flex: 1;
  min-width: 0;
  padding: 20px 20px;
}

.settings-section-title {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 500;
  color: var(--app-text);
}

.main-layout {
  min-height: 100vh;
}

.main-sider {
  position: fixed !important;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 10;
  height: 100vh;
}

.main-content {
  margin-left: 220px;
  background: var(--app-bg);
  min-height: 100vh;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.main-content.sidebar-collapsed {
  margin-left: 64px;
}

/* 面包屑页眉:吸顶,充当页面标题栏 */
.content-header {
  padding: 12px 20px;
  background: var(--app-card-bg);
  border-bottom: 1px solid var(--app-border);
  position: sticky;
  top: 0;
  z-index: 5;
}

/* 页面过渡:150ms 淡入微位移 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.settings-modal {
  width: 440px;
  max-width: 90vw;
}
.settings-modal .n-card {
  width: 440px;
  max-width: 90vw;
}
.settings-modal .n-card-header {
  display: none;
}

.locale-select {
  max-width: 240px;
}

/* Global overrides for teleported modal elements */
:global(.settings-modal) {
  width: 440px !important;
  max-width: 90vw !important;
}
:global(.settings-modal .n-card) {
  width: 440px !important;
  max-width: 90vw !important;
}
:global(.settings-modal .n-card-header) {
  display: none !important;
}

:global(.logout-confirm-modal) {
  width: 360px !important;
  max-width: 90vw !important;
}

/* Sidebar dropdown menu — global because NDropdown teleports to body */
:global(.n-dropdown-menu) {
  background: var(--app-dropdown-bg);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 4px 0;
}

:global(.n-dropdown-option) {
  color: var(--app-text);
  font-size: 13px;
  padding: 0;
  transition: background 0.12s;
}

:global(.n-dropdown-option:hover) {
  background: var(--app-dropdown-hover);
  color: var(--app-text);
}

:global(.n-dropdown-divider) {
  margin: 4px 12px;
  border-color: var(--app-border);
}

.logout-confirm-modal {
  width: 360px;
  max-width: 90vw;
}

.logout-confirm-message {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--app-text-secondary);
}

.logout-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
```

注意：原有的 `.main-content :deep(> div) { background: #fff }` 规则**删除**（改由 `.main-content` 自身铺 `--app-bg`，页面卡片用 `--app-card-bg`）。

- [ ] **Step 5: 整体重写 `src/shared/components/StatCard.css`**

```css
.stat-card {
  padding: 16px 20px;
  background: var(--app-card-bg);
  border: 1px solid var(--app-border);
  border-radius: 6px;
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.stat-card:hover {
  border-color: var(--app-border-strong);
  box-shadow: var(--app-card-shadow);
}

/* NStatistic label/value 颜色由 tone 控制 */
.stat-card :deep(.n-statistic__label) {
  font-size: 13px;
  color: var(--app-text-secondary);
  margin-bottom: 4px;
}

.stat-card :deep(.n-statistic-value) {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
}

.stat-card-suffix {
  font-size: 14px;
  font-weight: 500;
  margin-left: 2px;
}

.stat-card--default :deep(.n-statistic-value) {
  color: var(--app-text);
}

.stat-card--primary :deep(.n-statistic-value) {
  color: var(--app-primary);
}

/* 语义色(成功/警告/错误)在明暗两主题下均可读,保持固定值 */
.stat-card--success :deep(.n-statistic-value) {
  color: #18a058;
}

.stat-card--warning :deep(.n-statistic-value) {
  color: #f0a020;
}

.stat-card--error :deep(.n-statistic-value) {
  color: #d03050;
}
```

- [ ] **Step 6: `src/shared/components/PagedSelect.css` 中 `.paged-select-info` 的 `color: #909399` 改为**

```css
  color: var(--app-text-secondary);
```

- [ ] **Step 7: `src/modules/notification/NotificationPanel.css` 迁移**

读文件后将硬编码颜色替换为变量：正文色 → `var(--app-text)`；次要/时间/分页信息色 → `var(--app-text-secondary)`；背景 → `var(--app-card-bg)`；边框/分割线 → `var(--app-border)`；悬停底 → `var(--app-hover-bg)`；主色（未读标记、链接色）→ `var(--app-primary)`。结构与尺寸保持不变。

- [ ] **Step 8: 验证**

Run: `pnpm type-check`
Expected: 通过
Run: `pnpm exec eslint --fix src/modules/layout/MainLayout.vue src/shared/components/StatCard.css src/shared/components/PagedSelect.css src/modules/notification/NotificationPanel.css && pnpm exec prettier --write src/modules/layout/MainLayout.vue src/modules/layout/MainLayout.css src/shared/components/StatCard.css src/shared/components/PagedSelect.css src/modules/notification/NotificationPanel.css src/locales/zh-CN/layout.json src/locales/en/layout.json`
Expected: 无 error

- [ ] **Step 9: Commit**

```bash
git add src/modules/layout/MainLayout.vue src/modules/layout/MainLayout.css src/locales/zh-CN/layout.json src/locales/en/layout.json src/shared/components/StatCard.css src/shared/components/PagedSelect.css src/modules/notification/NotificationPanel.css
git commit -m "feat(layout): 设置弹窗新增外观切换，外壳与共享组件样式迁移到主题变量"
```

### Phase B 收尾验证

- [ ] Run: `pnpm build`
Expected: 构建成功
- [ ] 人工检查点：`pnpm dev` 登录后——① `/` 按角色跳转默认页；② 顶部出现面包屑，切页有过渡动画；③ 设置弹窗切「深色」后侧边栏/表格/卡片/toast 整体变暗，切回浅色恢复；④ 菜单选中项有左侧主色条 + 浅蓝底。

---

## Phase C · 批次 1：auth 模块（扫除样板）

后续所有模块扫除均按本批模式：① CSS 迁移变量 + 清内联 style；② 接共享 format/StatusTag/EmptyState/renderActions；③ catch 去重 toast；④ 补加载态；⑤ 硬编码中文迁 i18n；⑥ 页面内与面包屑重复的 h2 标题移除。

### Task 11: LoginPage 改造

**Files:**
- Modify: `src/modules/auth/pages/LoginPage.vue`
- Modify: `src/modules/auth/pages/LoginPage.css`

- [ ] **Step 1: `LoginPage.vue` 两处脚本修改**

登录成功后跳转改为 `/`（由角色重定向决定去向）：

```typescript
    router.push('/')
```

catch 去重 toast：

旧：

```typescript
  } catch (e) {
    message.error((e as Error).message || t('auth.login.fail'))
  } finally {
```

新：

```typescript
  } catch {
    // 错误消息已由 api 层统一提示
  } finally {
```

- [ ] **Step 2: 整体重写 `LoginPage.css`**

```css
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--app-bg);
}

.login-card {
  width: 400px;
  box-shadow: var(--app-card-shadow);
}
```

- [ ] **Step 3: 验证 + Commit**

Run: `pnpm type-check && pnpm exec eslint --fix src/modules/auth/pages/LoginPage.vue && pnpm exec prettier --write src/modules/auth/pages/LoginPage.vue src/modules/auth/pages/LoginPage.css`
Expected: 通过

```bash
git add src/modules/auth/pages/LoginPage.vue src/modules/auth/pages/LoginPage.css
git commit -m "refactor(auth): 登录页接入主题变量与角色默认跳转，去除重复错误提示"
```

### Task 12: ProfilePage 改造

**Files:**
- Modify: `src/modules/auth/pages/ProfilePage.vue`
- Modify: `src/modules/auth/pages/ProfilePage.css`

- [ ] **Step 1: 脚本修改**

import 区追加：

```typescript
import { formatDateTime } from '@/shared/utils/format'
```

`genderOptions` 之后加性别展示映射（后端存储中文枚举值，展示按语言）：

```typescript
/** 性别展示:后端存储中文枚举值,展示时按当前语言映射 */
const genderLabel = computed(() => {
  const gender = profile.value?.gender
  if (gender === '男') return t('profile.genderMale')
  if (gender === '女') return t('profile.genderFemale')
  return t('profile.notSet')
})
```

三处 catch 去重 toast（`loadProfile`、`saveProfile`、`handleAvatarUpload`，改法相同）：

旧：

```typescript
  } catch (e) {
    message.error((e as Error).message || t('profile.loadFail'))
  }
```

新：

```typescript
  } catch {
    // 错误消息已由 api 层统一提示
  }
```

（`saveProfile` / `handleAvatarUpload` 对应为 `t('profile.saveFail')` 的两处，同样替换。）

- [ ] **Step 2: 模板修改四处**

页头去掉与面包屑重复的 h2，编辑按钮右对齐：

旧：

```vue
    <NSpace justify="space-between" align="center" class="profile-header">
      <h2 class="profile-title">{{ $t('profile.title') }}</h2>
      <NButton v-if="!editing" type="primary" @click="startEdit">
        {{ $t('profile.editProfile') }}
      </NButton>
    </NSpace>
```

新：

```vue
    <NSpace justify="end" class="profile-header">
      <NButton v-if="!editing" type="primary" @click="startEdit">
        {{ $t('profile.editProfile') }}
      </NButton>
    </NSpace>
```

性别展示：

旧：`<span v-else>{{ displayValue(profile.gender) }}</span>`
新：`<span v-else>{{ genderLabel }}</span>`

两个时间字段：

旧：`<span>{{ displayValue(profile.lastLoginTime) }}</span>`
新：`<span>{{ formatDateTime(profile.lastLoginTime) }}</span>`

旧：`<span>{{ displayValue(profile.createTime) }}</span>`
新：`<span>{{ formatDateTime(profile.createTime) }}</span>`

- [ ] **Step 3: 整体重写 `ProfilePage.css`**（badge 主色走变量；删除已无引用的 `.profile-title`）

```css
.profile-page {
  max-width: 720px;
  margin: 24px auto;
  padding: 0 16px;
}

.profile-header {
  margin-bottom: 16px;
}

.profile-avatar-section {
  text-align: center;
  margin-bottom: 24px;
}

.profile-avatar-wrapper {
  cursor: pointer;
  display: inline-block;
  position: relative;
}

.avatar-uploading {
  opacity: 0.5;
}

.profile-avatar-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  background: var(--app-primary);
  color: #fff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
}

.hidden-input {
  display: none;
}

.profile-actions {
  margin-top: 16px;
}
```

- [ ] **Step 4: 验证 + Commit**

Run: `pnpm type-check && pnpm exec eslint --fix src/modules/auth/pages/ProfilePage.vue && pnpm exec prettier --write src/modules/auth/pages/ProfilePage.vue src/modules/auth/pages/ProfilePage.css`
Expected: 通过

```bash
git add src/modules/auth/pages/ProfilePage.vue src/modules/auth/pages/ProfilePage.css
git commit -m "refactor(auth): 个人中心接入共享格式化与主题变量，性别展示 i18n 化"
```

### Phase C 收尾验证

- [ ] Run: `pnpm build`
Expected: 构建成功
- [ ] 人工检查点：登录页（明/暗）、个人中心（明/暗）各过一遍；登录失败只弹一次错误提示。

---

## 后续批次（各自另行成计划）

| 批次 | 模块 | 要点 |
|---|---|---|
| 2 | score + exam | 接入 renderActions/StatusTag/format；MyScores 等已在本计划完成图表主题化；补 PagedSelect 一致性 |
| 3 | curriculum + course + selection | 周几等硬编码迁 i18n；selection 的 CampaignStatus 映射收敛为模块单一 status.ts |
| 4 | practice + practice/graduation | 最大模块；两个 Dashboard 页补加载态；毕设状态映射收敛 |
| 5 | analysis | 图表已在 Task 7 主题化；预警等级等状态收敛 |
| 6 | college/majors/grades/class-names/locals/student-management/batch-import/time-restrictions/scheduling | 管理类 CRUD 批量模式化扫除；LocalManagementPage 等为 renderActions 典型改造对象 |

每批次任务卡统一按 Phase C 开头的六步检查清单展开。
