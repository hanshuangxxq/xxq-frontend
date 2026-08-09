import { accessToken, refreshAccessToken } from '@/shared/tokenManager'
import { API_BASE_URL } from '@/config'

type TagType = 'success' | 'info' | 'warning' | 'error' | 'default'

/** 下载实践模块文件（论文/报告），非 Result 封装，直接返回文件流。仿 score/api.ts exportScores。 */
export async function downloadPracticeFile(path: string): Promise<void> {
  const url = `${API_BASE_URL}${path}`
  const doFetch = (): Promise<Response> =>
    fetch(url, { headers: { Authorization: `Bearer ${accessToken.value}` } })

  let res = await doFetch()
  if (res.status === 401) {
    const outcome = await refreshAccessToken()
    if (outcome === 'success') res = await doFetch()
  }
  if (!res.ok) throw new Error(`下载失败: HTTP ${res.status}`)

  const blob = await res.blob()
  const disp = res.headers.get('Content-Disposition') ?? ''
  let filename = 'download'
  const match = disp.match(/filename\*=UTF-8''([^;]+)/i)
  if (match?.[1]) filename = decodeURIComponent(match[1])

  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}

/** 项目/活动状态（DRAFT/OPEN/CLOSED/ENDED 中文）-> Tag 类型 */
export function projectStatusTagType(status: string): TagType {
  switch (status) {
    case '开放':
    case '开放报名':
      return 'success'
    case '草稿':
      return 'default'
    case '关闭':
    case '报名关闭':
      return 'warning'
    case '已结束':
      return 'error'
    default:
      return 'default'
  }
}

/** 审核状态（待审核/已通过/已驳回）-> Tag 类型 */
export function auditStatusTagType(status: string): TagType {
  switch (status) {
    case '待审核':
      return 'warning'
    case '已通过':
      return 'success'
    case '已驳回':
      return 'error'
    default:
      return 'default'
  }
}

/** 论文状态 -> Tag 类型 */
export function thesisStatusTagType(status: string): TagType {
  switch (status) {
    case '通过':
      return 'success'
    case '未通过':
      return 'error'
    case '需修改':
      return 'warning'
    case '评审中':
      return 'info'
    case '已提交':
      return 'default'
    default:
      return 'default'
  }
}

/** 报告状态（已提交/已评审）-> Tag 类型 */
export function reportStatusTagType(status: string): TagType {
  switch (status) {
    case '已评审':
      return 'success'
    case '已提交':
      return 'info'
    default:
      return 'default'
  }
}

/** 培训报名状态（已报名/已取消）-> Tag 类型 */
export function enrollStatusTagType(status: string): TagType {
  switch (status) {
    case '已报名':
      return 'success'
    case '已取消':
      return 'default'
    default:
      return 'default'
  }
}

/** ISO 时间（yyyy-MM-dd'T'HH:mm:ss）-> 展示 yyyy-MM-dd HH:mm */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return '-'
  return iso.slice(0, 16).replace('T', ' ')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** DatePicker 时间戳 -> ISO yyyy-MM-dd'T'HH:mm:ss（提交后端） */
export function tsToIso(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

/** 团队成员 user.id 逗号分隔串 -> number[] */
export function parseMembers(s?: string | null): number[] {
  if (!s) return []
  return s
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
}

/** number[] -> 团队成员 user.id 逗号分隔串 */
export function joinMembers(ids: number[]): string {
  return ids.filter((n) => n > 0).join(',')
}
