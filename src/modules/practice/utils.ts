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

/** 毕设活动状态（草稿/进行中/已结束）-> Tag 类型 */
export function campaignStatusTagType(status: string): TagType {
  switch (status) {
    case '进行中':
      return 'success'
    case '草稿':
      return 'default'
    case '已结束':
      return 'info'
    default:
      return 'default'
  }
}

/** 毕设选题状态（待院系初审/待教务终审/审批完毕/已驳回）-> Tag 类型 */
export function proposalStatusTagType(status: string): TagType {
  switch (status) {
    case '待院系初审':
    case '待教务终审':
      return 'warning'
    case '审批完毕':
      return 'success'
    case '已驳回':
      return 'error'
    default:
      return 'default'
  }
}

/** 开题状态（已提交/已通过/需修改）-> Tag 类型 */
export function openingStatusTagType(status: string): TagType {
  switch (status) {
    case '已提交':
      return 'warning'
    case '已通过':
      return 'success'
    case '需修改':
      return 'error'
    default:
      return 'default'
  }
}

/** 中期结论（正常/警告/严重滞后）-> Tag 类型 */
export function midtermConclusionTagType(conclusion: string): TagType {
  switch (conclusion) {
    case '正常':
      return 'success'
    case '警告':
      return 'warning'
    case '严重滞后':
      return 'error'
    default:
      return 'default'
  }
}

/** 论文状态（待形式审查/形式审查通过/形式审查退回/查重通过/查重不通过）-> Tag 类型 */
export function thesisStatusTagType(status: string): TagType {
  switch (status) {
    case '待形式审查':
      return 'warning'
    case '形式审查通过':
      return 'info'
    case '形式审查退回':
    case '查重不通过':
      return 'error'
    case '查重通过':
      return 'success'
    default:
      return 'default'
  }
}

/** 查重结论（通过/不通过）-> Tag 类型 */
export function duplicateResultTagType(result: string): TagType {
  switch (result) {
    case '通过':
      return 'success'
    case '不通过':
      return 'error'
    default:
      return 'default'
  }
}

/** 毕设成绩状态（分项未齐备/已合成总评/已发布）-> Tag 类型 */
export function scoreStatusTagType(status: string): TagType {
  switch (status) {
    case '分项未齐备':
      return 'default'
    case '已合成总评':
      return 'info'
    case '已发布':
      return 'success'
    default:
      return 'default'
  }
}

/** 匹配来源（教师自选/院系指定）-> Tag 类型 */
export function assignmentSourceTagType(source: string): TagType {
  switch (source) {
    case '教师自选':
      return 'info'
    case '院系指定':
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

/** 附件类型校验（论文/开题/中期，F-R-10）：类型仅 doc/docx/pdf/zip/rar 且 ≤20MB；返回 'type'|'size'|null */
export function validateUploadFile(file: File): 'type' | 'size' | null {
  const allowed = ['doc', 'docx', 'pdf', 'zip', 'rar']
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!allowed.includes(ext)) return 'type'
  if (file.size > 20 * 1024 * 1024) return 'size'
  return null
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
