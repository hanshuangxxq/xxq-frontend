/**
 * 课程课业模块类型定义,逐字镜像后端 module/coursework 的 dto 包。
 * 契约原文见 docs/课程课业模块-前端对接文档.md 与 docs/在线作答作业-前端接口文档.md。
 *
 * ★ 三套「状态」不是一回事,不能合并(文档 §1.4):
 *   - AssignmentStatus     作业状态,后端 @JsonValue 输出**中文文案**
 *   - SubmissionStatus     提交状态(详情/名单),同为**中文文案**
 *   - MySubmissionStatusCode 列表里的「我的提交」摘要,是 String 字段存**英文码**,唯一例外
 *
 * ★ 枚举序列化口径(在线作答文档 §2):
 *   - 题型 type / 多选计分 scoreRule / 答案可见性 answerVisible / 名单五态 state → 英文 code
 *   - 作业 status / 提交 status → 中文文案
 */

// ---- 枚举 ----

/** 作业状态:草稿仅教师可见,已关闭拒绝提交 */
export type AssignmentStatus = '草稿' | '已发布' | '已关闭'

/** 提交状态(中文文案),用于 SubmissionView 与提交名单行 */
export type SubmissionStatus = '已提交' | '已批改'

/** 「我的提交」状态码(英文码),仅用于 AssignmentView.mySubmissionStatus */
export type MySubmissionStatusCode = 'SUBMITTED' | 'GRADED'

/** 题型 code(QuestionTypeEnum),前端按 code 分发作答/编辑组件 */
export type QuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'JUDGE' | 'FILL_BLANK' | 'ESSAY'

/** 多选计分规则(MultiScoreRuleEnum):全对才得分 / 少选半分错选零分(默认) */
export type MultiScoreRule = 'ALL_OR_NOTHING' | 'HALF_ON_PARTIAL'

/** 答案可见性(AnswerVisibleEnum):门控**仅**作用于提交后的 my-submission,作答页永不下发答案 */
export type AnswerVisible = 'SUBMIT' | 'DEADLINE' | 'CLOSED' | 'NEVER'

/** 教师提交名单五态:GRADED > SUBMITTED > DRAFTING > VIEWED > NOT_VIEWED */
export type SubmissionState = 'GRADED' | 'SUBMITTED' | 'DRAFTING' | 'VIEWED' | 'NOT_VIEWED'

// ---- 题目与答案 JSON 形状 ----

/** 选择题选项(≥2 个,key 大小写不敏感去重) */
export interface OptionItem {
  key: string
  text: string
}

/** 填空题标准答案:外数组=空位,内数组=该空可接受答案(任一命中即对);ordered=false 可乱序 */
export interface FillBlankStandardAnswer {
  ordered: boolean
  blanks: string[][]
}

/** 大题作答附件(提交前必须已经文件模块上传拿到 path,≤3 个) */
export interface EssayAnswerFile {
  path: string
  original: string
}

/** 大题学生作答(text 与 files 都可空,但 requireFile=1 时 files 必填) */
export interface EssayAnswer {
  text?: string
  files?: EssayAnswerFile[]
}

/**
 * 答案 JSON 的传输联合(出题标准答案与学生作答共用按题型解释,对应后端 JsonNode):
 * - SINGLE_CHOICE: "A"(标准与作答同形)
 * - MULTI_CHOICE:  ["A","C"](标准与作答同形,顺序无关)
 * - JUDGE:         true/false(标准与作答同形)
 * - FILL_BLANK:    标准 FillBlankStandardAnswer;学生作答 string[](按空位顺序)
 * - ESSAY:         标准 string(参考文本);学生作答 EssayAnswer
 */
export type QuestionAnswerJson = string | string[] | boolean | FillBlankStandardAnswer | EssayAnswer

// ---- 题库(教师个人,快照语义:作业引用后内容与题库脱钩) ----

/** 题库题目视图 GET /coursework/question-bank(教师端,含标准答案) */
export interface QuestionView {
  id: number
  /** 课程标签(可空;与 campaignId 二选一) */
  courseId: number | null
  campaignId: number | null
  type: QuestionType
  stem: string
  options: OptionItem[] | null
  answer: QuestionAnswerJson | null
  analysis: string | null
  defaultScore: number
  scoreRule: MultiScoreRule | null
  caseSensitive: boolean | null
  requireFile: boolean | null
  createTime: string
}

