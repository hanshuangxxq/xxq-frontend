// 英文落地页内容数据(目前只有 /en/ 首页)。
//
// 详情页暂不提供英文版:使用方是国内院校,英文长尾词几乎没有搜索量,
// 多一份翻译就多一份需要同步维护、且必然逐渐漂移的文案。
// 若将来要补英文详情页,在此追加页面数据并配好 alternates 即可,
// 但 hreflang 必须成对——单侧 alternate 比不写更糟。

export const PAGES_EN = [
  {
    lang: 'en',
    slug: 'en',
    urlPath: '/en/',
    outPath: 'en/index.html',
    indexable: true,
    title: 'Academic Affairs Management System - Scheduling, Grades & Exams | XXQ',
    description:
      'XXQ is an all-in-one academic affairs management system for universities, covering course selection, class scheduling, grades and exams, graduation projects and practical education.',
    h1: 'XXQ Academic Affairs Management System',
    lead:
      'An all-in-one teaching management platform for universities — from course selection, scheduling and curricula to grades, exams, graduation projects and practical education, with students, faculty, departments and academic affairs working together in one place.',
    ogImageAlt: 'XXQ Academic Affairs Management System — one platform for teaching operations',
    navLabel: 'Home',
    linkLabel: 'XXQ Academic Affairs Management System overview',
    breadcrumb: [{ name: 'Home' }],
    lastModified: '2026-09-16',
    alternates: [
      { hreflang: 'zh-CN', path: '/' },
      { hreflang: 'en', path: '/en/' },
      { hreflang: 'x-default', path: '/' },
    ],
    application: {
      name: 'XXQ Academic Affairs Management System',
      alternateName: 'XXQ 高校教务管理系统',
      featureList: [
        'Course selection campaigns with time-conflict and capacity checks',
        'Class scheduling and teaching assignment management',
        'Curriculum planning and course administration',
        'Grade entry, statistical analysis and grade review requests',
        'Exam scheduling and make-up exam management',
        'Full graduation project workflow (topic selection, proposal, midterm, thesis, defense, grading)',
        'Internship, competition and social practice management',
        'Academic early warnings, teaching evaluations and teaching-quality analytics',
        'Master data for students, majors, colleges, grade levels and classes, with batch import',
      ],
    },
    sections: [
      {
        h2: 'One platform for the whole teaching cycle',
        paras: [
          'Academic affairs work is spread across course selection, scheduling, grades, exams and graduation projects. When each runs on its own system, staff reconcile spreadsheets by hand, departments re-enter the same data, and students juggle multiple entry points. XXQ brings these steps into one system, so data is entered once and used everywhere downstream.',
        ],
        list: [
          'Teaching operations: enrolment campaigns, smart class scheduling, teaching assignments, curricula and course administration',
          'Grades and exams: grade entry and analysis, exam and make-up exam scheduling, grade review requests',
          'Practical education: internships, competitions and social practice, plus the full graduation project workflow',
          'Analytics and master data: academic early warnings, teaching evaluations, and student, major, college, grade level and class records',
        ],
      },
      {
        h2: 'Four roles, separate permissions',
        paras: [
          'The system organises functions and data scope by role — student, faculty, department and academic affairs. A role never sees menu entries outside its scope, and reaching a page by URL directly is blocked before the page component loads or any business request is sent.',
        ],
        list: [
          'Students: enrol in and drop courses, view timetables and exams, check grades and request reviews, select graduation project topics and submit theses',
          'Faculty: view teaching assignments, enter grades, advise graduation projects and review proposals, midterms and theses, keep guidance logs',
          'Departments: review project topics, allocate students, arrange defenses and publish results, manage internships, monitor progress',
          'Academic affairs: curricula and scheduling, enrolment campaigns and exams, early warnings and evaluations, master data with batch import',
        ],
      },
      {
        h2: 'Consistency enforced by the workflow',
        paras: [
          'Course selection is bound by time-conflict and capacity rules, grade entry is bound to a teaching assignment, and each graduation project stage requires review by the responsible role before the next one opens. These constraints live in the system rather than in a checklist applied afterwards.',
          'Master data supports batch import, so students, majors, colleges, grade levels and classes can be set up in one pass before the term starts.',
        ],
      },
    ],
    related: [],
  },
]
