// 落地页生成器:把 scripts/landing/ 下的内容数据渲染成 public/ 下的静态 HTML 与 sitemap。
//
// 为什么用生成器:收录面有 14 个页面,head/canonical/hreflang/og/JSON-LD/页头/页脚
// 全部重复;手写必然漏改(改一次导航要同步 14 个文件),站点地图也会忘记更新。
//
// 用法:
//   node scripts/build-landing.mjs           写入 public/
//   node scripts/build-landing.mjs --check   只校验 public/ 是否与数据源一致,有漂移则 exit 1
//
// 产物全部提交进仓库(随 public/ 并入 dist),pnpm build 流程不变。
// 改完文案必须重跑本脚本,否则 --check 会失败。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderPage, renderSitemap, SITE_ORIGIN, BRAND } from './landing/site.mjs'
import { PAGES_ZH, SUBNAV_SLUGS, FOOTER_COLUMNS } from './landing/pages.zh.mjs'
import { PAGES_EN } from './landing/pages.en.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = join(ROOT, 'public')
const CHECK = process.argv.includes('--check')

/** SPA 顶层路由名。public/<name>/index.html 与它们同名会让该路由永久不可达——
 *  nginx 下目录存在时静态页会先接管请求,SPA 永远拿不到。
 *  新增落地页目录前必须核对本表(来源:src/router/index.ts)。 */
const RESERVED_ROUTE_NAMES = new Set([
  'profile', 'course', 'selection', 'curriculum', 'time-restrictions', 'scheduling',
  'course-management', 'class-names', 'locals', 'teach-drafts', 'batch-import',
  'student-management', 'majors', 'semester', 'grades', 'scores', 'score-statistics',
  'my-scores', 'score-review', 'exams', 'makeup-exams', 'my-exams', 'analysis',
  'practice', 'colleges', 'login', 'register', '403',
])

/** 中文页面 description 的长度区间(汉字计)。百度结果页约展示 78 字,
 *  超出会被截断,过短则浪费可用的摘要位。 */
const ZH_DESC_MIN = 70
const ZH_DESC_MAX = 80

const ALL_PAGES = [...PAGES_ZH, ...PAGES_EN]

