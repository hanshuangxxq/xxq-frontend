import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import authRoutes from '@/modules/auth/router'
import { useAuthStore } from '@/stores/useAuthStore'
import MainLayout from '@/modules/layout/MainLayout.vue'

const WHITELIST = ['/login']

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/modules/layout/HomePage.vue'),
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/modules/auth/pages/ProfilePage.vue'),
      },
      {
        path: 'course',
        name: 'CourseSelection',
        component: () => import('@/modules/selection/pages/StudentSelectionPage.vue'),
      },
      {
        path: 'selection',
        name: 'SelectionCampaigns',
        component: () => import('@/modules/selection/pages/CampaignManagementPage.vue'),
      },
      {
        path: 'selection/:id',
        name: 'SelectionCampaignDetail',
        component: () => import('@/modules/selection/pages/CampaignDetailPage.vue'),
      },
      {
        path: 'curriculum',
        name: 'Curriculum',
        component: () => import('@/modules/curriculum/pages/CurriculumPage.vue'),
      },
      {
        path: 'time-restrictions',
        name: 'TimeRestrictions',
        component: () => import('@/modules/time-restrictions/pages/TimeRestrictionsPage.vue'),
      },
      {
        path: 'scheduling',
        name: 'Scheduling',
        component: () => import('@/modules/scheduling/pages/SchedulingPage.vue'),
      },
      {
        path: 'course-management',
        name: 'CourseManagement',
        component: () => import('@/modules/course/pages/CourseManagementPage.vue'),
      },
      {
        path: 'class-names',
        name: 'ClassNameManagement',
        component: () => import('@/modules/class-names/pages/ClassNameManagementPage.vue'),
      },
      {
        path: 'locals',
        name: 'LocalManagement',
        component: () => import('@/modules/locals/pages/LocalManagementPage.vue'),
      },
      {
        path: 'teach-drafts',
        name: 'TeachDrafts',
        component: () => import('@/modules/curriculum/pages/DraftManagementPage.vue'),
      },
      {
        path: 'batch-import',
        name: 'BatchImport',
        component: () => import('@/modules/batch-import/pages/BatchImportPage.vue'),
      },
      {
        path: 'student-management',
        name: 'StudentManagement',
        component: () => import('@/modules/student-management/pages/StudentManagementPage.vue'),
      },
      {
        path: 'majors',
        name: 'MajorManagement',
        component: () => import('@/modules/majors/pages/MajorManagementPage.vue'),
      },
      {
        path: 'semester',
        name: 'SemesterManagement',
        component: () => import('@/modules/curriculum/pages/SemesterManagementPage.vue'),
      },
      {
        path: 'grades',
        name: 'GradeManagement',
        component: () => import('@/modules/grades/pages/GradeManagementPage.vue'),
      },
      {
        path: 'scores',
        name: 'ScoreManagement',
        component: () => import('@/modules/score/pages/ScoreManagementPage.vue'),
      },
      {
        path: 'score-statistics',
        name: 'ScoreStatistics',
        component: () => import('@/modules/score/pages/ScoreStatisticsPage.vue'),
      },
      {
        path: 'my-scores',
        name: 'MyScores',
        component: () => import('@/modules/score/pages/MyScoresPage.vue'),
      },
      {
        path: 'score-review',
        name: 'ScoreReview',
        component: () => import('@/modules/score/pages/ScoreReviewPage.vue'),
      },
      {
        path: 'exams',
        name: 'ExamManagement',
        component: () => import('@/modules/exam/pages/ExamManagementPage.vue'),
      },
      {
        path: 'makeup-exams',
        name: 'MakeupExams',
        component: () => import('@/modules/exam/pages/MakeupExamPage.vue'),
      },
      {
        path: 'my-exams',
        name: 'MyExams',
        component: () => import('@/modules/exam/pages/MyExamsPage.vue'),
      },
      {
        path: 'analysis/warnings',
        name: 'AnalysisWarnings',
        component: () => import('@/modules/analysis/pages/WarningPage.vue'),
      },
      {
        path: 'analysis/evaluations',
        name: 'AnalysisEvaluations',
        component: () => import('@/modules/analysis/pages/EvaluationPage.vue'),
      },
      {
        path: 'analysis/teacher-quality',
        name: 'AnalysisTeacherQuality',
        component: () => import('@/modules/analysis/pages/TeacherQualityPage.vue'),
      },
      {
        path: 'practice/internship',
        name: 'PracticeInternship',
        component: () => import('@/modules/practice/pages/InternshipManagementPage.vue'),
      },
      {
        path: 'practice/internship/my',
        name: 'PracticeInternshipMy',
        component: () => import('@/modules/practice/pages/InternshipStudentPage.vue'),
      },
      {
        path: 'practice/competition',
        name: 'PracticeCompetition',
        component: () => import('@/modules/practice/pages/CompetitionManagementPage.vue'),
      },
      {
        path: 'practice/competition/my',
        name: 'PracticeCompetitionMy',
        component: () => import('@/modules/practice/pages/CompetitionStudentPage.vue'),
      },
      {
        path: 'practice/social-practice',
        name: 'PracticeSocialPractice',
        component: () => import('@/modules/practice/pages/SocialPracticeManagementPage.vue'),
      },
      {
        path: 'practice/social-practice/my',
        name: 'PracticeSocialPracticeMy',
        component: () => import('@/modules/practice/pages/SocialPracticeStudentPage.vue'),
      },
      {
        path: 'colleges',
        name: 'CollegeManagement',
        component: () => import('@/modules/college/pages/CollegeManagementPage.vue'),
      },
      // ===== 毕业设计与论文管理 =====
      // 学生端
      {
        path: 'practice/graduation/student/campaigns',
        name: 'GraduationStudentCampaigns',
        component: () =>
          import('@/modules/practice/graduation/pages/student/StudentCampaignsPage.vue'),
      },
      {
        path: 'practice/graduation/student/proposals',
        name: 'GraduationStudentProposals',
        component: () => import('@/modules/practice/graduation/pages/student/MyProposalsPage.vue'),
      },
      {
        path: 'practice/graduation/student/opening',
        name: 'GraduationStudentOpening',
        component: () =>
          import('@/modules/practice/graduation/pages/student/OpeningReportPage.vue'),
      },
      {
        path: 'practice/graduation/student/midterm',
        name: 'GraduationStudentMidterm',
        component: () => import('@/modules/practice/graduation/pages/student/MidtermPage.vue'),
      },
      {
        path: 'practice/graduation/student/thesis',
        name: 'GraduationStudentThesis',
        component: () => import('@/modules/practice/graduation/pages/student/MyThesisPage.vue'),
      },
      {
        path: 'practice/graduation/student/defense',
        name: 'GraduationStudentDefense',
        component: () => import('@/modules/practice/graduation/pages/student/DefenseInfoPage.vue'),
      },
      {
        path: 'practice/graduation/student/score',
        name: 'GraduationStudentScore',
        component: () => import('@/modules/practice/graduation/pages/student/MyScorePage.vue'),
      },
      // 教师端
      {
        path: 'practice/graduation/teacher/pool',
        name: 'GraduationTeacherPool',
        component: () => import('@/modules/practice/graduation/pages/teacher/StudentPoolPage.vue'),
      },
      {
        path: 'practice/graduation/teacher/students',
        name: 'GraduationTeacherStudents',
        component: () => import('@/modules/practice/graduation/pages/teacher/MyStudentsPage.vue'),
      },
      {
        path: 'practice/graduation/teacher/opening-review',
        name: 'GraduationTeacherOpeningReview',
        component: () =>
          import('@/modules/practice/graduation/pages/teacher/OpeningReviewPage.vue'),
      },
      {
        path: 'practice/graduation/teacher/midterm-review',
        name: 'GraduationTeacherMidtermReview',
        component: () =>
          import('@/modules/practice/graduation/pages/teacher/MidtermReviewPage.vue'),
      },
      {
        path: 'practice/graduation/teacher/guidance',
        name: 'GraduationTeacherGuidance',
        component: () => import('@/modules/practice/graduation/pages/teacher/GuidanceLogPage.vue'),
      },
      {
        path: 'practice/graduation/teacher/thesis-review',
        name: 'GraduationTeacherThesisReview',
        component: () => import('@/modules/practice/graduation/pages/teacher/ThesisReviewPage.vue'),
      },
      {
        path: 'practice/graduation/teacher/scores',
        name: 'GraduationTeacherScores',
        component: () => import('@/modules/practice/graduation/pages/teacher/ScoreEntryPage.vue'),
      },
      // 院系端
      {
        path: 'practice/graduation/dept/proposal-review',
        name: 'GraduationDeptProposalReview',
        component: () => import('@/modules/practice/graduation/pages/dept/ProposalReviewPage.vue'),
      },
      {
        path: 'practice/graduation/dept/allocate',
        name: 'GraduationDeptAllocate',
        component: () =>
          import('@/modules/practice/graduation/pages/dept/StudentAllocationPage.vue'),
      },
      {
        path: 'practice/graduation/dept/dashboard',
        name: 'GraduationDeptDashboard',
        component: () => import('@/modules/practice/graduation/pages/dept/DeptDashboardPage.vue'),
      },
      {
        path: 'practice/graduation/dept/defense',
        name: 'GraduationDeptDefense',
        component: () => import('@/modules/practice/graduation/pages/dept/DefenseArrangePage.vue'),
      },
      {
        path: 'practice/graduation/dept/scores',
        name: 'GraduationDeptScores',
        component: () => import('@/modules/practice/graduation/pages/dept/DefenseScoresPage.vue'),
      },
      // 教务端
      {
        path: 'practice/graduation/admin/campaigns',
        name: 'GraduationAdminCampaigns',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/CampaignManagementPage.vue'),
      },
      {
        path: 'practice/graduation/admin/review',
        name: 'GraduationAdminReview',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/AcademicReviewPage.vue'),
      },
      {
        path: 'practice/graduation/admin/overview',
        name: 'GraduationAdminOverview',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/AllocationOverviewPage.vue'),
      },
      {
        path: 'practice/graduation/admin/dashboard',
        name: 'GraduationAdminDashboard',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/GlobalDashboardPage.vue'),
      },
      {
        path: 'practice/graduation/admin/logs',
        name: 'GraduationAdminLogs',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/OperationLogPage.vue'),
      },
      {
        path: 'practice/graduation/admin/theses',
        name: 'GraduationAdminTheses',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/ThesisDuplicatePage.vue'),
      },
      {
        path: 'practice/graduation/admin/scores',
        name: 'GraduationAdminScores',
        component: () =>
          import('@/modules/practice/graduation/pages/academic/ScoreOverviewPage.vue'),
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
    return '/profile'
  }
})

export default router
