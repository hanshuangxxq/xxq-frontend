import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type { Semester } from '@/modules/curriculum/types'
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

/** 查询平时占比配置（未配置时返回 null，前端按默认 30% 兜底） GET /scores/config/{teachInfoId} */
export function getScoreConfig(teachInfoId: number): Promise<Result<ScoreConfig | null>> {
  return api.get(`/scores/config/${teachInfoId}`)
}

/** 保存平时占比配置 PUT /scores/config/{teachInfoId} */
export function setScoreConfig(
  teachInfoId: number,
  regularRatio: number,
): Promise<Result<ScoreConfig>> {
  return api.put(`/scores/config/${teachInfoId}`, { regularRatio })
}

// ---- 录入名单 ----

/** 拉取录入名单（传 examId 时仅返回该考试排考班级的学生） GET /scores/roster/{teachInfoId} */
export function fetchRoster(
  teachInfoId: number,
  examId?: number,
): Promise<Result<ScoreRosterDto[]>> {
  const qs = examId != null ? `?examId=${examId}` : ''
  return api.get(`/scores/roster/${teachInfoId}${qs}`)
}

// ---- 录入 / 修改 ----

/** 批量录入成绩 POST /scores */
export function batchCreateScores(body: ScoreBatchRequest): Promise<Result<ScoreView[]>> {
  return api.post('/scores', body)
}

/** 修改单条成绩 PUT /scores/{id} */
export function updateScore(id: number, body: ScoreEntryRequest): Promise<Result<ScoreView>> {
  return api.put(`/scores/${id}`, body)
}

// ---- 查询 ----

/** 按授课安排查询已录成绩（录入页预填用） GET /scores */
export function fetchScoresByTeachInfo(teachInfoId: number): Promise<Result<ScoreView[]>> {
  return api.get(`/scores?teachInfoId=${teachInfoId}`)
}

/** 学生查询本人成绩（不传 semesterId 时后端返回当前学期） GET /scores/my */
export function fetchMyScores(semesterId?: number): Promise<Result<ScoreView[]>> {
  const qs = semesterId != null ? `?semesterId=${semesterId}` : ''
  return api.get(`/scores/my${qs}`)
}

/** 查询本人有成绩的学期列表（学期切换下拉用） GET /scores/my/semesters */
export function fetchMyScoreSemesters(): Promise<Result<Semester[]>> {
  // 仅返回该学生有成绩的学期，用于学期切换下拉
  return api.get('/scores/my/semesters')
}

// ---- 统计 ----

/** 成绩统计按课程聚合（公选课须传 source=SELECTION_CAMPAIGN） GET /scores/statistics */
export function fetchScoreStatistics(
  query?: ScoreStatisticsQuery,
): Promise<Result<ScoreStatisticsDto[]>> {
  const params = new URLSearchParams()
  if (query?.courseId != null) params.set('courseId', String(query.courseId))
  if (query?.source) params.set('source', query.source)
  if (query?.className) params.set('className', query.className)
  if (query?.semesterId != null) params.set('semesterId', String(query.semesterId))
  const qs = params.toString()
  return api.get(`/scores/statistics${qs ? `?${qs}` : ''}`)
}

// ---- 导出（二进制文件流，非 Result 封装，走 api.download） ----

/** 导出成绩 excel/pdf（二进制文件流走 api.download，非 Result 封装） GET /scores/export */
export function exportScores(teachInfoId: number, format: 'excel' | 'pdf'): Promise<void> {
  return api.download(`/scores/export?teachInfoId=${teachInfoId}&format=${format}`, {
    fallbackName: `scores.${format === 'excel' ? 'xlsx' : 'pdf'}`,
  })
}

// ---- 成绩复核 ----

/** 学生提交成绩复核申请 POST /scores/reviews */
export function applyReview(body: ReviewApplyRequest): Promise<Result<ReviewView>> {
  return api.post('/scores/reviews', body)
}

/** 学生查询本人复核申请记录 GET /scores/reviews/my */
export function fetchMyReviews(): Promise<Result<ReviewView[]>> {
  return api.get('/scores/reviews/my')
}

/** 教师/教务复核待办列表（分页返回 PageResult，状态计数需全集时配合 fetchAllPages 拉全量） GET /scores/reviews */
export function fetchReviewTodos(
  status?: ReviewStatusCode,
  page?: number,
  pageSize?: number,
): Promise<Result<PageResult<ReviewView>>> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  const qs = params.toString()
  return api.get(`/scores/reviews${qs ? `?${qs}` : ''}`)
}

/** 教师回复复核（可附带更正总评） POST /scores/reviews/{id}/reply */
export function replyReview(id: number, body: ReviewReplyRequest): Promise<Result<ReviewView>> {
  return api.post(`/scores/reviews/${id}/reply`, body)
}

/** 学生对教师回复不满意时升级至教务处理 POST /scores/reviews/{id}/escalate */
export function escalateReview(id: number): Promise<Result<null>> {
  return api.post(`/scores/reviews/${id}/escalate`)
}

/** 教务终审（resolved=true 解决 / false 驳回，可更正总评） POST /scores/reviews/{id}/resolve */
export function resolveReview(id: number, body: ReviewResolveRequest): Promise<Result<ReviewView>> {
  return api.post(`/scores/reviews/${id}/resolve`, body)
}
