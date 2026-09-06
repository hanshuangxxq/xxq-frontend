import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import authRoutes from '@/modules/auth/router'
import { useAuthStore } from '@/stores/useAuthStore'
import { rememberVisitedPath } from '@/shared/utils/lastVisitedPage'
import MainLayout from '@/modules/layout/MainLayout.vue'

const WHITELIST = ['/login']

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    children: [
      // 默认首页:所有角色登录后统一进入个人信息页
      { path: '', redirect: '/profile' },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/modules/auth/pages/ProfilePage.vue'),
        meta: { titleKey: 'profile.title' },
      },
      {
        path: 'course',
        name: 'CourseSelection',
        component: () => import('@/modules/selection/pages/StudentSelectionPage.vue'),
        meta: { titleKey: 'course.title', roles: ['student'] },
      },
      {
        path: 'selection',
        name: 'SelectionCampaigns',
        component: () => import('@/modules/selection/pages/CampaignManagementPage.vue'),
        meta: { titleKey: 'selection.title', roles: ['academic_admin'] },
      },
      {
        path: 'selection/:id',
        name: 'SelectionCampaignDetail',
        component: () => import('@/modules/selection/pages/CampaignDetailPage.vue'),
        meta: { titleKey: 'selection.detailTitle', roles: ['academic_admin'] },
      },
      {
        path: 'curriculum',
        name: 'Curriculum',
        component: () => import('@/modules/curriculum/pages/CurriculumPage.vue'),
        meta: { titleKey: 'curriculum.title', roles: ['student', 'teacher'] },
      },
      {
        path: 'time-restrictions',
        name: 'TimeRestrictions',
        component: () => import('@/modules/time-restrictions/pages/TimeRestrictionsPage.vue'),
        meta: { titleKey: 'time-restrictions.title', roles: ['academic_admin', 'department'] },
      },
      {
        path: 'scheduling',
        name: 'Scheduling',
        component: () => import('@/modules/scheduling/pages/SchedulingPage.vue'),
        meta: { titleKey: 'scheduling.title', roles: ['academic_admin'] },
      },
      {
        path: 'course-management',
        name: 'CourseManagement',
        component: () => import('@/modules/course/pages/CourseManagementPage.vue'),
        meta: { titleKey: 'course-management.title', roles: ['academic_admin'] },
      },
      {
        path: 'class-names',
        name: 'ClassNameManagement',
        component: () => import('@/modules/class-names/pages/ClassNameManagementPage.vue'),
        meta: { titleKey: 'class-names.title', roles: ['academic_admin'] },
      },
      {
        path: 'locals',
        name: 'LocalManagement',
        component: () => import('@/modules/locals/pages/LocalManagementPage.vue'),
        meta: { titleKey: 'locals.title', roles: ['academic_admin'] },
      },
      {
        path: 'teach-drafts',
        name: 'TeachDrafts',
        component: () => import('@/modules/curriculum/pages/DraftManagementPage.vue'),
        meta: { titleKey: 'teach-drafts.title', roles: ['department'] },
      },
      {
        path: 'batch-import',
        name: 'BatchImport',
        component: () => import('@/modules/batch-import/pages/BatchImportPage.vue'),
        meta: { titleKey: 'batch-import.title', roles: ['academic_admin'] },
      },
      {
        path: 'student-management',
        name: 'StudentManagement',
        component: () => import('@/modules/student-management/pages/StudentManagementPage.vue'),
        meta: { titleKey: 'student-management.title', roles: ['academic_admin'] },
      },
      {
        path: 'majors',
        name: 'MajorManagement',
        component: () => import('@/modules/majors/pages/MajorManagementPage.vue'),
        meta: { titleKey: 'majors.title', roles: ['academic_admin'] },
      },
      {
        path: 'semester',
        name: 'SemesterManagement',
        component: () => import('@/modules/curriculum/pages/SemesterManagementPage.vue'),
        meta: { titleKey: 'layout.semester', roles: ['academic_admin'] },
      },
      {
        path: 'grades',
        name: 'GradeManagement',
        component: () => import('@/modules/grades/pages/GradeManagementPage.vue'),
        meta: { titleKey: 'grades.title', roles: ['academic_admin'] },
      },
      {
        path: 'scores',
        name: 'ScoreManagement',
        component: () => import('@/modules/score/pages/ScoreManagementPage.vue'),
        meta: { titleKey: 'score.mgTitle', roles: ['teacher'] },
      },
      {
        path: 'score-statistics',
        name: 'ScoreStatistics',
        component: () => import('@/modules/score/pages/ScoreStatisticsPage.vue'),
        meta: { titleKey: 'score.statTitle', roles: ['department', 'academic_admin'] },
      },
      {
        path: 'my-scores',
        name: 'MyScores',
        component: () => import('@/modules/score/pages/MyScoresPage.vue'),
        meta: { titleKey: 'score.myTitle', roles: ['student'] },
      },
      {
        path: 'score-review',
        name: 'ScoreReview',
        component: () => import('@/modules/score/pages/ScoreReviewPage.vue'),
        meta: { titleKey: 'score.rvTitle', roles: ['student', 'teacher', 'academic_admin'] },
      },
      {
        path: 'exams',
        name: 'ExamManagement',
        component: () => import('@/modules/exam/pages/ExamManagementPage.vue'),
        meta: { titleKey: 'exam.mgTitle', roles: ['academic_admin'] },
      },
      {
        path: 'makeup-exams',
        name: 'MakeupExams',
        component: () => import('@/modules/exam/pages/MakeupExamPage.vue'),
        meta: { titleKey: 'exam.mkTitle', roles: ['academic_admin'] },
      },
      {
        path: 'my-exams',
        name: 'MyExams',
        component: () => import('@/modules/exam/pages/MyExamsPage.vue'),
        meta: { titleKey: 'exam.myTitle', roles: ['student'] },
      },
      {
        path: 'analysis/warnings',
        name: 'AnalysisWarnings',
        component: () => import('@/modules/analysis/pages/WarningPage.vue'),
        meta: { titleKey: 'analysis.warnings', roles: ['student', 'department', 'academic_admin'] },
      },
      {
        path: 'analysis/evaluations',
        name: 'AnalysisEvaluations',
        component: () => import('@/modules/analysis/pages/EvaluationPage.vue'),
        meta: { titleKey: 'analysis.evaluations', roles: ['student', 'academic_admin'] },
      },
      {
        path: 'analysis/teacher-quality',
        name: 'AnalysisTeacherQuality',
        component: () => import('@/modules/analysis/pages/TeacherQualityPage.vue'),
        meta: {
          titleKey: 'analysis.teacherQuality',
          roles: ['teacher', 'department', 'academic_admin'],
        },
      },
      {
        path: 'practice/internship',
        name: 'PracticeInternship',
        component: () => import('@/modules/practice/pages/InternshipManagementPage.vue'),
        meta: { titleKey: 'practice.internship.mgTitle', roles: ['department', 'academic_admin'] },
      },
      {
        path: 'practice/internship/my',
        name: 'PracticeInternshipMy',
        component: () => import('@/modules/practice/pages/InternshipStudentPage.vue'),
        meta: { titleKey: 'practice.internship.myTitle', roles: ['student'] },
      },
      {
        path: 'practice/competition',
        name: 'PracticeCompetition',
        component: () => import('@/modules/practice/pages/CompetitionManagementPage.vue'),
        meta: { titleKey: 'practice.competition.mgTitle', roles: ['academic_admin'] },
      },
      {
        path: 'practice/competition/my',
        name: 'PracticeCompetitionMy',
        component: () => import('@/modules/practice/pages/CompetitionStudentPage.vue'),
        meta: { titleKey: 'practice.competition.myTitle', roles: ['student'] },
      },
      {
        path: 'practice/social-practice',
        name: 'PracticeSocialPractice',
        component: () => import('@/modules/practice/pages/SocialPracticeManagementPage.vue'),
        meta: { titleKey: 'practice.socialPractice.mgTitle', roles: ['academic_admin'] },
      },
      {
        path: 'practice/social-practice/my',
        name: 'PracticeSocialPracticeMy',
        component: () => import('@/modules/practice/pages/SocialPracticeStudentPage.vue'),
        meta: { titleKey: 'practice.socialPractice.myTitle', roles: ['student'] },
      },
      {
        path: 'colleges',
        name: 'CollegeManagement',
        component: () => import('@/modules/college/pages/CollegeManagementPage.vue'),
        meta: { titleKey: 'college.title', roles: ['academic_admin'] },
      },
      // ===== 毕业设计与论文管理 =====
      // 学生端
      {
        path: 'practice/graduation/student/campaigns',
        name: 'GraduationStudentCampaigns',
        component: () =>
          import('@/modules/practice/graduation/pages/student/StudentCampaignsPage.vue'),
        meta: { titleKey: 'graduation.student.campaignsTitle', roles: ['student'] },
      },
      {
        path: 'practice/graduation/student/proposals',
        name: 'GraduationStudentProposals',
        component: () => import('@/modules/practice/graduation/pages/student/MyProposalsPage.vue'),
        meta: { titleKey: 'graduation.student.myProposalsTitle', roles: ['student'] },
      },
      {
        path: 'practice/graduation/student/opening',
        name: 'GraduationStudentOpening',
        component: () =>
          import('@/modules/practice/graduation/pages/student/OpeningReportPage.vue'),
        meta: { titleKey: 'graduation.student.openingTitle', roles: ['student'] },
      },
      {
        path: 'practice/graduation/student/midterm',
        name: 'GraduationStudentMidterm',
        component: () => import('@/modules/practice/graduation/pages/student/MidtermPage.vue'),
        meta: { titleKey: 'graduation.student.midtermTitle', roles: ['student'] },
      },
      {
        path: 'practice/graduation/student/thesis',
        name: 'GraduationStudentThesis',
        component: () => import('@/modules/practice/graduation/pages/student/MyThesisPage.vue'),
        meta: { titleKey: 'graduation.student.thesisTitle', roles: ['student'] },
      },
      {
        path: 'practice/graduation/student/defense',
        name: 'GraduationStudentDefense',
        component: () => import('@/modules/practice/graduation/pages/student/DefenseInfoPage.vue'),
        meta: { titleKey: 'graduation.student.defenseTitle', roles: ['student'] },
      },
      {
        path: 'practice/graduation/student/score',
        name: 'GraduationStudentScore',
        component: () => import('@/modules/practice/graduation/pages/student/MyScorePage.vue'),
        meta: { titleKey: 'graduation.student.myScoreTitle', roles: ['student'] },
      },
      // 教师端
      {
        path: 'practice/graduation/teacher/pool',
        name: 'GraduationTeacherPool',
        component: () => import('@/modules/practice/graduation/pages/teacher/StudentPoolPage.vue'),
        meta: { titleKey: 'graduation.teacher.poolTitle', roles: ['teacher'] },
      },
      {
        path: 'practice/graduation/teacher/students',
        name: 'GraduationTeacherStudents',
        component: () => import('@/modules/practice/graduation/pages/teacher/MyStudentsPage.vue'),
        meta: { titleKey: 'graduation.teacher.myStudentsTitle', roles: ['teacher'] },
      },
      {
        path: 'practice/graduation/teacher/opening-review',
        name: 'GraduationTeacherOpeningReview',
        component: () =>
          import('@/modules/practice/graduation/pages/teacher/OpeningReviewPage.vue'),
        meta: { titleKey: 'graduation.teacher.openingReviewTitle', roles: ['teacher'] },
      },
      {
        path: 'practice/graduation/teacher/midterm-review',
        name: 'GraduationTeacherMidtermReview',
        component: () =>
          import('@/modules/practice/graduation/pages/teacher/MidtermReviewPage.vue'),
        meta: { titleKey: 'graduation.teacher.midtermReviewTitle', roles: ['teacher'] },
      },
      {
        path: 'practice/graduation/teacher/guidance',
        name: 'GraduationTeacherGuidance',
        component: () => import('@/modules/practice/graduation/pages/teacher/GuidanceLogPage.vue'),
        meta: { titleKey: 'graduation.teacher.guidanceTitle', roles: ['teacher'] },
      },
      {
        path: 'practice/graduation/teacher/thesis-review',
        name: 'GraduationTeacherThesisReview',
        component: () => import('@/modules/practice/graduation/pages/teacher/ThesisReviewPage.vue'),
        meta: { titleKey: 'graduation.teacher.thesisReviewTitle', roles: ['teacher'] },
      },
      {
        path: 'practice/graduation/teacher/scores',
        name: 'GraduationTeacherScores',
        component: () => import('@/modules/practice/graduation/pages/teacher/ScoreEntryPage.vue'),
        meta: { titleKey: 'graduation.teacher.scoreEntryTitle', roles: ['teacher'] },
      },
      // 院系端
      {
        path: 'practice/graduation/dept/proposal-review',
        name: 'GraduationDeptProposalReview',
        component: () => import('@/modules/practice/graduation/pages/dept/ProposalReviewPage.vue'),
        meta: { titleKey: 'graduation.dept.proposalReviewTitle', roles: ['department'] },
      },
      {
        path: 'practice/graduation/dept/allocate',
        name: 'GraduationDeptAllocate',
        component: () =>
          import('@/modules/practice/graduation/pages/dept/StudentAllocationPage.vue'),
        meta: { titleKey: 'graduation.dept.allocateTitle', roles: ['department'] },
      },
      {
        path: 'practice/graduation/dept/dashboard',
        name: 'GraduationDeptDashboard',
        component: () => import('@/modules/practice/graduation/pages/dept/DeptDashboardPage.vue'),
        meta: { titleKey: 'graduation.dept.dashboardTitle', roles: ['department'] },
      },
      {
        path: 'practice/graduation/dept/defense',
        name: 'GraduationDeptDefense',
        component: () => import('@/modules/practice/graduation/pages/dept/DefenseArrangePage.vue'),
        meta: { titleKey: 'graduation.dept.defenseArrangeTitle', roles: ['department'] },
      },
      {
        path: 'practice/graduation/dept/scores',
        name: 'GraduationDeptScores',
        component: () => import('@/modules/practice/graduation/pages/dept/DefenseScoresPage.vue'),
        meta: { titleKey: 'graduation.dept.scoresPublishTitle', roles: ['department'] },
      },
      // 教务端
      {
        path: 'practice/graduation/admin/campaigns',
        name: 'GraduationAdminCampaigns',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/CampaignManagementPage.vue'),
        meta: { titleKey: 'graduation.academic.campaignMgmtTitle', roles: ['academic_admin'] },
      },
      {
        path: 'practice/graduation/admin/review',
        name: 'GraduationAdminReview',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/AcademicReviewPage.vue'),
        meta: { titleKey: 'graduation.academic.reviewTitle', roles: ['academic_admin'] },
      },
      {
        path: 'practice/graduation/admin/overview',
        name: 'GraduationAdminOverview',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/AllocationOverviewPage.vue'),
        meta: { titleKey: 'graduation.academic.overviewTitle', roles: ['academic_admin'] },
      },
      {
        path: 'practice/graduation/admin/dashboard',
        name: 'GraduationAdminDashboard',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/GlobalDashboardPage.vue'),
        meta: { titleKey: 'graduation.academic.globalDashboardTitle', roles: ['academic_admin'] },
      },
      {
        path: 'practice/graduation/admin/logs',
        name: 'GraduationAdminLogs',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/OperationLogPage.vue'),
        meta: { titleKey: 'graduation.academic.operationLogTitle', roles: ['academic_admin'] },
      },
      {
        path: 'practice/graduation/admin/theses',
        name: 'GraduationAdminTheses',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/ThesisDuplicatePage.vue'),
        meta: { titleKey: 'graduation.academic.thesisMgmtTitle', roles: ['academic_admin'] },
      },
      {
        path: 'practice/graduation/admin/scores',
        name: 'GraduationAdminScores',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/ScoreOverviewPage.vue'),
        meta: { titleKey: 'graduation.academic.scoreTableTitle', roles: ['academic_admin'] },
      },
      // 403 角色越权:守卫拦截 meta.roles 不匹配的访问后统一跳转到此页(须位于 404 兜底之前)
      {
        path: '403',
        name: 'Forbidden',
        component: () => import('@/shared/pages/ForbiddenPage.vue'),
        meta: { titleKey: 'common.forbidden.title' },
      },
      // 404 兜底:放在子路由最后,未匹配的路径在主布局内展示 NotFound 页
      {
        path: ':pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('@/shared/pages/NotFoundPage.vue'),
        meta: { titleKey: 'not-found.title' },
      },
    ],
  },
  ...authRoutes,
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  if (!authStore.isLoggedIn && !WHITELIST.includes(to.path)) {
    return '/login'
  }

  // 登出流程中允许已登录用户进入 /login(先跳转再清空会话,避免旧页面闪现无权限)
  // 已登录用户访问 /login 时整页回 /:线上 / 由 Nginx 返回 SEO 落地页(展示已登录头像菜单);
  // 不能用 router 内部跳转 '/':SPA 的 / 路由只会 redirect 到 /profile
  if (authStore.isLoggedIn && WHITELIST.includes(to.path) && !authStore.isLoggingOut) {
    window.location.replace('/')
    return false
  }

  // 角色守卫:目标路由声明了 meta.roles 而当前用户角色不在列时,统一跳转 403 页。
  // 菜单(menu.ts)只负责隐藏入口,这里兜底地址栏直达:页面组件不会加载、业务请求不会发出。
  const userType = authStore.user?.userType
  if (to.meta.roles && (!userType || !to.meta.roles.includes(userType))) {
    return { name: 'Forbidden' }
  }
})

// 记录每个非 404/403 页面的路径:整页刷新/地址栏直达错误页时,浏览器历史中没有应用内上一页,
// 404/403 页的「返回上一页」依赖这份记录找回来源页(sessionStorage 随标签页关闭自动清除)
router.afterEach((to) => {
  if (to.name !== 'NotFound' && to.name !== 'Forbidden') {
    rememberVisitedPath(to.fullPath)
  }
})

export default router
