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

// 模块接口路径前缀（BASE 为通用分析端点，ITEMS/TEMPLATES 为评教子资源）
const BASE = '/analysis'
const ITEMS = '/analysis/evaluation-items'
const TEMPLATES = '/analysis/evaluation-templates'

// ---- #1 学生个人画像（学生自查，融入「我的成绩」） ----

/** 查询当前学生个人画像（GPA、学分、班级排名、科目明细） GET /analysis/profile/me */
export function getMyProfile(): Promise<Result<StudentProfileDto>> {
  return api.get(`${BASE}/profile/me`)
}

// ---- #2 学业预警 ----

/** 查询三级预警阈值配置 GET /analysis/warnings/config */
export function getWarningConfig(): Promise<Result<WarningConfigDto[]>> {
  return api.get(`${BASE}/warnings/config`)
}

/** 整体保存预警阈值配置（三级阈值一并提交） PUT /analysis/warnings/config */
export function updateWarningConfig(body: WarningConfigRequest): Promise<Result<null>> {
  return api.put(`${BASE}/warnings/config`, body)
}

/** 手动触发一次全量预警扫描（新生成预警、解除已达标预警） POST /analysis/warnings/scan */
export function scanWarnings(): Promise<Result<WarningScanResultDto>> {
  return api.post(`${BASE}/warnings/scan`)
}

/** 分页查询预警名单（教务/院系看板用） GET /analysis/warnings,返回 PageResult */
export function fetchWarnings(query?: WarningQuery): Promise<Result<PageResult<WarningItemDto>>> {
  const params = new URLSearchParams()
  if (query?.semesterId != null) params.set('semesterId', String(query.semesterId))
  if (query?.level) params.set('level', query.level)
  if (query?.page != null) params.set('page', String(query.page))
  if (query?.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return api.get(`${BASE}/warnings${qs ? `?${qs}` : ''}`)
}

/** 查询本人预警记录（学生自查） GET /analysis/warnings/me */
export function fetchMyWarnings(): Promise<Result<WarningItemDto[]>> {
  return api.get(`${BASE}/warnings/me`)
}

// ---- #3 评教指标库（教务） ----

/** 新建评教指标 POST /analysis/evaluation-items */
export function createEvaluationItem(
  body: EvaluationItemRequest,
): Promise<Result<EvaluationItemDto>> {
  return api.post(ITEMS, body)
}

/** 查询全部评教指标 GET /analysis/evaluation-items */
export function fetchEvaluationItems(): Promise<Result<EvaluationItemDto[]>> {
  return api.get(ITEMS)
}

/** 更新评教指标（字段均可选，传谁改谁） PUT /analysis/evaluation-items/{id} */
export function updateEvaluationItem(
  id: number,
  body: EvaluationItemUpdateRequest,
): Promise<Result<EvaluationItemDto>> {
  return api.put(`${ITEMS}/${id}`, body)
}

/** 删除评教指标 DELETE /analysis/evaluation-items/{id} */
export function deleteEvaluationItem(id: number): Promise<Result<null>> {
  return api.delete(`${ITEMS}/${id}`)
}

// ---- #3 评教模板（教务） ----

/** 新建评教模板（含指标关联列表） POST /analysis/evaluation-templates */
export function createEvaluationTemplate(
  body: EvaluationTemplateRequest,
): Promise<Result<EvaluationTemplateDto>> {
  return api.post(TEMPLATES, body)
}

/** 查询全部评教模板 GET /analysis/evaluation-templates */
export function fetchEvaluationTemplates(): Promise<Result<EvaluationTemplateDto[]>> {
  return api.get(TEMPLATES)
}

/** 查询单个评教模板详情 GET /analysis/evaluation-templates/{id} */
export function fetchEvaluationTemplate(id: number): Promise<Result<EvaluationTemplateDto>> {
  return api.get(`${TEMPLATES}/${id}`)
}

/** 更新评教模板（items 传入则整体替换） PUT /analysis/evaluation-templates/{id} */
export function updateEvaluationTemplate(
  id: number,
  body: EvaluationTemplateUpdateRequest,
): Promise<Result<EvaluationTemplateDto>> {
  return api.put(`${TEMPLATES}/${id}`, body)
}

/** 删除评教模板 DELETE /analysis/evaluation-templates/{id} */
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

/** 学生提交对某门授课的评教（按当前生效模板逐项打分） POST /analysis/evaluations */
export function submitEvaluation(
  body: EvaluationSubmitRequest,
): Promise<Result<TeachingEvaluationView>> {
  return api.post(`${BASE}/evaluations`, body)
}

/** 查询我的历史评教记录 GET /analysis/evaluations/my */
export function fetchMyEvaluations(): Promise<Result<TeachingEvaluationView[]>> {
  return api.get(`${BASE}/evaluations/my`)
}

// ---- 评教周期（教务统一触发） ----

/** 查询当前评教周期状态（是否开放、提示文案、起止时间） GET /analysis/evaluations/period */
export function fetchEvaluationPeriod(): Promise<Result<EvaluationStatusDto>> {
  return api.get(`${BASE}/evaluations/period`)
}

/** 开放评教周期（教务统一触发，面向当前学期） POST /analysis/evaluations/period/open */
export function openEvaluationPeriod(): Promise<Result<EvaluationStatusDto>> {
  return api.post(`${BASE}/evaluations/period/open`)
}

/** 关闭评教周期 POST /analysis/evaluations/period/close */
export function closeEvaluationPeriod(): Promise<Result<EvaluationStatusDto>> {
  return api.post(`${BASE}/evaluations/period/close`)
}

/** 查询本人教学质量统计（教师自查，可按学期过滤） GET /analysis/teacher-quality/me */
export function getMyTeacherQuality(semesterId?: number): Promise<Result<TeacherQualityDto>> {
  const qs = semesterId != null ? `?semesterId=${semesterId}` : ''
  return api.get(`${BASE}/teacher-quality/me${qs}`)
}

/** 查询指定教师的教学质量统计 GET /analysis/teacher-quality/{teacherId} */
export function getTeacherQuality(
  teacherId: number,
  semesterId?: number,
): Promise<Result<TeacherQualityDto>> {
  const params = new URLSearchParams()
  if (semesterId != null) params.set('semesterId', String(semesterId))
  const qs = params.toString()
  return api.get(`${BASE}/teacher-quality/${teacherId}${qs ? `?${qs}` : ''}`)
}

/** 分页查询教师教学质量列表 GET /analysis/teacher-quality,返回 PageResult */
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

/** 查询本人学习进度（课程完成度、成绩录入状态，融入课表页） GET /analysis/progress/me */
export function getMyProgress(): Promise<Result<LearningProgressDto>> {
  return api.get(`${BASE}/progress/me`)
}
