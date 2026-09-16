// 落地页共享骨架:站点常量、<head> / 页头 / 页脚 / JSON-LD 的统一构造。
//
// 本模块只负责「怎么渲染」,不负责「渲染什么」——页面文案全部在 pages.zh.mjs /
// pages.en.mjs 里。新增页面时只改内容数据,不要把结构写回这里。
//
// 缩进约定:下面每个 renderXxx 都返回「从第 0 列开始」的 HTML 片段,由调用方用
// indentBlock() 统一右移。这样片段内部不必关心自己被嵌到第几层,改动嵌套层级时
// 也不会留下一堆对不齐的字符串字面量。

/** 站点源。canonical / og:url / hreflang / sitemap / robots 全部由它派生,
 *  改域名只需改这一行(改完必须重跑 node scripts/build-landing.mjs)。 */
export const SITE_ORIGIN = 'https://hanshauangxxq.cn'

export const SITE_DOMAIN = 'hanshauangxxq.cn'
export const BRAND = 'XXQ'

/** 分享卡片与品牌方图(由 scripts/build-og-image.py 生成) */
export const OG_IMAGE = { 'zh-CN': '/og-image.png', en: '/og-image-en.png' }
export const LOGO_IMAGE = '/logo.png'

/** 站点级 JSON-LD 节点的 @id,供各页面互相引用 */
const ORG_ID = `${SITE_ORIGIN}/#organization`
const WEBSITE_ID = `${SITE_ORIGIN}/#website`

/** HTML 文本与属性转义 */
export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** XML 文本转义(sitemap 用,多转义单引号) */
export function escXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 站内路径 → 绝对 URL */
export function absUrl(path) {
  return `${SITE_ORIGIN}${path}`
}

/**
 * 生成页面的绝对 URL。目录型 URL 统一带尾斜杠,避免 /about 与 /about/ 两个
 * 变体被判成重复内容——canonical 与站内链接必须用同一形式。
 */
export function canonicalUrl(page) {
  return absUrl(page.urlPath)
}

/** 整段右移 n 格;空行保持为空,不留尾随空格 */
function indentBlock(text, spaces) {
  if (!text) return ''
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((line) => (line.length === 0 ? '' : pad + line))
    .join('\n')
}

/** 渲染 JSON-LD(@graph),从第 0 列开始 */
function renderJsonLd(page) {
  const url = canonicalUrl(page)
  const graph = []

  // 每个页面都自带 Organization / WebSite 定义,使单页文档自洽,
  // 不依赖「@id 指向另一页才定义过的节点」这种跨页引用。
  graph.push({
    '@type': 'Organization',
    '@id': ORG_ID,
    name: BRAND,
    url: absUrl('/'),
    logo: { '@type': 'ImageObject', url: absUrl(LOGO_IMAGE), width: 512, height: 512 },
  })

  graph.push({
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: BRAND,
    url: absUrl('/'),
    inLanguage: ['zh-CN', 'en'],
    publisher: { '@id': ORG_ID },
  })

  const webPage = {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: page.title,
    description: page.description,
    isPartOf: { '@id': WEBSITE_ID },
    inLanguage: page.lang,
  }
  if (page.application) {
    webPage.about = { '@id': `${absUrl('/')}#software` }
  }
  if (page.breadcrumb.length > 1) {
    webPage.breadcrumb = { '@id': `${url}#breadcrumb` }
  }
  graph.push(webPage)

  if (page.breadcrumb.length > 1) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: page.breadcrumb.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: crumb.name,
        // 末项即当前页,不给 item(与面包屑导航里 [aria-current=page] 的处理一致)
        ...(crumb.path ? { item: absUrl(crumb.path) } : {}),
      })),
    })
  }

  // 产品主体只在首页声明,避免在每个详情页重复一大段 featureList。
  // 刻意不输出 aggregateRating / review:没有真实评分数据,伪造会被判结构化数据作弊。
  // 也刻意不输出 screenshot:尚无真实产品截图(截取需登录态),等 P2 补图后再加。
  if (page.application) {
    graph.push({
      '@type': 'SoftwareApplication',
      '@id': `${absUrl('/')}#software`,
      name: page.application.name,
      alternateName: page.application.alternateName,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      url,
      inLanguage: ['zh-CN', 'en'],
      description: page.description,
      image: absUrl(OG_IMAGE[page.lang]),
      publisher: { '@id': ORG_ID },
      featureList: page.application.featureList,
    })
  }

  if (page.faq && page.faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      // 分组只是页面排版,结构化数据里是一张平铺的问答表
      mainEntity: flattenFaq(page).map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    })
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)
}

