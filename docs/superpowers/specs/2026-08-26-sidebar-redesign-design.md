# 侧边栏重写设计（悬浮卡片风 + 分组折叠菜单）

日期：2026-08-26
状态：已确认

## 目标

重写 `MainLayout.vue` 的侧边栏，两个动机一次完成：

1. **视觉升级**：侧边栏从「贴边灰底栏」改为「悬浮圆角卡片」，选中项改为圆角色块。
2. **代码结构**：680 行单文件拆分；菜单从 ~200 行 if 拼接改为声明式数据配置。

功能保持不变：折叠/展开（偏好持久化到后端）、用户下拉（通知角标/设置/退出）、设置弹窗（语言/密码/外观）、退出确认、面包屑、路由过渡。

## 方案

保留 Naive UI `NMenu`（分组折叠、收起时弹出子菜单、键盘导航内置），视觉通过主题覆盖 + scoped CSS 实现。自绘菜单方案因违反「优先用 Naive UI」约定且需重写无障碍/弹出逻辑而否决。

`NLayoutSider` 弃用，改用普通 `<aside>` + CSS width 过渡：悬浮卡片需要透明轨道 + 内层卡片留白，NLayoutSider 自带背景/边框反而需要大量覆盖，其唯一价值（宽度动画）用两行 CSS 即可实现。

## 代码结构

```
src/modules/layout/
  MainLayout.vue        # 骨架: AppSidebar + 内容区(面包屑+RouterView) + NotificationPanel,~70 行
  MainLayout.css        # 内容区 margin、面包屑页眉、fade-slide 过渡
  menu.ts               # 声明式菜单配置 + resolveMenuForRole() + matchActiveKey()
  components/
    AppSidebar.vue      # 悬浮卡片侧边栏: 顶部(名称+折叠钮) / NMenu / 底部用户区 / 退出确认弹窗
    AppSidebar.css
    SettingsModal.vue   # 设置弹窗(语言/密码/外观), defineModel<boolean>('show')
    SettingsModal.css
```

生命周期职责：`notificationStore.connect/disconnect`、`preferenceStore.load/reset` 留在 MainLayout（布局壳职责）；退出确认、设置弹窗收进 AppSidebar（触发源在那里）。

## 菜单配置（menu.ts）

```ts
interface MenuLeaf { key: string; labelKey: string; roles: UserType[] }      // 分组内子项,无图标
interface MenuTopItem extends MenuLeaf { icon: string }                       // 顶部独立项,有图标
interface MenuGroup { key: string; labelKey: string; icon: string; children: MenuLeaf[] }
```

- `TOP_ITEMS`：个人信息(全角色)、课程表(student/teacher)、选课(student)
- `MENU_GROUPS`：
  | 分组 | labelKey | 子项 |
  |---|---|---|
  | 教学管理 | layout.groupTeaching（新增） | 时间限制、开课草稿、课程/班级/教室/排课/批量导入/学生/专业/学院/学期/年级/选课管理 |
  | 成绩与考试 | layout.groupScore（新增） | 我的成绩、我的考试、成绩管理、成绩统计、考试管理、补考管理、成绩复核 |
  | 学情分析 | layout.groupAnalysis（新增） | 学业预警、教学质量、评教 |
  | 实践与创新 | layout.groupPractice（新增） | 实习/竞赛/社实(管理端+学生端) |
  | 毕业设计 | graduation.menuTitle（复用） | 现有 4 角色共 26 个子项原样搬入，每项标 roles |

- 子项在配置中按角色块顺序排列，过滤后保持原有相对顺序不变。
- `resolveMenuForRole(userType)`：过滤出可见顶部项 + 非空分组（组内无可见子项时整组隐藏）。
- 路由全部不变，仅导航层级变化。
- 新增 4 个 i18n key（zh-CN / en 的 layout.json）：groupTeaching=教学管理/Teaching、groupScore=成绩与考试/Scores & Exams、groupAnalysis=学情分析/Analysis、groupPractice=实践与创新/Practice。

## 选中态与展开态

- `matchActiveKey(path, keys)`：取与 `route.path` 精确相等或是其路径前缀（`key + '/'`）的**最长**菜单 key。替代原来硬编码的 `/selection/` 特判，所有参数化子路由自动正确高亮。
- `expandedKeys` 由 AppSidebar 持有：`watch(activeKey)` 时若所属分组未展开则追加（用户手动折叠不被强制 reopen，因为只在「未包含」时追加；首次进入带组页面自动展开）。

## 视觉规格（悬浮卡片）

- `<aside>` 固定定位，宽 232px（收起 88px），`transition: width .3s cubic-bezier(.4,0,.2,1)`。
- 卡片：距视口上/左/下各 12px、右 12px（即内容区与卡片间露出 12px `--app-bg` 底色），`border-radius: 14px`，背景 `--app-card-bg`，阴影 `--app-card-shadow`，`overflow: hidden` 裁切内部圆角。
- 内容区 `margin-left: 232px`（收起 88px），过渡保留。
- 选中项：圆角色块（`--app-active-bg` 底 + 主色文字/图标），经主题覆盖 `Menu.borderRadius: '8px'` 实现（theme/index.ts 的 menuBase，明暗两套共享）；删除旧的「左侧 2px 指示条」CSS。
- 菜单区 `padding: 4px 8px`；分组子项无图标，靠 NMenu 自身缩进（root-indent 20 / indent 24），不画引导线（YAGNI）。
- 底部用户区：去掉独立灰底（`--app-sidebar-bottom-bg` 不再用于此），改为卡片内 `border-top` 分隔 + hover `--app-hover-bg`，圆角由卡片 overflow 裁切。
- 项目名/用户名用 position:absolute + opacity 过渡（不再用 v-show，折叠动画更顺滑）。
- 暗色模式：全部走现有 CSS 变量；`html.dark` 下 SVG 图标 invert 规则从 MainLayout.css 平移到 AppSidebar.css / SettingsModal.css。
- 不新增 CSS 变量（复用 --app-card-bg / --app-card-shadow / --app-hover-bg / --app-active-bg / --app-border）。

## 折叠行为

- 状态仍读写 `preferenceStore.sidebarCollapsed`（后端浅合并持久化，无本地缓存）。
- 收起时卡片 64px 宽（aside 88px 减去两侧 12px），NMenu `:collapsed` + `:collapsed-width="48"`（64 - 8×2 内边距），分组子菜单自动变为悬停弹出层（NMenu 内置）。
- 底部用户区收起时只剩头像（居中），用户名/箭头 opacity 隐藏，下拉 placement 切 `top`。

## 验证

- `pnpm type-check`
- 仅对改动文件跑 prettier / eslint（不全仓 --fix）
- `pnpm build-only` 静态兜底
- 手动：四种角色登录验证菜单分组、折叠/展开、选中高亮、暗色模式