/** 校验内容数据。任何一条不过就终止,不产出半成品。 */
function validate(pages) {
  const errors = []

  if (SITE_ORIGIN.includes('example.com')) {
    errors.push('SITE_ORIGIN 仍是占位域名 example.com,请先在 scripts/landing/site.mjs 改掉')
  }

  const seenSlug = new Set()
  const seenTitle = new Map()
  const seenDesc = new Map()

  for (const page of pages) {
    const where = page.outPath || page.slug || '(首页)'

    if (seenSlug.has(page.slug)) errors.push(`slug 重复:${page.slug || '(首页)'}`)
    seenSlug.add(page.slug)

    // 生成 public/index.html 会覆盖 Vite 构建出的 SPA 外壳 dist/index.html,
    // 导致整个应用被落地页顶掉——这条必须硬拦。
    if (page.outPath === 'index.html') {
      errors.push(`${where}: 不得生成 public/index.html,会与 Vite 构建的 SPA 外壳冲突`)
    }

    if (RESERVED_ROUTE_NAMES.has(page.slug)) {
      errors.push(`${where}: 目录名与 SPA 顶层路由同名,会让该路由永久不可达`)
    }

    if (seenTitle.has(page.title)) {
      errors.push(`title 与 ${seenTitle.get(page.title)} 重复:${page.title}`)
    }
    seenTitle.set(page.title, where)

    if (seenDesc.has(page.description)) {
      errors.push(`description 与 ${seenDesc.get(page.description)} 重复`)
    }
    seenDesc.set(page.description, where)

    if (page.lang === 'zh-CN') {
      const len = [...page.description].length
      if (len < ZH_DESC_MIN || len > ZH_DESC_MAX) {
        errors.push(
          `${where}: description 长度 ${len},应在 ${ZH_DESC_MIN}-${ZH_DESC_MAX} 之间(当前:${page.description})`,
        )
      }
    }

    if (!page.h1 || !page.lead) errors.push(`${where}: 缺少 h1 或 lead`)
    // 正文可以是章节,也可以是纯 FAQ(如 /faq/),但两者不能都为空
    const hasSections = page.sections && page.sections.length > 0
    const hasFaq = page.faq && page.faq.length > 0
    if (!hasSections && !hasFaq) errors.push(`${where}: 正文为空,既没有 sections 也没有 faq`)
    for (const group of page.faq || []) {
      if (!group.group || !Array.isArray(group.items) || group.items.length === 0) {
        errors.push(`${where}: faq 分组缺少 group 名或 items`)
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(page.lastModified || '')) {
      errors.push(`${where}: lastModified 需为 YYYY-MM-DD(不用当前时间,见 site.mjs 注释)`)
    }
  }

  // 内链目标必须真实存在,否则页面上会出现死链(比没有内链更糟)
  const slugs = new Set(pages.map((p) => p.slug))
  for (const page of pages) {
    for (const target of page.related || []) {
      if (!slugs.has(target)) errors.push(`${page.outPath}: related 指向不存在的页面 ${target}`)
    }
  }

  if (errors.length > 0) {
    console.error('落地页内容校验失败:\n')
    for (const err of errors) console.error(`  ✗ ${err}`)
    process.exit(1)
  }
}

/** 组装导航结构(供 site.mjs 渲染页头页脚) */
function buildNav(pages) {
  const bySlug = new Map(pages.map((p) => [p.slug, p]))
  return {
    brandFullZh: 'XXQ 高校教务管理系统',
    brandFullEn: 'XXQ Academic Affairs Management System',
    features: SUBNAV_SLUGS.map((slug) => {
      const page = bySlug.get(slug)
      return { path: page.urlPath, label: page.navLabel }
    }),
    footerColumns: FOOTER_COLUMNS.map((col) => ({
      title: col.title,
      links: col.slugs.map((slug) => {
        const page = bySlug.get(slug)
        return { path: page.urlPath, label: page.navLabel }
      }),
    })),
    bySlug,
  }
}

function countChars(text) {
  return [...text].length
}

function main() {
  validate(ALL_PAGES)
  const nav = buildNav(ALL_PAGES)

  /** outPath(相对 public/)→ 文件内容 */
  const outputs = new Map()
  for (const page of ALL_PAGES) {
    outputs.set(page.outPath, renderPage(page, nav))
  }
  outputs.set('sitemap.xml', renderSitemap(ALL_PAGES))

  if (CHECK) {
    const drifted = []
    for (const [outPath, content] of outputs) {
      const abs = join(PUBLIC_DIR, outPath)
      if (!existsSync(abs)) {
        drifted.push(`${outPath}(缺失)`)
        continue
      }
      // 归一化行尾再比:仓库 .gitattributes 为 eol=lf,但工作区可能被
      // 编辑器改成 CRLF,那种差异不该判成内容漂移
      const onDisk = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')
      if (onDisk !== content) drifted.push(`${outPath}(内容不一致)`)
    }
    if (drifted.length > 0) {
      console.error('落地页与内容数据源不一致,请重跑 node scripts/build-landing.mjs:\n')
      for (const d of drifted) console.error(`  ✗ ${d}`)
      process.exit(1)
    }
    console.log(`落地页校验通过:${outputs.size} 个文件与内容数据源一致`)
    return
  }

  for (const [outPath, content] of outputs) {
    const abs = join(PUBLIC_DIR, outPath)
    mkdirSync(dirname(abs), { recursive: true })
    // 显式写 LF:与 .gitattributes 的 eol=lf 一致,避免每次生成都产生整文件 diff
    writeFileSync(abs, content, 'utf8')
  }

  console.log(`已生成 ${outputs.size} 个文件到 public/:`)
  for (const page of ALL_PAGES) {
    const marker = page.lang === 'zh-CN' ? `描述 ${countChars(page.description)} 字` : ''
    console.log(`  ${page.urlPath.padEnd(34)} ${marker}`)
  }
  console.log(`  ${'sitemap.xml'.padEnd(34)} ${ALL_PAGES.filter((p) => p.indexable).length} 条 URL`)
  console.log(`\n品牌:${BRAND}   站点:${SITE_ORIGIN}`)
}

main()