/** 题库题目创建/修改请求(全量字段;传 null 即清空) POST|PUT /coursework/question-bank */
export interface QuestionSaveRequest {
  type: QuestionType
  stem: string
  /** 仅选择题必填 */
  options?: OptionItem[]
  /** 标准答案,形状按题型;ESSAY 为参考文本可空 */
  answer?: QuestionAnswerJson | null
  analysis?: string
  /** 默认配分,缺省 5.0 */
  defaultScore?: number
  /** 多选计分规则,默认 HALF_ON_PARTIAL */
  scoreRule?: MultiScoreRule
  /** 填空大小写敏感,默认 false */
  caseSensitive?: boolean
  /** 大题必须传附件,默认 false */
  requireFile?: boolean
  /** 课程标签(与 campaignId 二选一,可都空) */
  courseId?: number
  campaignId?: number
}

/** 题库分页查询参数 GET /coursework/question-bank */
export interface QuestionBankQuery {
  page?: number
  pageSize?: number
  courseId?: number
  campaignId?: number
  type?: QuestionType
  /** 题干模糊 */
  keyword?: string
}

// ---- 作业 ----

/** 作业题目视图(详情接口):教师端恒含标准答案/解析;学生端 answer/analysis 恒为 null */
export interface AssignmentQuestionView {
  id: number
  type: QuestionType
  stem: string
  options: OptionItem[] | null
  score: number
  sortOrder: number
  /** 多选计分规则,渲染「少选得半分」等提示用 */
  scoreRule: MultiScoreRule | null
  /** 填空大小写敏感,渲染「区分大小写」提示用 */
  caseSensitive: boolean | null
  /** 大题必须上传附件,渲染提示用 */
  requireFile: boolean | null
  /** 填空题空位数(仅 FILL_BLANK;学生端渲染输入框个数用,与答案可见性无关) */
  blankCount: number | null
  /** 标准答案:教师端恒有;学生端恒 null(作答页任何档位都不下发) */
  answer: QuestionAnswerJson | null
  analysis: string | null
  /** 学生端未提交时的 Redis 草稿回显;已提交或教师端为 null */
  myAnswer: QuestionAnswerJson | null
}

/** 作业视图 GET /coursework/assignments、/{id} 与全部写操作的返回体 */
export interface AssignmentView {
  id: number
  /** ★ 锚点行 id:与你传入的可能不同,后续请求一律用它(文档 §1.6) */
  teachInfoId: number
  title: string
  content: string | null
  /** 存储相对路径(附件下载用),无附件为 null */
  fileName: string | null
  fileOriginal: string | null
  /** ISO-8601 无时区,如 "2026-10-01T23:59:00" */
  deadline: string
  /** 由题目配分求和派生(创建/修改入参 totalScore 被忽略) */
  totalScore: number
  status: AssignmentStatus
  teacherId: number
  createTime: string
  /** 答案可见性(创建时可选,默认 SUBMIT) */
  answerVisible: AnswerVisible
  // ---- 仅详情接口携带(列表恒为 null,避免 N+1) ----
  /**
   * 去重题型 code 列表:前端按它条件加载题型组件(文档 §6.1),
   * **不要遍历 questions 自行推断**(列表接口不带 questions)。
   */
  questionTypes: QuestionType[] | null
  /**
   * 是否含大题(后端下发的便捷标记)。恒等于 questionTypes 里有没有 ESSAY,
   * 故前端只按 questionTypes 分发即可 —— 保留此字段是为了与后端 DTO 保持逐字段镜像。
   */
  hasFileQuestion: boolean | null
  /** 题目列表(教师端含标准答案,学生端不含) */
  questions: AssignmentQuestionView[] | null
  // ---- 教师视角统计:仅列表/详情填充,写操作返回恒为 null(文档 §2.3) ----
  submittedCount: number | null
  gradedCount: number | null
  // ---- 学生视角「我的提交」摘要:同样只在列表/详情填充 ----
  mySubmissionId: number | null
  mySubmissionStatus: MySubmissionStatusCode | null
  myScore: number | null
  /** 1 表示迟交,0 表示按时 */
  myLate: number | null
  myVersion: number | null
}

/** 从题库抽题:score 可空 = 用题库默认配分 */
export interface QuestionRefInput {
  questionId: number
  score?: number
}

/** 作业内直接录入的题目(继承题库字段 + 本题配分 + 是否同步入题库) */
export interface QuestionInput extends QuestionSaveRequest {
  /** 本题在本作业的配分(必填,>0) */
  score: number
  /** 是否同时存入本人题库,默认 true */
  saveToBank?: boolean
}