/** 渲染 <head> 内容(不含 <head> 标签本身) */
function renderHead(page, alternates) {
  const lines = [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    '<meta name="robots" content="index, follow">',
    '<meta name="theme-color" content="#f0f2f5">',
    '<!-- 规范链接与多语言互链 -->',
    `<link rel="canonical" href="${canonicalUrl(page)}">`,
  ]

  // hreflang 只挂在成对的首页上:详情页仅中文,单侧 alternate 比不写更糟
  for (const alt of alternates) {
    lines.push(`<link rel="alternate" hreflang="${alt.hreflang}" href="${absUrl(alt.path)}">`)
  }

  lines.push(
    '<!-- 链接分享预览(og:image 为绝对 URL,微信/QQ/Twitter 卡片依赖) -->',
    `<meta property="og:site_name" content="${BRAND}">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${canonicalUrl(page)}">`,
    page.lang === 'zh-CN'
      ? '<meta property="og:locale" content="zh_CN">'
      : '<meta property="og:locale" content="en_US">',
    page.lang === 'zh-CN'
      ? '<meta property="og:locale:alternate" content="en_US">'
      : '<meta property="og:locale:alternate" content="zh_CN">',
    `<meta property="og:image" content="${absUrl(OG_IMAGE[page.lang])}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${esc(page.ogImageAlt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:image" content="${absUrl(OG_IMAGE[page.lang])}">`,
    `<meta name="twitter:image:alt" content="${esc(page.ogImageAlt)}">`,
    '<link rel="icon" href="/favicon.ico">',
    '<link rel="stylesheet" href="/landing.css">',
    '<!-- 登录态打类:必须同步阻塞在 <head>,早于 body 解析给 <html> 加 logged-in 类,',
    '    否则已登录访客会先看到「登录」按钮再被替换。生产 CSP(script-src \'self\',',
    '    见 docs/nginx.conf)禁内联脚本,故外置 -->',
    '<script src="/landing-boot.js"></script>',
    '<!-- 头像菜单等 DOM 交互:defer 在 DOMContentLoaded 前执行,不阻塞首屏;',
    '    不能用 async——若晚于 DOMContentLoaded 加载,监听器永不注册 -->',
    '<script src="/landing.js" defer></script>',
    '<script type="application/ld+json">',
    renderJsonLd(page),
    '</script>',
  )

  // 统一右移 4 格贴合 <head>(不要 trimStart:首行也要保持缩进)
  return indentBlock(lines.join('\n'), 4)
}

/** 渲染功能导航条(仅中文页;英文页没有对应的详情页,不硬凑) */
function renderSubnav(page, nav) {
  if (page.lang !== 'zh-CN') return ''
  const items = nav.features
    .map((f) => `<li><a href="${f.path}">${esc(f.label)}</a></li>`)
    .join('\n')
  return `<nav class="subnav" aria-label="功能导航">
  <ul class="subnav-list container">
${indentBlock(items, 4)}
  </ul>
</nav>`
}

/** 渲染站点头部(访客态 + 已登录态两套,由 <html> 的 logged-in 类切换)。
 *  两套都必须完整输出:landing.js 依赖 .avatar-btn / .user-dropdown /
 *  .user-name / [data-logout] 存在,缺一个已登录用户就会报错。 */
