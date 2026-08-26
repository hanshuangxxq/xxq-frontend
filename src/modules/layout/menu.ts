import type { UserType } from '@/modules/auth/types'
import perInfoSvg from '@/icons/perInfo.svg'
import courseSvg from '@/icons/course.svg'
import couSelSvg from '@/icons/couSel.svg'
import classSvg from '@/icons/class.svg'
import scoreStatisticsSvg from '@/icons/scoreStatistics.svg'
import teachingQualitySvg from '@/icons/teachingQuality.svg'
import informationSvg from '@/icons/information.svg'

/** 菜单叶子项:key 即路由路径;roles 为可见角色 */
export interface MenuLeaf {
  key: string
  labelKey: string
  roles: UserType[]
}

/** 顶部独立项(不属于任何分组):带图标 */
export interface MenuTopItem extends MenuLeaf {
  icon: string
}

/** 可折叠分组:组内无可见子项时整组隐藏;子项无图标,靠缩进区分层级 */
export interface MenuGroup {
  key: string
  labelKey: string
  icon: string
  children: MenuLeaf[]
}

const ALL_ROLES: UserType[] = ['student', 'teacher', 'department', 'academic_admin']

/** 顶部独立项 */
export const TOP_ITEMS: MenuTopItem[] = [
  { key: '/profile', labelKey: 'profile.title', icon: perInfoSvg, roles: ALL_ROLES },
  {
    key: '/curriculum',
    labelKey: 'curriculum.title',
    icon: courseSvg,
    roles: ['student', 'teacher'],
  },
  { key: '/course', labelKey: 'course.title', icon: couSelSvg, roles: ['student'] },
]

/**
 * 分组菜单。子项按角色块顺序排列,过滤后保持原有相对顺序;
 * 同一子项若多角色可见则合并到一条 roles 里。
 */
