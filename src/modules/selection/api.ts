import { api } from '@/shared/api'
import type { Result } from '@/shared/types'
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
export function fetchCampaigns(): Promise<Result<Campaign[]>> {
  return api.get('/selection/campaigns')
}

export function fetchCampaign(id: number): Promise<Result<Campaign>> {
  return api.get(`/selection/campaigns/${id}`)
}

export function createCampaign(body: CampaignForm): Promise<Result<Campaign>> {
  return api.post('/selection/campaigns', body)
}

export function updateCampaign(
  id: number,
  body: Partial<CampaignForm>,
): Promise<Result<Campaign>> {
  return api.put(`/selection/campaigns/${id}`, body)
}

export function deleteCampaign(id: number): Promise<Result<null>> {
  return api.delete(`/selection/campaigns/${id}`)
}

export function openCampaign(id: number): Promise<Result<null>> {
  return api.post(`/selection/campaigns/${id}/open`)
}

export function closeCampaign(id: number): Promise<Result<null>> {
  return api.post(`/selection/campaigns/${id}/close`)
}

export function finalizeCampaign(id: number): Promise<Result<null>> {
  return api.post(`/selection/campaigns/${id}/finalize`)
}

// ---- Admin: Selection Groups (independent CRUD) ----
export function fetchAllGroups(): Promise<Result<SelectionGroup[]>> {
  return api.get('/selection/groups')
}

export function fetchGroup(groupId: number): Promise<Result<SelectionGroup>> {
  return api.get(`/selection/groups/${groupId}`)
}

export function createGroup(body: SelectionGroupForm): Promise<Result<SelectionGroup>> {
  return api.post('/selection/groups', body)
}

export function updateGroup(
  groupId: number,
  body: Partial<SelectionGroupForm>,
): Promise<Result<SelectionGroup>> {
  return api.put(`/selection/groups/${groupId}`, body)
}

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
export function fetchCampaignClasses(campaignId: number): Promise<Result<SelectionClass[]>> {
  return api.get(`/selection/campaigns/${campaignId}/classes`)
}

export function assignClassTeacher(
  campaignId: number,
  classId: number,
  teacherId: number | null,
): Promise<Result<SelectionClass>> {
  return api.put(`/selection/campaigns/${campaignId}/classes/${classId}/teacher`, { teacherId })
}

// ---- Student ----
export function fetchStudentCampaigns(): Promise<Result<StudentCampaign[]>> {
  return api.get('/selection/student/campaigns')
}

export function fetchStudentCampaign(campaignId: number): Promise<Result<StudentCampaign>> {
  return api.get(`/selection/student/campaigns/${campaignId}`)
}

export function selectCourse(body: SelectionRecordForm): Promise<Result<SelectionRecord>> {
  return api.post('/selection/student/records', body)
}

export function dropCourse(recordId: number): Promise<Result<null>> {
  return api.delete(`/selection/student/records/${recordId}`)
}

export function fetchMyRecords(campaignId: number): Promise<Result<SelectionRecord[]>> {
  return api.get(`/selection/student/records?campaignId=${campaignId}`)
}