/** 作业创建/修改请求(multipart 的 data 部分) POST /coursework/assignments */
export interface AssignmentSaveRequest {
  /** 授课组任意一行 id;创建必填,修改忽略 */
  teachInfoId?: number
  title: string
  content?: string
  /** 分片产物路径,与 multipart 的 file 部分二选一 */
  filePath?: string
  fileOriginal?: string
  /** ISO-8601 无时区 */
  deadline: string
  /**
   * true = 建完直接发布并通知学生;修改时忽略。
   * publish=true 时至少 1 道题且总分 >0,否则 400
   */
  publish?: boolean
  /** 答案可见性(默认 SUBMIT);已发布作业也可改 */
  answerVisible?: AnswerVisible
  /**
   * 题库抽题(顺序 = 本列表序 + newQuestions 序)。
   * ★ 修改语义:传了 questionIds/newQuestions 即**全量替换**题目;两个字段都不传则保留原题目。
   * 已发布作业传题目字段 → 400
   */
  questionIds?: QuestionRefInput[]
  newQuestions?: QuestionInput[]
}

/** 克隆作业请求 POST /coursework/assignments/{id}/clone(落为草稿,需另行发布) */
export interface CloneAssignmentRequest {
  /** 目标授课组(本人另一个) */
  teachInfoId: number
  /** ISO-8601 无时区 */
  deadline: string
}

/** 单题作答输入:answer 形状按题型(见 QuestionAnswerJson),null/不传 = 未答该题 */
export interface AnswerInput {
  questionId: number
  answer?: QuestionAnswerJson | null
}

/** 学生提交/重交请求(纯 JSON 全量答案) POST /coursework/assignments/{id}/submit */
export interface SubmitAnswersRequest {
  /** 全量提交,每题一条;重复 questionId → 400;允许空数组(占位提交) */
  answers: AnswerInput[]
}

/** 草稿暂存请求(只写 Redis 不落库;整体覆盖语义,空数组 = 清空) PUT /coursework/assignments/{id}/draft */
export interface DraftSaveRequest {
  answers: AnswerInput[]
}

/** 逐题批改项(仅大题;传客观题 answerId → 400) */
export interface GradeItem {
  answerId: number
  /** 0 .. 题分 */
  score: number
  comment?: string
}

/** 教师批改请求 POST /coursework/submissions/{id}/grade(全部大题判完自动合成总分并转已批改) */
export interface GradeRequest {
  items: GradeItem[]
  /** 整份评语(可空) */
  comment?: string
}

/** 逐题作答视图:题目快照 + 学生答案 + 得分;standardAnswer/analysis 按 answerVisible 门控 */
export interface AnswerView {
  answerId: number
  questionId: number
  type: QuestionType
  stem: string
  options: OptionItem[] | null
  questionScore: number
  sortOrder: number
  requireFile: boolean | null
  myAnswer: QuestionAnswerJson | null
  /** 客观题自动得分;大题为 null */
  autoScore: number | null
  /** 最终得分:客观题 = autoScore;大题未批为 null(前端据此渲染「待批」) */
  finalScore: number | null
  /** 逐题评语 */
  comment: string | null
  standardAnswer: QuestionAnswerJson | null
  analysis: string | null
}

/** 学生视角的提交详情(含 my-submission 与提交/重交的返回) */
export interface SubmissionView {
  id: number
  assignmentId: number
  submitTime: string
  /** 1 表示迟交 */
  late: number
  status: SubmissionStatus
  /** 重交会清空,回到 null;全客观作业提交即出分 */
  score: number | null
  /** 客观题自动得分合计 */
  autoScore: number | null
  comment: string | null
  /** 重交递增,第 2 次交即为 2 */
  version: number
  /** 逐题作答(my-submission/提交响应/批改响应携带) */
  answers: AnswerView[] | null
}

/** 教师视角单份提交详情 GET /coursework/submissions/{id}(恒含标准答案 + 学生信息) */
export interface TeacherSubmissionView extends SubmissionView {
  studentUserId: number
  studentName: string
  studentNo: string
}