export const MENU_GROUPS: MenuGroup[] = [
  {
    key: 'teaching',
    labelKey: 'layout.groupTeaching',
    icon: classSvg,
    children: [
      {
        key: '/time-restrictions',
        labelKey: 'time-restrictions.title',
        roles: ['academic_admin', 'department'],
      },
      { key: '/teach-drafts', labelKey: 'teach-drafts.title', roles: ['department'] },
      { key: '/course-management', labelKey: 'course-management.title', roles: ['academic_admin'] },
      { key: '/class-names', labelKey: 'class-names.title', roles: ['academic_admin'] },
      { key: '/locals', labelKey: 'locals.title', roles: ['academic_admin'] },
      { key: '/scheduling', labelKey: 'scheduling.title', roles: ['academic_admin'] },
      { key: '/batch-import', labelKey: 'batch-import.title', roles: ['academic_admin'] },
      {
        key: '/student-management',
        labelKey: 'student-management.title',
        roles: ['academic_admin'],
      },
      { key: '/majors', labelKey: 'majors.title', roles: ['academic_admin'] },
      { key: '/colleges', labelKey: 'college.title', roles: ['academic_admin'] },
      { key: '/semester', labelKey: 'layout.semester', roles: ['academic_admin'] },
      { key: '/grades', labelKey: 'grades.title', roles: ['academic_admin'] },
      { key: '/selection', labelKey: 'selection.title', roles: ['academic_admin'] },
    ],
  },
  {
    key: 'score',
    labelKey: 'layout.groupScore',
    icon: scoreStatisticsSvg,
    children: [
      { key: '/my-scores', labelKey: 'score.myTitle', roles: ['student'] },
      { key: '/my-exams', labelKey: 'exam.myTitle', roles: ['student'] },
      { key: '/scores', labelKey: 'score.mgTitle', roles: ['teacher'] },
      {
        key: '/score-statistics',
        labelKey: 'score.statTitle',
        roles: ['department', 'academic_admin'],
      },
      { key: '/exams', labelKey: 'exam.mgTitle', roles: ['academic_admin'] },
      { key: '/makeup-exams', labelKey: 'exam.mkTitle', roles: ['academic_admin'] },
      {
        key: '/score-review',
        labelKey: 'score.rvTitle',
        roles: ['student', 'teacher', 'academic_admin'],
      },
    ],
  },
  {
    key: 'analysis',
    labelKey: 'layout.groupAnalysis',
    icon: teachingQualitySvg,
    children: [
      {
        key: '/analysis/warnings',
        labelKey: 'analysis.warnings',
        roles: ['student', 'department', 'academic_admin'],
      },
      {
        key: '/analysis/teacher-quality',
        labelKey: 'analysis.teacherQuality',
        roles: ['teacher', 'department', 'academic_admin'],
      },
      {
        key: '/analysis/evaluations',
        labelKey: 'analysis.evaluations',
        roles: ['student', 'academic_admin'],
      },
    ],
  },
  {
    key: 'practice',
    labelKey: 'layout.groupPractice',
    icon: informationSvg,
    children: [
      {
        key: '/practice/internship',
        labelKey: 'practice.internship.mgTitle',
        roles: ['teacher', 'department', 'academic_admin'],
      },
      {
        key: '/practice/competition',
        labelKey: 'practice.competition.mgTitle',
        roles: ['academic_admin'],
      },
      {
        key: '/practice/social-practice',
        labelKey: 'practice.socialPractice.mgTitle',
        roles: ['academic_admin'],
      },
      {
        key: '/practice/internship/my',
        labelKey: 'practice.internship.myTitle',
        roles: ['student'],
      },
      {
        key: '/practice/competition/my',
        labelKey: 'practice.competition.myTitle',
        roles: ['student'],
      },
      {
        key: '/practice/social-practice/my',
        labelKey: 'practice.socialPractice.myTitle',
        roles: ['student'],
      },
    ],
  },
  {
    key: 'graduation',
    labelKey: 'graduation.menuTitle',
    icon: courseSvg,
    children: [
      // 学生:按毕设流程顺序
      {
        key: '/practice/graduation/student/campaigns',
        labelKey: 'graduation.student.campaignsTitle',
        roles: ['student'],
      },
      {
        key: '/practice/graduation/student/proposals',
        labelKey: 'graduation.student.myProposalsTitle',
        roles: ['student'],
      },
      {
        key: '/practice/graduation/student/opening',
        labelKey: 'graduation.student.openingTitle',
        roles: ['student'],
      },
      {
        key: '/practice/graduation/student/midterm',
        labelKey: 'graduation.student.midtermTitle',
        roles: ['student'],
      },
      {
        key: '/practice/graduation/student/thesis',
        labelKey: 'graduation.student.thesisTitle',
        roles: ['student'],
      },
      {
        key: '/practice/graduation/student/defense',
        labelKey: 'graduation.student.defenseTitle',
        roles: ['student'],
      },
      {
        key: '/practice/graduation/student/score',
        labelKey: 'graduation.student.myScoreTitle',
        roles: ['student'],
      },
      // 教师
      {
        key: '/practice/graduation/teacher/pool',
        labelKey: 'graduation.teacher.poolTitle',
        roles: ['teacher'],
      },
      {
        key: '/practice/graduation/teacher/students',
        labelKey: 'graduation.teacher.myStudentsTitle',
        roles: ['teacher'],
      },
      {
        key: '/practice/graduation/teacher/opening-review',
        labelKey: 'graduation.teacher.openingReviewTitle',
        roles: ['teacher'],
      },
      {
        key: '/practice/graduation/teacher/midterm-review',
        labelKey: 'graduation.teacher.midtermReviewTitle',
        roles: ['teacher'],
      },
      {
        key: '/practice/graduation/teacher/guidance',
        labelKey: 'graduation.teacher.guidanceTitle',
        roles: ['teacher'],
      },
      {
        key: '/practice/graduation/teacher/thesis-review',
        labelKey: 'graduation.teacher.thesisReviewTitle',
        roles: ['teacher'],
      },
      {
        key: '/practice/graduation/teacher/scores',
        labelKey: 'graduation.teacher.scoreEntryTitle',
        roles: ['teacher'],
      },
      // 院系
      {
        key: '/practice/graduation/dept/proposal-review',
        labelKey: 'graduation.dept.proposalReviewTitle',
        roles: ['department'],
      },
      {
        key: '/practice/graduation/dept/allocate',
        labelKey: 'graduation.dept.allocateTitle',
        roles: ['department'],
      },
      {
        key: '/practice/graduation/dept/dashboard',
        labelKey: 'graduation.dept.dashboardTitle',
        roles: ['department'],
      },
      {
        key: '/practice/graduation/dept/defense',
        labelKey: 'graduation.dept.defenseArrangeTitle',
        roles: ['department'],
      },
      {
        key: '/practice/graduation/dept/scores',
        labelKey: 'graduation.dept.scoresPublishTitle',
        roles: ['department'],
      },
      // 教务
      {
        key: '/practice/graduation/admin/campaigns',
        labelKey: 'graduation.academic.campaignMgmtTitle',
        roles: ['academic_admin'],
      },
      {
        key: '/practice/graduation/admin/review',
        labelKey: 'graduation.academic.reviewTitle',
        roles: ['academic_admin'],
      },
      {
        key: '/practice/graduation/admin/overview',
        labelKey: 'graduation.academic.overviewTitle',
        roles: ['academic_admin'],
      },
      {
        key: '/practice/graduation/admin/dashboard',
        labelKey: 'graduation.academic.globalDashboardTitle',
        roles: ['academic_admin'],
      },
      {
        key: '/practice/graduation/admin/logs',
        labelKey: 'graduation.academic.operationLogTitle',
        roles: ['academic_admin'],
      },
      {
        key: '/practice/graduation/admin/theses',
        labelKey: 'graduation.academic.thesisMgmtTitle',
        roles: ['academic_admin'],
      },
      {
        key: '/practice/graduation/admin/scores',
        labelKey: 'graduation.academic.scoreTableTitle',
        roles: ['academic_admin'],
      },
    ],
  },
]

/** 按角色解析出可见菜单:过滤顶部项与分组子项,空分组整组隐藏 */
export function resolveMenuForRole(userType: UserType | undefined) {
  if (!userType) return { top: [] as MenuTopItem[], groups: [] as MenuGroup[] }
  const visible = (roles: UserType[]) => roles.includes(userType)
  return {
    top: TOP_ITEMS.filter((item) => visible(item.roles)),
    groups: MENU_GROUPS.map((group) => ({
      ...group,
      children: group.children.filter((child) => visible(child.roles)),
    })).filter((group) => group.children.length > 0),
  }
}

/**
 * 选中态匹配:取与当前路由精确相等或为其路径前缀(key + '/')的最长菜单 key,
 * 兼容 /selection/:id 等参数化子路由,无需逐个硬编码特判。
 */
export function matchActiveKey(path: string, keys: readonly string[]): string | undefined {
  let best: string | undefined
  for (const key of keys) {
    const matches = path === key || path.startsWith(key + '/')
    if (matches && (best === undefined || key.length > best.length)) {
      best = key
    }
  }
  return best
}
