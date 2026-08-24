const STORAGE_KEY = 'xxq-last-visited-path'

/** 记录最近一次正常访问(非 404)的页面路径,供 404 页「返回上一页」找回来源页 */
export function rememberVisitedPath(path: string) {
  sessionStorage.setItem(STORAGE_KEY, path)
}

/** 读取本标签页最近一次正常访问的页面路径;无记录时返回 null */
export function getLastVisitedPath(): string | null {
  return sessionStorage.getItem(STORAGE_KEY)
}
