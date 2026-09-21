import type { Router } from 'vue-router'

const STORAGE_KEY = 'xxq-last-visited-path'

/** 记录最近一次正常访问(非 404/403)的页面路径,供错误页「返回上一页」找回应用内来源页 */
export function rememberVisitedPath(path: string) {
  sessionStorage.setItem(STORAGE_KEY, path)
}

/** 读取本标签页最近一次正常访问的页面路径;无记录时返回 null */
export function getLastVisitedPath(): string | null {
  return sessionStorage.getItem(STORAGE_KEY)
}

/**
 * 错误页(404/403)「返回上一页」:优先真实回退浏览器历史。
 * 从 nginx 静态落地页等应用外页面点链接进来时,浏览器历史里有上一页,
 * history.back() 能回到原页面——sessionStorage 记录不到这种站外来源;
 * 新开标签页/地址栏直达导致无上一页时,back() 不生效(popstate/pagehide 都不触发),
 * 此时回退到应用内记录的来源页,仍无记录则回首页。
 *
 * 探测依据:同文档回退(应用内上一页)触发 popstate;跨文档回退(静态落地页)
 * 当前文档收不到 popstate、但会收到 pagehide——两者任一出现都说明 back() 已生效,
 * 绝不能再兜底 push(否则会打断正在进行的回退)。
 */
export function goBackOrFallback(router: Router) {
  let navigated = false
  const markNavigated = () => {
    navigated = true
  }
  window.addEventListener('popstate', markNavigated)
  window.addEventListener('pagehide', markNavigated)
  router.back()
  // popstate/pagehide 异步触发:短暂等待确认 back() 未生效,再走兜底
  window.setTimeout(() => {
    window.removeEventListener('popstate', markNavigated)
    window.removeEventListener('pagehide', markNavigated)
    if (!navigated) {
      router.push(getLastVisitedPath() ?? '/')
    }
  }, 100)
}
