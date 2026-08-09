import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type {
  StudentProfileDto,
  WarningConfigDto,
  WarningConfigRequest,
  WarningScanResultDto,
  WarningItemDto,
  WarningQuery,
  EvaluationItemDto,
  EvaluationItemRequest,
  EvaluationItemUpdateRequest,
  EvaluationTemplateDto,
  EvaluationTemplateRequest,
  EvaluationTemplateUpdateRequest,
  EvaluationFormDto,
  EvaluationSubmitRequest,
  TeachingEvaluationView,
  EvaluationStatusDto,
  TemplateStatusCode,
  TeacherQualityDto,
  LearningProgressDto,
} from './types'

const BASE = '/analysis'
const ITEMS = '/analysis/evaluation-items'
const TEMPLATES = '/analysis/evaluation-templates'

// ---- #1 学生个人画像（学生自查，融入「我的成绩」） ----

export function getMyProfile(): Promise<Result<StudentProfileDto>> {
  return api.get(`${BASE}/profile/me`)
}

// ---- #2 学业预警 ----

export function getWarningConfig(): Promise<Result<WarningConfigDto[]>> {
  return api.get(`${BASE}/warnings/config`)
}

export function updateWarningConfig(body: WarningConfigRequest): Promise<Result<null>> {
  return api.put(`${BASE}/warnings/config`, body)
}

export function scanWarnings(): Promise<Result<WarningScanResultDto>> {
  return api.post(`${BASE}/warnings/scan`)
}

export function fetchWarnings(query?: WarningQuery): Promise<Result<PageResult<WarningItemDto>>> {
  const params = new URLSearchParams()
  if (query?.semesterId != null) params.set('semesterId', String(query.semesterId))
  if (query?.level) params.set('level', query.level)
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/warnings${qs ? `?${qs}` : ''}`)
}

export function fetchMyWarnings(): Promise<Result<WarningItemDto[]>> {
  return api.get(`${BASE}/warnings/me`)
}

// ---- #3 评教指标库（教务） ----

export function createEvaluationItem(
  body: EvaluationItemRequest,
): Promise<Result<EvaluationItemDto>> {
  return api.post(ITEMS, body)
}

export function fetchEvaluationItems(): Promise<Result<EvaluationItemDto[]>> {
  return api.get(ITEMS)
}

export function updateEvaluationItem(
  id: number,
  body: EvaluationItemUpdateRequest,
): Promise<Result<EvaluationItemDto>> {
  return api.put(`${ITEMS}/${id}`, body)
}

export function deleteEvaluationItem(id: number): Promise<Result<null>> {
  return api.delete(`${ITEMS}/${id}`)
}

// ---- #3 评教模板（教务） ----

export function createEvaluationTemplate(
  body: EvaluationTemplateRequest,
): Promise<Result<EvaluationTemplateDto>> {
  return api.post(TEMPLATES, body)
}

export function fetchEvaluationTemplates(): Promise<Result<EvaluationTemplateDto[]>> {
  return api.get(TEMPLATES)
}

export function fetchEvaluationTemplate(id: number): Promise<Result<EvaluationTemplateDto>> {
  return api.get(`${TEMPLATES}/${id}`)
}

export function updateEvaluationTemplate(
  id: number,
  body: EvaluationTemplateUpdateRequest,
): Promise<Result<EvaluationTemplateDto>> {
  return api.put(`${TEMPLATES}/${id}`, body)
}

export function deleteEvaluationTemplate(id: number): Promise<Result<null>> {
  return api.delete(`${TEMPLATES}/${id}`)
}

/** 设为全局默认（原默认自动置普通，互斥） */
export function setDefaultEvaluationTemplate(id: number): Promise<Result<EvaluationTemplateDto>> {
  return api.put(`${TEMPLATES}/${id}/default`)
}

/** 启用/停用模板，status 取值 ENABLED / DISABLED */
export function updateEvaluationTemplateStatus(
  id: number,
  status: TemplateStatusCode,
): Promise<Result<EvaluationTemplateDto>> {
  return api.put(`${TEMPLATES}/${id}/status?status=${status}`)
}

/** 设置课程级覆盖（templateId=null 清除覆盖，回退全局默认） */
export function setEvaluationOverride(
  teachInfoId: number,
  body: { templateId: number | null },
): Promise<Result<null>> {
  return api.put(`${TEMPLATES}/override/${teachInfoId}`, body)
}

/** 查询课程级覆盖（未设置时 data 为 null，表示走全局默认） */
export function fetchEvaluationOverride(
  teachInfoId: number,
): Promise<Result<EvaluationTemplateDto | null>> {
  return api.get(`${TEMPLATES}/override/${teachInfoId}`)
}

// ---- #3 评教（学生 / 教务） ----

/** 取评教表单（解析课程覆盖优先，否则全局默认） */
export function fetchEvaluationForm(teachInfoId: number): Promise<Result<EvaluationFormDto>> {
  return api.get(`${BASE}/evaluations/form?teachInfoId=${teachInfoId}`)
}

export function submitEvaluation(
  body: EvaluationSubmitRequest,
): Promise<Result<TeachingEvaluationView>> {
  return api.post(`${BASE}/evaluations`, body)
}

export function fetchMyEvaluations(): Promise<Result<TeachingEvaluationView[]>> {
  return api.get(`${BASE}/evaluations/my`)
}

// ---- 评教周期（教务统一触发） ----

export function fetchEvaluationPeriod(): Promise<Result<EvaluationStatusDto>> {
  return api.get(`${BASE}/evaluations/period`)
}

export function openEvaluationPeriod(): Promise<Result<EvaluationStatusDto>> {
  return api.post(`${BASE}/evaluations/period/open`)
}

export function closeEvaluationPeriod(): Promise<Result<EvaluationStatusDto>> {
  return api.post(`${BASE}/evaluations/period/close`)
}

export function getMyTeacherQuality(semesterId?: number): Promise<Result<TeacherQualityDto>> {
  const qs = semesterId != null ? `?semesterId=${semesterId}` : ''
  return api.get(`${BASE}/teacher-quality/me${qs}`)
}

export function getTeacherQuality(
  teacherId: number,
  semesterId?: number,
): Promise<Result<TeacherQualityDto>> {
  const params = new URLSearchParams()
  if (semesterId != null) params.set('semesterId', String(semesterId))
  const qs = params.toString()
  return api.get(`${BASE}/teacher-quality/${teacherId}${qs ? `?${qs}` : ''}`)
}

export function fetchTeacherQualityList(
  semesterId?: number,
  page?: number,
  pageSize?: number,
): Promise<Result<PageResult<TeacherQualityDto>>> {
  const params = new URLSearchParams()
  if (semesterId != null) params.set('semesterId', String(semesterId))
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/teacher-quality${qs ? `?${qs}` : ''}`)
}

// ---- #6 学习进度（学生自查，融入「课表」） ----

export function getMyProgress(): Promise<Result<LearningProgressDto>> {
  return api.get(`${BASE}/progress/me`)
}
