# 全局显示优化设计（显示逻辑 + 显示效果）

日期：2026-08-23
状态：已确认（brainstorm 两轮设计评审通过）

## 背景与现状

对 76 个 `.vue` 页面的调研确认了以下问题：

**显示逻辑层面**
- 加载态：70/76 页面有加载指示，但 `HomePage`、两个毕设 Dashboard 页完全没有；`NSpin` 与 `:loading` 两种模式混用
- 空状态：21 个页面没有空态处理；共享组件 `EmptyState` 基本只有 practice 模块在用，其余页面各自用裸 `NEmpty`
- 错误提示：存在双重 toast —— `api.ts` 已对业务错误弹消息，页面 `catch` 里又弹一次
- 状态标签：同一状态颜色映射在多个页面重复定义（如 `CampaignStatus` 复制 3 份），状态值为硬编码中文字符串
- 日期格式化：无共享工具，`formatDateTime` 在 ~10 个文件各自实现且格式不一（`replace('T',' ')` vs `slice(0,16)`）
- 表格：`scroll-x` 从 760 到 1560 不等；分页方式三种并存

**视觉效果层面**
- `NConfigProvider` 无任何主题令牌定制（主色/圆角/阴影全默认）
- 无面包屑、无页面过渡，HomePage 只是居中欢迎文字
- 195 处内联 `style=` 违反项目规范（42 个文件）
- 68 个 CSS 文件中大量写死颜色（`#e8eaed`、`#fff`、`#f0f2f5`），暗色模式无法成立

## 已确认的决策

| 决策点 | 结论 |
|---|---|
| 优化范围 | 显示逻辑 + 视觉效果全面优化 |
| 暗色模式 | 做。设置弹窗切换（浅色/深色/跟随系统），localStorage 持久化 |
| 视觉方向 | 整体 = B 紧凑专业风（细边框、小圆角、弱阴影、紧凑密度）；按钮等交互元素 = A 风质感（圆角 6px、主色填充、有呼吸感） |
| 表格操作列按钮 | 实心主按钮（编辑等）+ 描边危险按钮（删除等），行高 ~34px、按钮 20px，上下各留 ~6px 不贴线（防误触） |
| 首页 | 不做仪表盘；`/` 按角色重定向到默认功能页，HomePage 退出路由表 |
| 实施路线 | 地基先行 → 外壳改造 → 逐模块扫除（六批） |

## 设计

### 1. 主题系统（新增 `src/theme/`）

**`src/theme/index.ts`** — 导出浅色/深色两套 Naive UI `GlobalThemeOverrides`：
- 主色：蓝色系 `#2563eb` 及 hover/pressed/suppl 梯度
- 圆角分级：表格/卡片/输入框 3–4px（B 风骨架），按钮 6px（A 风质感），通过组件级 override（`Button.borderRadiusMedium` 等）实现
- `DataTable` 组件级覆盖：紧凑行高、细边框 `#ececf0`（暗色对应变量）、表头浅灰底
- `Card`、`NModal`、`NInput` 等常用组件的边框/圆角/内边距统一

**`src/theme/global.css`** — 语义化 CSS 变量：
- 变量：`--app-bg`、`--app-sidebar-bg`、`--app-border`、`--app-text`、`--app-text-secondary`、`--app-hover-bg`、`--app-active-bg` 等
- 暗色通过 `html.dark` 选择器整体覆盖
- **68 个现有 CSS 文件中写死的颜色全部迁移到变量**（暗色模式的前提）

**`src/stores/useThemeStore.ts`** — 新 Pinia store（setup 风格）：
- 状态：`mode: 'light' | 'dark' | 'system'`
- 持久化 localStorage；`system` 模式监听 `prefers-color-scheme` 变化
- 暴露 `isDark` computed 供 `App.vue` 与图表使用

**`App.vue`** — `NConfigProvider` 增加 `:theme="isDark ? darkTheme : null"` 与 `:theme-overrides`；同时给 `<html>` 同步 `dark` class

**图表** — `src/shared/chartTheme.ts` 改为 `useChartTheme()` 组合式函数，返回随主题响应式变化的 ECharts 令牌（坐标轴文字、分割线、tooltip 底色等），`BaseChart.vue` 在主题切换时刷新 option

### 2. 共享显示逻辑（消灭重复）