function renderHeader(page, nav) {
  const label =
    page.lang === 'zh-CN'
      ? { nav: '主导航', menu: '用户菜单', signIn: '登录', enter: '进入系统', signOut: '退出登录' }
      : {
          nav: 'Main navigation',
          menu: 'User menu',
          signIn: 'Sign In',
          enter: 'Enter System',
          signOut: 'Sign Out',
        }

  const otherLang =
    page.lang === 'zh-CN'
      ? { href: '/en/', hreflang: 'en', lang: 'en', text: 'English' }
      : { href: '/', hreflang: 'zh-CN', lang: 'zh-CN', text: '中文' }

  const subnav = renderSubnav(page, nav)
  const subnavBlock = subnav ? `\n${subnav}` : ''

  return `<header class="site-header">
  <nav class="nav container" aria-label="${label.nav}">
    <a class="brand" href="${page.lang === 'zh-CN' ? '/' : '/en/'}">${BRAND}</a>
    <ul class="nav-actions">
      <li><a class="lang-switch" href="${otherLang.href}" hreflang="${otherLang.hreflang}" lang="${otherLang.lang}">${otherLang.text}</a></li>
      <li class="guest-only"><a class="btn btn-primary" href="/login">${label.signIn}</a></li>
      <li class="user-menu user-only">
        <button
          type="button"
          class="avatar-btn"
          aria-haspopup="menu"
          aria-expanded="false"
          aria-controls="user-dropdown"
          aria-label="${label.menu}"
        >
          <img class="avatar-img" alt="" hidden>
          <span class="avatar-fallback" hidden></span>
        </button>
        <div class="user-dropdown" id="user-dropdown" hidden>
          <p class="user-name"></p>
          <a class="btn btn-primary btn-block" href="/profile">${label.enter}</a>
          <button type="button" class="btn btn-ghost btn-block" data-logout>${label.signOut}</button>
        </div>
      </li>
    </ul>
  </nav>${subnavBlock}
</header>`
}

/** 渲染页脚:全站内链(收录页面的主要发现路径,站点地图只是补充) */
function renderFooter(page, nav) {
  if (page.lang !== 'zh-CN') {
    return `<footer class="site-footer">
  <p>
    <small>© 2026 ${nav.brandFullEn} · <a href="/" hreflang="zh-CN" lang="zh-CN">中文</a></small>
  </p>
</footer>`
  }

  const columns = nav.footerColumns
    .map((col) => {
      const links = col.links
        .map((l) => `<li><a href="${l.path}">${esc(l.label)}</a></li>`)
        .join('\n')
      return `<div class="footer-col">
  <h2 class="footer-col-title">${esc(col.title)}</h2>
  <ul>
${indentBlock(links, 4)}
  </ul>
</div>`
    })
    .join('\n')

  // 备案号占位:ICP 与公安备案号拿到后替换下方一行,并同步更新 /filing/ 页
  return `<footer class="site-footer">
  <div class="container footer-grid">
${indentBlock(columns, 4)}
  </div>
  <div class="container footer-meta">
    <p>
      <small>© 2026 ${nav.brandFullZh} · <a href="/en/" hreflang="en" lang="en">English</a></small>
    </p>
    <p>
      <small>
        <a href="https://beian.miit.gov.cn/" rel="nofollow noopener" target="_blank">京ICP备XXXXXXXX号</a>
        · <a href="/filing/">备案信息</a>
      </small>
    </p>
  </div>
</footer>`
}

/** 渲染面包屑导航(视觉版;结构化数据在 JSON-LD 里另发) */
function renderBreadcrumb(page) {
  if (page.breadcrumb.length <= 1) return ''
  const items = page.breadcrumb
    .map((crumb, i) => {
      const isLast = i === page.breadcrumb.length - 1
      return isLast
        ? `<li><span aria-current="page">${esc(crumb.name)}</span></li>`
        : `<li><a href="${crumb.path}">${esc(crumb.name)}</a></li>`
    })
    .join('\n')
  return `<nav class="breadcrumb container" aria-label="面包屑">
  <ol>
${indentBlock(items, 4)}
  </ol>
</nav>`
}

/** 渲染正文区块。页面可以只有 FAQ(/faq/),此时 sections 缺省,返回空串。 */
function renderSections(page) {
  const blocks = (page.sections || []).map((section) => {
    const parts = [`<section class="prose-section">`, `  <h2>${esc(section.h2)}</h2>`]
    for (const para of section.paras || []) {
      parts.push(`  <p>${esc(para)}</p>`)
    }
    if (section.list && section.list.length > 0) {
      parts.push('  <ul class="prose-list">')
      for (const item of section.list) {
        parts.push(`    <li>${esc(item)}</li>`)
      }
      parts.push('  </ul>')
    }
    // 卡片网格:与纯文字段落同为 <h2>+内容的等价语义,只是排版更适合概览性内容
    if (section.cards && section.cards.length > 0) {
      parts.push('  <ul class="card-grid">')
      for (const card of section.cards) {
        parts.push(`    <li class="card">
      <h3>${esc(card.h3)}</h3>
      <p>${esc(card.p)}</p>
    </li>`)
      }
      parts.push('  </ul>')
    }
    parts.push('</section>')
    return parts.join('\n')
  })
  return blocks.join('\n')
}

