export type CampaignStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'FINALIZED'

export type SelectionRecordStatus = 'SELECTED' | 'DROPPED'

export interface Campaign {
  id: number
  name: string
  semesterId: number
  semesterName: string
  courseId: number
  startWeek: number
  endWeek: number
  startTime: string
  endTime: string
  status: CampaignStatus
  createTime: string
  selectedCourseCount: number
  /**
   * 该活动当前绑定的选课组 ID。
   * 仅在「按组查可绑定活动」接口（fetchBindableCampaigns）的返回中填充，
   * 其它接口（fetchCampaigns / fetchCampaign）保持为 null。
   */
  boundGroupId?: number | null
}

export interface CampaignForm {
  name: string
  semesterId: number | null
  startTime?: string
  endTime?: string
  startWeek?: number
  endWeek?: number
}

export interface SelectionGroup {
  id: number
  name: string
  maxCourses: number
  courseCount: number
  boundCampaignCount: number | null
  sortOrderInCampaign: number | null
  createTime: string
}

export interface SelectionGroupForm {
  name: string
  maxCourses: number
}

export interface SelectionCourse {
  id: number
  campaignId: number
  courseId: number
  courseName: string
  courseCode: string
  credit: number
  courseHour: number | null
  description: string | null
  courseType: string | null
  allowedGradeIds: number[]
  allowedMajors: number[]
  timeRestrictionIds: number[]
  groupId: number
  groupName: string
  capacity: number
  selectedCount: number
  remaining: number
  selectedByMe: boolean
}

export interface StudentCourseGroup {
  groupId: number
  groupName: string
  groupMax: number
  selectedInGroup: number
  courses: SelectionCourse[]
}

export interface SelectionRecord {
  id: number
  campaignId: number
  selectionCourseId: number
  courseName: string
  courseCode: string
  credit: number
  courseType: string
  status: SelectionRecordStatus
  selectTime: string
  dropTime: string | null
}

export interface SelectionRecordForm {
  campaignId: number
  selectionCourseId: number
}

export interface StudentSelectionMember {
  studentId: number
  studentName: string
  studentNo: string
  className: string
}

export interface SelectionClass {
  classId: number
  selectionCourseId: number
  courseName: string
  classNo: number
  studentCount: number
  members: StudentSelectionMember[]
}
