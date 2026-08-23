import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import authRoutes from '@/modules/auth/router'
import { useAuthStore } from '@/stores/useAuthStore'
import MainLayout from '@/modules/layout/MainLayout.vue'

const WHITELIST = ['/login']

/** 各角色登录后的默认首页(访问 / 时重定向);未匹配到角色时回退 /profile */
const ROLE_HOME: Record<string, string> = {
  student: '/curriculum',
  teacher: '/curriculum',
  department: '/teach-drafts',
  academic_admin: '/time-restrictions',
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        redirect: () => {
          const authStore = useAuthStore()
          return ROLE_HOME[authStore.user?.userType ?? ''] ?? '/profile'
        },
      },
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
        meta: { titleKey: 'course.title' },
      },
      {
        path: 'selection',
        name: 'SelectionCampaigns',
        component: () => import('@/modules/selection/pages/CampaignManagementPage.vue'),
        meta: { titleKey: 'selection.title' },
      },
      {
        path: 'selection/:id',
        name: 'SelectionCampaignDetail',
        component: () => import('@/modules/selection/pages/CampaignDetailPage.vue'),
        meta: { titleKey: 'selection.detailTitle' },
      },
      {
        path: 'curriculum',
        name: 'Curriculum',
        component: () => import('@/modules/curriculum/pages/CurriculumPage.vue'),
        meta: { titleKey: 'curriculum.title' },
      },
      {
        path: 'time-restrictions',
        name: 'TimeRestrictions',
        component: () => import('@/modules/time-restrictions/pages/TimeRestrictionsPage.vue'),
        meta: { titleKey: 'time-restrictions.title' },
      },
      {
        path: 'scheduling',
        name: 'Scheduling',
        component: () => import('@/modules/scheduling/pages/SchedulingPage.vue'),
        meta: { titleKey: 'scheduling.title' },
      },
      {
        path: 'course-management',
        name: 'CourseManagement',
        component: () => import('@/modules/course/pages/CourseManagementPage.vue'),
        meta: { titleKey: 'course-management.title' },
      },
      {
        path: 'class-names',
        name: 'ClassNameManagement',
        component: () => import('@/modules/class-names/pages/ClassNameManagementPage.vue'),
        meta: { titleKey: 'class-names.title' },
      },
      {
        path: 'locals',
        name: 'LocalManagement',
        component: () => import('@/modules/locals/pages/LocalManagementPage.vue'),
        meta: { titleKey: 'locals.title' },
      },
      {
        path: 'teach-drafts',
        name: 'TeachDrafts',
        component: () => import('@/modules/curriculum/pages/DraftManagementPage.vue'),
        meta: { titleKey: 'teach-drafts.title' },
      },
      {
        path: 'batch-import',
        name: 'BatchImport',
        component: () => import('@/modules/batch-import/pages/BatchImportPage.vue'),
        meta: { titleKey: 'batch-import.title' },
      },
      {
        path: 'student-management',
        name: 'StudentManagement',
        component: () => import('@/modules/student-management/pages/StudentManagementPage.vue'),
        meta: { titleKey: 'student-management.title' },
      },
      {
        path: 'majors',
        name: 'MajorManagement',
        component: () => import('@/modules/majors/pages/MajorManagementPage.vue'),
        meta: { titleKey: 'majors.title' },
      },
      {
        path: 'semester',
        name: 'SemesterManagement',
        component: () => import('@/modules/curriculum/pages/SemesterManagementPage.vue'),
        meta: { titleKey: 'layout.semester' },
      },
      {
        path: 'grades',
        name: 'GradeManagement',
        component: () => import('@/modules/grades/pages/GradeManagementPage.vue'),
        meta: { titleKey: 'grades.title' },
      },
      {
        path: 'scores',
        name: 'ScoreManagement',
        component: () => import('@/modules/score/pages/ScoreManagementPage.vue'),
        meta: { titleKey: 'score.mgTitle' },
      },
      {
        path: 'score-statistics',
        name: 'ScoreStatistics',
        component: () => import('@/modules/score/pages/ScoreStatisticsPage.vue'),
        meta: { titleKey: 'score.statTitle' },
      },
      {
        path: 'my-scores',
        name: 'MyScores',
        component: () => import('@/modules/score/pages/MyScoresPage.vue'),
        meta: { titleKey: 'score.myTitle' },
      },
      {
        path: 'score-review',
        name: 'ScoreReview',
        component: () => import('@/modules/score/pages/ScoreReviewPage.vue'),
        meta: { titleKey: 'score.rvTitle' },
      },
      {
        path: 'exams',
        name: 'ExamManagement',
        component: () => import('@/modules/exam/pages/ExamManagementPage.vue'),
        meta: { titleKey: 'exam.mgTitle' },
      },
      {
        path: 'makeup-exams',
        name: 'MakeupExams',
        component: () => import('@/modules/exam/pages/MakeupExamPage.vue'),
        meta: { titleKey: 'exam.mkTitle' },
      },
      {
        path: 'my-exams',
        name: 'MyExams',
        component: () => import('@/modules/exam/pages/MyExamsPage.vue'),
        meta: { titleKey: 'exam.myTitle' },
      },
      {
        path: 'analysis/warnings',
        name: 'AnalysisWarnings',
        component: () => import('@/modules/analysis/pages/WarningPage.vue'),
        meta: { titleKey: 'analysis.warnings' },
      },
      {
        path: 'analysis/evaluations',
        name: 'AnalysisEvaluations',
        component: () => import('@/modules/analysis/pages/EvaluationPage.vue'),
        meta: { titleKey: 'analysis.evaluations' },
      },
      {
        path: 'analysis/teacher-quality',
        name: 'AnalysisTeacherQuality',
        component: () => import('@/modules/analysis/pages/TeacherQualityPage.vue'),
        meta: { titleKey: 'analysis.teacherQuality' },
      },
      {
        path: 'practice/internship',
        name: 'PracticeInternship',
        component: () => import('@/modules/practice/pages/InternshipManagementPage.vue'),
        meta: { titleKey: 'practice.internship.mgTitle' },
      },
      {
        path: 'practice/internship/my',
        name: 'PracticeInternshipMy',
        component: () => import('@/modules/practice/pages/InternshipStudentPage.vue'),
        meta: { titleKey: 'practice.internship.myTitle' },
      },
      {
        path: 'practice/competition',
        name: 'PracticeCompetition',
        component: () => import('@/modules/practice/pages/CompetitionManagementPage.vue'),
        meta: { titleKey: 'practice.competition.mgTitle' },
      },
      {
        path: 'practice/competition/my',
        name: 'PracticeCompetitionMy',
        component: () => import('@/modules/practice/pages/CompetitionStudentPage.vue'),
        meta: { titleKey: 'practice.competition.myTitle' },
      },
      {
        path: 'practice/social-practice',
        name: 'PracticeSocialPractice',
        component: () => import('@/modules/practice/pages/SocialPracticeManagementPage.vue'),
        meta: { titleKey: 'practice.socialPractice.mgTitle' },
      },
      {
        path: 'practice/social-practice/my',
        name: 'PracticeSocialPracticeMy',
        component: () => import('@/modules/practice/pages/SocialPracticeStudentPage.vue'),
        meta: { titleKey: 'practice.socialPractice.myTitle' },
      },
      {
        path: 'colleges',
        name: 'CollegeManagement',
        component: () => import('@/modules/college/pages/CollegeManagementPage.vue'),
        meta: { titleKey: 'college.title' },
      },
      // ===== 毕业设计与论文管理 =====
      // 学生端
      {
        path: 'practice/graduation/student/campaigns',
        name: 'GraduationStudentCampaigns',
        component: () =>
          import('@/modules/practice/graduation/pages/student/StudentCampaignsPage.vue'),
        meta: { titleKey: 'graduation.student.campaignsTitle' },
      },
      {
        path: 'practice/graduation/student/proposals',
        name: 'GraduationStudentProposals',
        component: () => import('@/modules/practice/graduation/pages/student/MyProposalsPage.vue'),
        meta: { titleKey: 'graduation.student.myProposalsTitle' },
      },
      {
        path: 'practice/graduation/student/opening',
        name: 'GraduationStudentOpening',
        component: () =>
          import('@/modules/practice/graduation/pages/student/OpeningReportPage.vue'),
        meta: { titleKey: 'graduation.student.openingTitle' },
      },
      {
        path: 'practice/graduation/student/midterm',
        name: 'GraduationStudentMidterm',
        component: () => import('@/modules/practice/graduation/pages/student/MidtermPage.vue'),
        meta: { titleKey: 'graduation.student.midtermTitle' },
      },
      {
        path: 'practice/graduation/student/thesis',
        name: 'GraduationStudentThesis',
        component: () => import('@/modules/practice/graduation/pages/student/MyThesisPage.vue'),
        meta: { titleKey: 'graduation.student.thesisTitle' },
      },
      {
        path: 'practice/graduation/student/defense',
        name: 'GraduationStudentDefense',
        component: () => import('@/modules/practice/graduation/pages/student/DefenseInfoPage.vue'),
        meta: { titleKey: 'graduation.student.defenseTitle' },
      },
      {
        path: 'practice/graduation/student/score',
        name: 'GraduationStudentScore',
        component: () => import('@/modules/practice/graduation/pages/student/MyScorePage.vue'),
        meta: { titleKey: 'graduation.student.myScoreTitle' },
      },
      // 教师端
      {
        path: 'practice/graduation/teacher/pool',
        name: 'GraduationTeacherPool',
        component: () => import('@/modules/practice/graduation/pages/teacher/StudentPoolPage.vue'),
        meta: { titleKey: 'graduation.teacher.poolTitle' },
      },
      {
        path: 'practice/graduation/teacher/students',
        name: 'GraduationTeacherStudents',
        component: () => import('@/modules/practice/graduation/pages/teacher/MyStudentsPage.vue'),
        meta: { titleKey: 'graduation.teacher.myStudentsTitle' },
      },
      {
        path: 'practice/graduation/teacher/opening-review',
        name: 'GraduationTeacherOpeningReview',
        component: () =>
          import('@/modules/practice/graduation/pages/teacher/OpeningReviewPage.vue'),
        meta: { titleKey: 'graduation.teacher.openingReviewTitle' },
      },
      {
        path: 'practice/graduation/teacher/midterm-review',
        name: 'GraduationTeacherMidtermReview',
        component: () =>
          import('@/modules/practice/graduation/pages/teacher/MidtermReviewPage.vue'),
        meta: { titleKey: 'graduation.teacher.midtermReviewTitle' },
      },
      {
        path: 'practice/graduation/teacher/guidance',
        name: 'GraduationTeacherGuidance',
        component: () => import('@/modules/practice/graduation/pages/teacher/GuidanceLogPage.vue'),
        meta: { titleKey: 'graduation.teacher.guidanceTitle' },
      },
      {
        path: 'practice/graduation/teacher/thesis-review',
        name: 'GraduationTeacherThesisReview',
        component: () => import('@/modules/practice/graduation/pages/teacher/ThesisReviewPage.vue'),
        meta: { titleKey: 'graduation.teacher.thesisReviewTitle' },
      },
      {
        path: 'practice/graduation/teacher/scores',
        name: 'GraduationTeacherScores',
        component: () => import('@/modules/practice/graduation/pages/teacher/ScoreEntryPage.vue'),
        meta: { titleKey: 'graduation.teacher.scoreEntryTitle' },
      },
      // 院系端
      {
        path: 'practice/graduation/dept/proposal-review',
        name: 'GraduationDeptProposalReview',
        component: () => import('@/modules/practice/graduation/pages/dept/ProposalReviewPage.vue'),
        meta: { titleKey: 'graduation.dept.proposalReviewTitle' },
      },
      {
        path: 'practice/graduation/dept/allocate',
        name: 'GraduationDeptAllocate',
        component: () =>
          import('@/modules/practice/graduation/pages/dept/StudentAllocationPage.vue'),
        meta: { titleKey: 'graduation.dept.allocateTitle' },
      },
      {
        path: 'practice/graduation/dept/dashboard',
        name: 'GraduationDeptDashboard',
        component: () => import('@/modules/practice/graduation/pages/dept/DeptDashboardPage.vue'),
        meta: { titleKey: 'graduation.dept.dashboardTitle' },
      },
      {
        path: 'practice/graduation/dept/defense',
        name: 'GraduationDeptDefense',
        component: () => import('@/modules/practice/graduation/pages/dept/DefenseArrangePage.vue'),
        meta: { titleKey: 'graduation.dept.defenseArrangeTitle' },
      },
      {
        path: 'practice/graduation/dept/scores',
        name: 'GraduationDeptScores',
        component: () => import('@/modules/practice/graduation/pages/dept/DefenseScoresPage.vue'),
        meta: { titleKey: 'graduation.dept.scoresPublishTitle' },
      },
      // 教务端
      {
        path: 'practice/graduation/admin/campaigns',
        name: 'GraduationAdminCampaigns',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/CampaignManagementPage.vue'),
        meta: { titleKey: 'graduation.academic.campaignMgmtTitle' },
      },
      {
        path: 'practice/graduation/admin/review',
        name: 'GraduationAdminReview',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/AcademicReviewPage.vue'),
        meta: { titleKey: 'graduation.academic.reviewTitle' },
      },
      {
        path: 'practice/graduation/admin/overview',
        name: 'GraduationAdminOverview',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/AllocationOverviewPage.vue'),
        meta: { titleKey: 'graduation.academic.overviewTitle' },
      },
      {
        path: 'practice/graduation/admin/dashboard',
        name: 'GraduationAdminDashboard',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/GlobalDashboardPage.vue'),
        meta: { titleKey: 'graduation.academic.globalDashboardTitle' },
      },
      {
        path: 'practice/graduation/admin/logs',
        name: 'GraduationAdminLogs',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/OperationLogPage.vue'),
        meta: { titleKey: 'graduation.academic.operationLogTitle' },
      },
      {
        path: 'practice/graduation/admin/theses',
        name: 'GraduationAdminTheses',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/ThesisDuplicatePage.vue'),
        meta: { titleKey: 'graduation.academic.thesisMgmtTitle' },
      },
      {
        path: 'practice/graduation/admin/scores',
        name: 'GraduationAdminScores',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/ScoreOverviewPage.vue'),
        meta: { titleKey: 'graduation.academic.scoreTableTitle' },
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
  if (authStore.isLoggedIn && WHITELIST.includes(to.path) && !authStore.isLoggingOut) {
    return '/'
  }
})

export default router
