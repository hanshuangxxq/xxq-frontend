import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type {
  Campaign,
  CampaignForm,
  SelectionClass,
  SelectionGroup,
  SelectionGroupForm,
  SelectionRecord,
  SelectionRecordForm,
  StudentCampaign,
} from './types'

// ---- Admin: Campaign ----
/** 分页查询选课活动列表（管理端） GET /selection/campaigns */
export function fetchCampaigns(
  page?: number,
  pageSize?: number,
): Promise<Result<PageResult<Campaign>>> {
  const params = new URLSearchParams()
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  const qs = params.toString()
  return api.get(`/selection/campaigns${qs ? `?${qs}` : ''}`)
}

/** 查询选课活动详情 GET /selection/campaigns/{id} */
export function fetchCampaign(id: number): Promise<Result<Campaign>> {
  return api.get(`/selection/campaigns/${id}`)
}

/** 创建选课活动 POST /selection/campaigns */
export function createCampaign(body: CampaignForm): Promise<Result<Campaign>> {
  return api.post('/selection/campaigns', body)
}

/** 更新选课活动（groupId 绑定/换绑、unbindGroup 解绑亦走本接口） PUT /selection/campaigns/{id} */
export function updateCampaign(id: number, body: Partial<CampaignForm>): Promise<Result<Campaign>> {
  return api.put(`/selection/campaigns/${id}`, body)
}

/** 删除选课活动（页面限定草稿态才可删除） DELETE /selection/campaigns/{id} */
export function deleteCampaign(id: number): Promise<Result<null>> {
  return api.delete(`/selection/campaigns/${id}`)
}

/** 开启选课（草稿 -> 开放） POST /selection/campaigns/{id}/open */
export function openCampaign(id: number): Promise<Result<null>> {
  return api.post(`/selection/campaigns/${id}/open`)
}

/** 关闭选课（开放 -> 关闭，学生不可再选退） POST /selection/campaigns/{id}/close */
export function closeCampaign(id: number): Promise<Result<null>> {
  return api.post(`/selection/campaigns/${id}/close`)
}

/** 结束选课：归档并生成选课结果（分班名单） POST /selection/campaigns/{id}/finalize */
export function finalizeCampaign(id: number): Promise<Result<null>> {
  return api.post(`/selection/campaigns/${id}/finalize`)
}

// ---- Admin: Selection Groups (independent CRUD) ----
/** 分页查询选课组列表 GET /selection/groups */
export function fetchAllGroups(
  page?: number,
  pageSize?: number,
): Promise<Result<PageResult<SelectionGroup>>> {
  const params = new URLSearchParams()
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  const qs = params.toString()
  return api.get(`/selection/groups${qs ? `?${qs}` : ''}`)
}

/** 查询选课组详情 GET /selection/groups/{groupId} */
export function fetchGroup(groupId: number): Promise<Result<SelectionGroup>> {
  return api.get(`/selection/groups/${groupId}`)
}

/** 创建选课组 POST /selection/groups */
export function createGroup(body: SelectionGroupForm): Promise<Result<SelectionGroup>> {
  return api.post('/selection/groups', body)
}

/** 更新选课组 PUT /selection/groups/{groupId} */
export function updateGroup(
  groupId: number,
  body: Partial<SelectionGroupForm>,
): Promise<Result<SelectionGroup>> {
  return api.put(`/selection/groups/${groupId}`, body)
}

/** 删除选课组（有活动绑定时入口已禁用，后端仍会校验） DELETE /selection/groups/{groupId} */
export function deleteGroup(groupId: number): Promise<Result<null>> {
  return api.delete(`/selection/groups/${groupId}`)
}

// ---- Admin: Campaign <-> Group binding ----
/**
 * 列出可绑定到指定选课组的选课活动。
 * 后端会排除已绑定到其它选课组的活动，仅返回：
 *   - 未绑定任何组的活动（boundGroupId 为 null）
 *   - 已绑定到本组的活动（boundGroupId === groupId）
 *
 * 绑定/换绑通过 createCampaign / updateCampaign 携带 groupId 字段完成，
 * 独立的绑定/解绑接口已废弃。
 */
export function fetchBindableCampaigns(groupId: number): Promise<Result<Campaign[]>> {
  return api.get(`/selection/groups/${groupId}/bindable-campaigns`)
}

// ---- Admin: Class Results ----
/** 查询活动结束后的选课结果班级（含成员名单） GET /selection/campaigns/{campaignId}/classes */
export function fetchCampaignClasses(campaignId: number): Promise<Result<SelectionClass[]>> {
  return api.get(`/selection/campaigns/${campaignId}/classes`)
}

/** 为选课结果班级分配/更换授课教师（teacherId 传 null 表示取消分配） PUT /selection/campaigns/{campaignId}/classes/{classId}/teacher */
export function assignClassTeacher(
  campaignId: number,
  classId: number,
  teacherId: number | null,
): Promise<Result<SelectionClass>> {
  return api.put(`/selection/campaigns/${campaignId}/classes/${classId}/teacher`, { teacherId })
}

// ---- Student ----
/** 学生端可参与的选课活动列表（仅开放中的活动） GET /selection/student/campaigns */
export function fetchStudentCampaigns(): Promise<Result<StudentCampaign[]>> {
  return api.get('/selection/student/campaigns')
}

/** 学生端单个选课活动详情 GET /selection/student/campaigns/{campaignId} */
export function fetchStudentCampaign(campaignId: number): Promise<Result<StudentCampaign>> {
  return api.get(`/selection/student/campaigns/${campaignId}`)
}

/** 学生选课 POST /selection/student/records */
export function selectCourse(body: SelectionRecordForm): Promise<Result<SelectionRecord>> {
  return api.post('/selection/student/records', body)
}

/** 学生退课 DELETE /selection/student/records/{recordId} */
export function dropCourse(recordId: number): Promise<Result<null>> {
  return api.delete(`/selection/student/records/${recordId}`)
}

/** 查询本人在指定活动下的选课记录 GET /selection/student/records */
export function fetchMyRecords(campaignId: number): Promise<Result<SelectionRecord[]>> {
  return api.get(`/selection/student/records?campaignId=${campaignId}`)
}
