// 从 dist/index.html 提取内联脚本的 CSP sha256 哈希(供 docs/nginx.conf 的 script-src 白名单)
//
// 背景:生产 CSP(script-src 'self')禁止内联脚本,但 SPA 外壳 index.html 的两个
// 内联脚本(主题防闪屏、splash 语言)必须在首帧渲染前同步执行,无法外置,
// 只能按内容哈希放行。JSON-LD 等非 JS 类型 <script> 不受 script-src 约束,无需哈希。
//
// 用法: pnpm build-only && pnpm csp-hashes
// 注意: 修改 index.html 内联脚本的任意字符(含空白)都会改变哈希——
//       改后必须重新构建并重跑本脚本,把新哈希同步进 docs/nginx.conf
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')

// 仅匹配不带 src/type 属性的纯内联 <script>(<script type="module" src> 与 ld+json 均不命中)
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])

if (blocks.length === 0) {
  console.error('dist/index.html 中未找到内联脚本,请先执行 pnpm build-only')
  process.exit(1)
}

console.log("将以下哈希加入 docs/nginx.conf 的 script-src(顺序无关):")
for (const content of blocks) {
  const hash = createHash('sha256').update(content, 'utf8').digest('base64')
  const label = content.includes('xxq-theme')
    ? '主题防闪屏'
    : content.includes('navigator.language')
      ? 'splash 语言'
      : '未识别'
  console.log(`  'sha256-${hash}'  # ${label}`)
}