/** 把分组形式的 FAQ 摊平成问答数组(结构化数据用) */
function flattenFaq(page) {
  return (page.faq || []).flatMap((group) => group.items)
}

/** 渲染 FAQ 区块。按主题分组,每组一个 <h2>,问答用 details 折叠,无 JS 依赖。 */
function renderFaq(page) {
  if (!page.faq || page.faq.length === 0) return ''
  const blocks = page.faq.map((group) => {
    const items = group.items
      .map(
        (item) => `<details class="faq-item">
  <summary>${esc(item.q)}</summary>
  <p>${esc(item.a)}</p>
</details>`,
      )
      .join('\n')
    return `<section class="prose-section">
  <h2>${esc(group.group)}</h2>
  <div class="faq-list">
${indentBlock(items, 4)}
  </div>
</section>`
  })
  return blocks.join('\n')
}

/** 渲染相关页面内链(描述性锚文本,避免「点击这里」这类无信息量锚点) */
function renderRelated(page, nav) {
  const targets = (page.related || []).map((slug) => nav.bySlug.get(slug)).filter(Boolean)
  if (targets.length === 0) return ''
  const links = targets
    .map((target) => `<li><a href="${target.urlPath}">${esc(target.linkLabel)}</a></li>`)
    .join('\n')
  return `<section class="prose-section related-section">
  <h2>相关功能</h2>
  <ul class="related-list">
${indentBlock(links, 4)}
  </ul>
</section>`
}

/** 渲染完整页面 HTML */
export function renderPage(page, nav) {
  const alternates = page.alternates || []

  // 主转化入口。guest-only 让已登录访客看不到它(landing-boot.js 打的 logged-in 类控制)
  const ctaLabel = page.lang === 'zh-CN' ? '进入系统' : 'Sign In'
  const hero = `<section class="hero${page.breadcrumb.length > 1 ? ' hero-compact' : ''}" aria-labelledby="hero-title">
  <h1 id="hero-title">${esc(page.h1)}</h1>
  <p class="hero-lead">${esc(page.lead)}</p>
  <a class="btn btn-primary btn-lg guest-only" href="/login">${ctaLabel}</a>
</section>`

  const main = [
    '<main>',
    renderBreadcrumb(page),
    hero,
    '<div class="container">',
    renderSections(page),
    renderFaq(page),
    renderRelated(page, nav),
    '</div>',
    '</main>',
  ]
    .filter((block) => block !== '')
    .join('\n')

  return `<!DOCTYPE html>
<!--
  此文件由 scripts/build-landing.mjs 生成,请勿直接编辑。
  内容数据在 scripts/landing/pages.${page.lang === 'zh-CN' ? 'zh' : 'en'}.mjs,改完重跑:
    node scripts/build-landing.mjs
-->
<html lang="${page.lang}">
  <head>
${renderHead(page, alternates)}
  </head>
  <body>
${indentBlock(renderHeader(page, nav), 4)}
${indentBlock(main, 4)}
${indentBlock(renderFooter(page, nav), 4)}
  </body>
</html>
`
}

/** 渲染 sitemap.xml。lastmod 取内容数据里的显式日期,绝不用当前时间——
 *  否则每次生成都脏 diff,且爬虫会因 lastmod 长期不实而忽略该字段。 */
export function renderSitemap(pages) {
  const entries = pages
    .filter((page) => page.indexable)
    .map((page) => {
      const lines = ['  <url>', `    <loc>${escXml(canonicalUrl(page))}</loc>`]
      if (page.lastModified) {
        lines.push(`    <lastmod>${escXml(page.lastModified)}</lastmod>`)
      }
      for (const alt of page.alternates || []) {
        lines.push(
          `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${escXml(absUrl(alt.path))}"/>`,
        )
      }
      lines.push('  </url>')
      return lines.join('\n')
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- 站点地图:由 scripts/build-landing.mjs 生成,请勿直接编辑。
     只收录公开落地页;登录后的应用路由(index.html 外壳)声明 noindex,不入图。 -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>
`
}