| 设施 | 位置 | 解决问题 |
|---|---|---|
| `formatDateTime` / `formatDate` / `formatScore` / `formatPercent` | `src/shared/utils/format.ts` | ~10 处各自为政的格式化；null/undefined 统一显示 `-`；`formatDateTime` 输出 `YYYY-MM-DD HH:mm` |
| `StatusTag.vue` + 每模块单一 `status.ts` | `src/shared/components/`、`src/modules/<m>/status.ts` | 状态色映射重复定义；标签文案走 i18n key；后端中文枚举值收敛为模块内常量 |
| 推广 `EmptyState.vue` | 已有组件，全项目替换裸 `NEmpty` | 21 个无空态页面补齐；表格 `:render-empty` / 卡片空态统一 |
| `renderActions()` 助手 | `src/shared/utils/tableActions.ts` | 统一「实心主按钮 + 描边危险按钮」渲染（h() 场景），自动带间距不贴线 |
| 错误提示收口 | 改 `src/shared/api.ts` | 业务错误统一在 api 层 toast（抛出的 Error 打 `reported` 标记）；页面 `catch` 只做本地状态恢复，不再 `message.error` 业务错误；个别页面用 opt-out 参数自定义 |
| `useRemotePagination` | 已有，继续推广 | 服务端分页表统一行为 |

**i18n 补漏**：周几标签（time-restrictions、curriculum）、性别枚举（ProfilePage）、各状态文案等硬编码中文全部迁入 `src/locales/{locale}/<module>.json`。

### 3. 布局外壳（MainLayout）

- **面包屑**：内容区顶部 `模块 / 页面`。每个路由记录补 `meta.titleKey`，从 `route.matched` 链自动生成；逐模块扫除时在各自 `router.ts` 补齐
- **页面过渡**：`RouterView` 套 `Transition name="fade-slide"`，150ms 淡入微位移
- **角色默认页**：`/` 按角色重定向，映射表集中在一处（一行可改）：
  - 学生 → `/curriculum`；教师 → `/curriculum`；院系 → `/teach-drafts`；教务 → `/time-restrictions`
  - 未匹配到角色（或用户信息未就绪）时回退到 `/profile`
  - 删除 `HomePage.vue` 及其 CSS（不再被任何路由引用）
- **设置弹窗**：新增「外观」设置项（浅色/深色/跟随系统，NRadioGroup），与语言、修改密码并列
- **侧边栏**：B 风改造——近白底 + 细分隔线，选中项左侧主色指示条 + 浅色底；暗色下深色面 + 主色条；现有 SVG 图标保留
- **登录/注册页**：应用同一套令牌（圆角、主色、阴影、暗色适配）

### 4. 模块扫除顺序（六批）

地基（主题+共享设施）与外壳完成后，按以下顺序逐模块推进。每个模块的检查清单：

1. CSS 迁移到令牌变量，清除内联 `style=`
2. 接入共享格式化 / StatusTag / EmptyState / renderActions
3. 页面 `catch` 去除重复 toast
4. 补齐加载态（表格 `:loading`，非表格 `NSpin`）
5. 硬编码中文迁 i18n
6. 路由补 `meta.titleKey`

批次：

1. `auth`（登录/注册/个人中心——门面）
2. `score` + `exam`（最高频，含成绩录入、统计图表）
3. `curriculum` + `course` + `selection`（课表/选课）
4. `practice` + `practice/graduation`（最大模块，~25 页）
5. `analysis`（图表主题适配）
6. 管理类 CRUD：`college / majors / grades / class-names / locals / student-management / batch-import / time-restrictions / scheduling`

### 5. 错误处理与验证策略

- **错误处理**：业务错误与网络错误统一由 `api.ts` 弹出；页面 `catch` 只恢复本地状态（如重置 submitting）。需要自定义错误展示的页面通过 api 层 opt-out 参数处理
- **验证**：项目无测试框架，不引入。每层完成跑 `pnpm type-check` + `pnpm build`；lint/format 只对本次改动文件运行（不全仓 `--fix`）；每模块扫除后人工过一遍明/暗两种主题
- **YAGNI（明确不做）**：不新增后端接口、不做首页仪表盘、不引入 JSX/测试框架、不改路由守卫逻辑、不缓存数据到前端
