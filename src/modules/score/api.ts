import { api } from '@/shared/api'
import { accessToken, refreshAccessToken } from '@/shared/tokenManager'
import { API_BASE_URL } from '@/config'
import type { Result } from '@/shared/types'
import type {
  ScoreConfig,
  ScoreRosterDto,
  ScoreBatchRequest,
  ScoreEntryRequest,
  ScoreView,
  ScoreStatisticsDto,
  ScoreStatisticsQuery,
  ReviewView,
  ReviewApplyRequest,
  ReviewReplyRequest,
  ReviewResolveRequest,
  ReviewStatusCode,
} from './types'

// ---- 平时分占比配置 ----

export function getScoreConfig(teachInfoId: number): Promise<Result<ScoreConfig | null>> {
  return api.get(`/scores/config/${teachInfoId}`)
}

export function setScoreConfig(
  teachInfoId: number,
  regularRatio: number,
): Promise<Result<ScoreConfig>> {
  return api.put(`/scores/config/${teachInfoId}`, { regularRatio })
}

// ---- 录入名单 ----

export function fetchRoster(teachInfoId: number, examId?: number): Promise<Result<ScoreRosterDto[]>> {
  const qs = examId != null ? `?examId=${examId}` : ''
  return api.get(`/scores/roster/${teachInfoId}${qs}`)
}

// ---- 录入 / 修改 ----

export function batchCreateScores(body: ScoreBatchRequest): Promise<Result<ScoreView[]>> {
  return api.post('/scores', body)
}

export function updateScore(id: number, body: ScoreEntryRequest): Promise<Result<ScoreView>> {
  return api.put(`/scores/${id}`, body)
}

// ---- 查询 ----

export function fetchScoresByTeachInfo(teachInfoId: number): Promise<Result<ScoreView[]>> {
  return api.get(`/scores?teachInfoId=${teachInfoId}`)
}

export function fetchMyScores(semesterId?: number): Promise<Result<ScoreView[]>> {
  const qs = semesterId != null ? `?semesterId=${semesterId}` : ''
  return api.get(`/scores/my${qs}`)
}

// ---- 统计 ----

export function fetchScoreStatistics(
  query?: ScoreStatisticsQuery,
): Promise<Result<ScoreStatisticsDto[]>> {
  const params = new URLSearchParams()
  if (query?.courseId != null) params.set('courseId', String(query.courseId))
  if (query?.className) params.set('className', query.className)
  if (query?.semesterId != null) params.set('semesterId', String(query.semesterId))
  const qs = params.toString()
  return api.get(`/scores/statistics${qs ? `?${qs}` : ''}`)
}

// ---- 导出（二进制文件流，非 Result 封装，绕过 api 封装） ----

export async function exportScores(teachInfoId: number, format: 'excel' | 'pdf'): Promise<void> {
  const url = `${API_BASE_URL}/scores/export?teachInfoId=${teachInfoId}&format=${format}`
  const doFetch = (): Promise<Response> =>
    fetch(url, { headers: { Authorization: `Bearer ${accessToken.value}` } })

  let res = await doFetch()
  if (res.status === 401) {
    const outcome = await refreshAccessToken()
    if (outcome === 'success') res = await doFetch()
  }
  if (!res.ok) throw new Error(`导出失败: HTTP ${res.status}`)

  const blob = await res.blob()
  const disp = res.headers.get('Content-Disposition') ?? ''
  let filename = `scores.${format === 'excel' ? 'xlsx' : 'pdf'}`
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

// ---- 成绩复核 ----

export function applyReview(body: ReviewApplyRequest): Promise<Result<ReviewView>> {
  return api.post('/scores/reviews', body)
}

export function fetchMyReviews(): Promise<Result<ReviewView[]>> {
  return api.get('/scores/reviews/my')
}

export function fetchReviewTodos(status?: ReviewStatusCode): Promise<Result<ReviewView[]>> {
  const qs = status ? `?status=${status}` : ''
  return api.get(`/scores/reviews${qs}`)
}

export function replyReview(id: number, body: ReviewReplyRequest): Promise<Result<ReviewView>> {
  return api.post(`/scores/reviews/${id}/reply`, body)
}

export function escalateReview(id: number): Promise<Result<null>> {
  return api.post(`/scores/reviews/${id}/escalate`)
}

export function resolveReview(id: number, body: ReviewResolveRequest): Promise<Result<ReviewView>> {
  return api.post(`/scores/reviews/${id}/resolve`, body)
}