/** 提交名单行(教师):未交学生 submitted=false、submissionId=null,其余提交字段全为 null */
export interface SubmissionRowView {
  /** 未交为 null —— 批改按钮须据此禁用 */
  submissionId: number | null
  studentUserId: number
  studentName: string
  studentNo: string
  submitted: boolean
  late: number | null
  status: SubmissionStatus | null
  /** 五态:GRADED/SUBMITTED/DRAFTING/VIEWED/NOT_VIEWED,名单进度展示用 */
  state: SubmissionState
  score: number | null
  /** 客观题自动得分合计(未交为 null) */
  autoScore: number | null
  comment: string | null
  version: number | null
  submitTime: string | null
}

// ---- 教学视频 ----

/** 视频视图 */
export interface VideoView {
  id: number
  teachInfoId: number
  title: string
  description: string | null
  /** 存储相对路径 objects/course-video/{sha256}.mp4 */
  fileName: string
  fileOriginal: string | null
  sha256: string
  /** ★ 注意是 sizeBytes,不是 size(WS meta 报文里才叫 size) */
  sizeBytes: number
  /** 服务端不解码视频,由前端解析后回传;未回传则为 null */
  durationSec: number | null
  sortNo: number
  createTime: string
}

/** 视频登记请求(multipart 的 data 部分) POST /coursework/videos */
export interface VideoSaveRequest {
  teachInfoId: number
  title: string
  description?: string
  /** 与 multipart 的 file 部分二选一(视频一般走分片) */
  filePath?: string
  fileOriginal?: string
  durationSec?: number
  sortNo?: number
}

/** 视频元数据修改(JSON;文件本体不可换 = 删除重传) PUT /coursework/videos/{id} */
export interface VideoUpdateRequest {
  title?: string
  description?: string
  sortNo?: number
  durationSec?: number
}

/** WS open 的 meta 应答与 VideoStreamSocket 用到的元数据 */
export interface VideoMeta {
  type: 'meta'
  videoId: number
  /** 文件总字节数(对应 HTTP 侧的 sizeBytes) */
  size: number
  sha256: string
  durationSec: number | null
}

// ---- 课程资料 ----

/** 资料视图 */
export interface MaterialView {
  id: number
  teachInfoId: number
  title: string
  description: string | null
  /** 存储相对路径,下载时作为 filePath 传回 */
  fileName: string
  fileOriginal: string | null
  fileExt: string
  sizeBytes: number
  createTime: string
}

/** 资料上传请求(multipart 的 data 部分) POST /coursework/materials */
export interface MaterialSaveRequest {
  teachInfoId: number
  title: string
  description?: string
  filePath?: string
  fileOriginal?: string
}

/** 资料元数据修改(JSON;文件本体不可替换) PUT /coursework/materials/{id} */
export interface MaterialUpdateRequest {
  title?: string
  description?: string
}

// ---- 课程公告 ----

/** 公告视图 */
export interface AnnouncementView {
  id: number
  teachInfoId: number
  title: string
  content: string
  teacherId: number
  createTime: string
  /** 编辑后才有别于 createTime */
  updateTime: string
}

/** 公告发布/编辑请求(JSON):编辑只改内容不发通知,属刻意设计 */
export interface AnnouncementSaveRequest {
  /** 创建必填,修改忽略 */
  teachInfoId?: number
  title: string
  content: string
}

// ---- 平时分合成 ----

/** 平时分合成结果 POST /coursework/teach-infos/{teachInfoId}/regular-score/sync */
export interface RegularScoreSyncView {
  /** 成功写入平时分的学生数 */
  updatedCount: number
  /** 成绩已锁定被跳过的学生 user.id */
  skippedLockedUserIds: number[]
  /** 无已批改作业被跳过的学生 user.id */
  skippedUngradedUserIds: number[]
}

// ---- 通用文件下载 ----

/** 通用下载请求体 POST /file/download */
export interface FileDownloadRequest {
  /** 存储相对路径,形如 objects/{biz}/{sha256}{ext} */
  filePath: string
  /** 展示文件名(Content-Disposition);留空回退磁盘文件名 */
  originalName?: string
}

// ---- 课程选择器 ----

/**
 * 课程选择器的一项,由 GET /teach-info 的课程列表去重而来。
 * 同一门课因多个上课时段会在 teach_info 里对应多行,但对课业而言是同一门 ——
 * 故按「课程 + 教师 + 班级 + 学期」收敛成一项,id 取组内最小值(尽量贴近服务端锚点行)。
 */
export interface CourseOption {
  /** 授课组任意一行的 id;服务端会归一到锚点行,后续请求应改用响应里返回的 teachInfoId */
  id: number
  courseName: string
  teacherName: string
  className: string
  /** 下拉里展示的完整文案 */
  label: string
}
