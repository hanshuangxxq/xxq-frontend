/**
 * 课程类别（后端 CourseDto 多态标识，Jackson 按 category 字段区分子类）。
 * 与 courseType（中文描述）一一对应：REQUIRE 必修 / ELECTIVE 选修 / PRACTICE 实践 / PUBLIC 公选。
 * category 适合分支判断，courseType 适合直接展示。
 */
export type CourseCategory = 'REQUIRE' | 'ELECTIVE' | 'PRACTICE' | 'PUBLIC'

/**
 * 选课活动状态（与后端 CampaignStatus 枚举对应）。
 * 公选课（PUBLIC）课表视图内联返回，前端无需再调 selection 接口合并。
 */
export type CampaignStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'FINALIZED'

/**
 * 课表课程视图（后端 CourseDto）的公共字段。
 * 涵盖 GET /api/teach-info（list）、/api/teach-info/{id}、/api/teach-info/week-schedule 的返回。
 */
export interface TeachInfoBase {
  /** 授课安排 id（成绩录入/考试按此关联；课表视图可能不返回） */
  id?: number
  courseId?: number
  semesterId?: number
  courseName: string
  credit: number
  courseHour: number
  courseType: string
  teacherName: string
  department: string | null
  className: string
  college: string
  dayOfWeek: number
  startWeek: number
  endWeek: number
  timeId: number
  building: string
  classroom: string
}

/** 必修课 */
export interface RequiredCourseDto extends TeachInfoBase {
  category: 'REQUIRE'
}

/** 选修课 */
export interface ElectiveCourseDto extends TeachInfoBase {
  category: 'ELECTIVE'
}

/** 实践课 */
export interface PracticeCourseDto extends TeachInfoBase {
  category: 'PRACTICE'
}

/**
 * 公选课（选课活动）视图。
 * 解耦后 selection_campaign 不再冗余课程字段，统一通过 course_id 关联 course 表；
 * 课表查询时后端将选课活动信息内联到 CourseDto 返回。
 */
export interface PublicCourseDto extends TeachInfoBase {
  category: 'PUBLIC'
  /** 关联的选课活动 id */
  campaignId: number
  /** 选课活动状态 */
  campaignStatus: CampaignStatus
  /** 容量上限 */
  capacity: number
  /** 已选人数 */
  selectedCount: number
  /** 教学班号（finalize 分班后的班次） */
  classNo: number
}

/**
 * 课表课程（后端 CourseDto 多态序列化，按 category 区分子类）。
 * 按 category 收敛到对应子类型后可访问其专属字段（如公选课的选课活动信息）。
 */
export type TeachInfo = RequiredCourseDto | ElectiveCourseDto | PracticeCourseDto | PublicCourseDto

/** 学生班级课程卡片视图（无授课安排 id，仅展示用） */
export interface ClassCourse {
  courseName: string
  teacherName: string
  dayOfWeek: number
  startWeek: number
  endWeek: number
  timeId: number
  building: string
  classroom: string
}

/** 班级课程响应：携带当周周一日期（推算表头日期用）；旧版接口返回纯数组，页面已做兼容 */
export interface ClassCourseResponse {
  mondayDate: string
  courses: ClassCourse[]
}

/** 授课安排列表响应：当周周一日期 + 课程列表 */
export interface TeachInfoListResponse {
  mondayDate: string
  courses: TeachInfo[]
}

/** 周课表视图：按星期几分桶的课程列表 */
export interface WeekSchedule {
  weekNumber: number
  scheduleByDay: Record<string, TeachInfo[]>
}

/** 节次（上课时间段，如 08:00-08:45），课表行头数据源 */
export interface TimeSlot {
  id: number
  startPeriod: string
  endPeriod: string
}

/** 授课安排查询参数（全部可选，缺省查全部） */
export interface TeachInfoQuery {
  teacherId?: number
  courseId?: number
  week?: number
}

/** 创建/更新授课安排请求（排课要素 timeId/localId/dayOfWeek/周次均可选，由排课流程逐步补齐） */
export interface TeachInfoForm {
  courseId: number
  teacherId: number
  className: string
  timeId?: number
  localId?: number
  dayOfWeek?: number
  startWeek?: number
  endWeek?: number
  semesterId?: number
}

/** 创建/更新节次请求 */
export interface TimeForm {
  startPeriod: string
  endPeriod: string
}

/** 排课草稿条目（院系暂存的授课安排，提交后由后端转正式 teach-info） */
export interface TeachInfoDraft {
  courseId: number
  teacherId: number
  className: string
  startWeek?: number
  endWeek?: number
  semesterId?: number
}

export interface Teacher {
  /** teacher 表主键 */
  id: number
  /** 教师 user.id（毕业设计分配等场景使用） */
  userId: number
  name: string
  teacherNo: string
  title: string
  /** 院系名称（由 college_id 解析） */
  department: string
  /** 所属院系 id（-> college.id） */
  collegeId: number | null
}

/** 草稿按班级统计：班级列表、各班草稿条数、总条数 */
export interface DraftClassSummary {
  classes: string[]
  countByClass: Record<string, number>
  totalDrafts: number
}

/** 草稿条目视图；id 可能为 null（未落库），timeId/localId/dayOfWeek 为 null 表示尚未排定时间与地点 */
export interface DraftItem {
  id: number | null
  courseId: number
  courseName: string
  teacherId: number
  teacherName: string
  className: string
  college: string
  timeId: number | null
  localId: number | null
  dayOfWeek: number | null
  startWeek: number
  endWeek: number
  semesterId: number | null
}

/** 学期视图；status：CURRENT 当前学期 / HISTORICAL 历史学期 / FUTURE 未来学期 */
export interface Semester {
  id: number
  name: string
  startWeek: number
  endWeek: number
  startDate: string
  endDate: string
  status: 'CURRENT' | 'HISTORICAL' | 'FUTURE'
}

/** 学期创建/编辑表单（编辑场景留空的字段由页面沿用原值后再提交） */
export interface SemesterForm {
  name: string
  startWeek?: number
  endWeek?: number
  startDate?: string
  endDate?: string
  status: 'CURRENT' | 'HISTORICAL' | 'FUTURE'
}
