import { api } from '@/shared/api'
import type { PageResult, Result } from '@/shared/types'
import type { PreparedSubmitFile } from '@/modules/file/types'
import type {
  AnnouncementSaveRequest,
  AnnouncementView,
  AssignmentSaveRequest,
  AssignmentView,
  CloneAssignmentRequest,
  DraftSaveRequest,
  FileDownloadRequest,
  GradeRequest,
  MaterialSaveRequest,
  MaterialUpdateRequest,
  MaterialView,
  QuestionBankQuery,
  QuestionSaveRequest,
  QuestionView,
  RegularScoreSyncView,
  SubmissionRowView,
  SubmissionView,
  SubmitAnswersRequest,
  TeacherSubmissionView,
  VideoSaveRequest,
  VideoUpdateRequest,
  VideoView,
} from './types'

const BASE = '/coursework'

/**
 * 课程课业模块接口(docs/课程课业模块-前端对接文档.md)。
 *
 * 三条全局约定,写调用方时务必记住:
 * 1. **`teachInfoId` 传授课组任意一行的 id 都行**,服务端归一;但返回的一律是锚点行 id,
 *    后续请求请改用响应里返回的那个(文档 §1.6)。
 * 2. **业务错误是 HTTP 200 + body.code**,不是 HTTP 状态码;归属类 403 也走这条路。
 *    需要据 code 分支的调用方请传 `{ silent: true }`,否则 api 层会先弹一次 toast。
 * 3. **写操作(新建/修改/发布/关闭/替换附件)返回的统计与「我的提交」字段全是 null**,
 *    它们只在列表/详情里填充 —— 想立刻显示「已交 0 / 已批 0」必须重新拉列表(文档 §2.3)。
 */

// ---- 作业:教师写操作 ----

/** 新建作业(建完可直接发布并通知学生) POST /coursework/assignments [multipart] */
export function createAssignment(
  data: AssignmentSaveRequest,
  file: PreparedSubmitFile,
): Promise<Result<AssignmentView>> {
  return postMultipart(`${BASE}/assignments`, data, file)
}

/** 修改作业(JSON;已发布后只能延长截止时间、不能改满分) PUT /coursework/assignments/{id} */
export function updateAssignment(
  id: number,
  data: AssignmentSaveRequest,
): Promise<Result<AssignmentView>> {
  return api.put(`${BASE}/assignments/${id}`, data)
}

/**
 * 替换作业附件 POST /coursework/assignments/{id}/attachment [multipart]。
 * 只传文件本身,不带 data 里的作业字段 —— 附件是独立的一次覆盖写。
 */
export function replaceAssignmentAttachment(
  id: number,
  file: PreparedSubmitFile,
): Promise<Result<AssignmentView>> {
  return postMultipart(`${BASE}/assignments/${id}/attachment`, {}, file)
}

/** 删除作业(**仅草稿可删**,已发布返回 409) DELETE /coursework/assignments/{id} */
export function deleteAssignment(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/assignments/${id}`)
}

/** 发布作业(通知授课组全体学生) POST /coursework/assignments/{id}/publish */
export function publishAssignment(id: number): Promise<Result<AssignmentView>> {
  return api.post(`${BASE}/assignments/${id}/publish`)
}

/** 关闭作业(关闭后拒绝提交) POST /coursework/assignments/{id}/close */
export function closeAssignment(id: number): Promise<Result<AssignmentView>> {
  return api.post(`${BASE}/assignments/${id}/close`)
}

/**
 * 克隆作业到本人另一个授课组 POST /coursework/assignments/{id}/clone。
 * 题目快照与作业附件引用随复制,落为**草稿**(需另行发布);源作业无题目 → 400。
 */
export function cloneAssignment(
  id: number,
  data: CloneAssignmentRequest,
): Promise<Result<AssignmentView>> {
  return api.post(`${BASE}/assignments/${id}/clone`, data)
}

// ---- 作业:双视角读 ----

/**
 * 作业分页列表(按登录角色返回不同内容:教师含草稿+统计,学生仅已发布/已关闭+我的提交摘要)
 * GET /coursework/assignments —— 默认 20、上限 100(题库 question-bank 是分页的另一接口)。
 */
export function fetchAssignments(
  teachInfoId: number,
  page?: number,
  pageSize?: number,
): Promise<Result<PageResult<AssignmentView>>> {
  const params = new URLSearchParams({ teachInfoId: String(teachInfoId) })
  if (page != null) params.set('page', String(page))
  if (pageSize != null) params.set('pageSize', String(pageSize))
  return api.get(`${BASE}/assignments?${params.toString()}`)
}

/** 作业详情(双视角;学生看草稿会得到 code 404) GET /coursework/assignments/{id} */
export function fetchAssignmentDetail(
  id: number,
  options?: { silent?: boolean },
): Promise<Result<AssignmentView>> {
  return api.get(`${BASE}/assignments/${id}`, options)
}

// ---- 作业:学生 ----

/**
 * 提交/重交作业 POST /coursework/assignments/{id}/submit(**纯 JSON**,不再是 multipart)。
 * 全量答案,每题一条;大题附件必须先经文件模块上传拿 path 再放进 answer.files。
 * 全客观作业提交即已批改出分;含大题则为已提交待批。重交全量替换、清批改痕迹、version+1。
 */
export function submitAssignment(
  id: number,
  data: SubmitAnswersRequest,
): Promise<Result<SubmissionView>> {
  return api.post(`${BASE}/assignments/${id}/submit`, data)
}

/**
 * 暂存草稿 PUT /coursework/assignments/{id}/draft。
 * 只写 Redis 不落库,整体覆盖语义(传什么存什么,空数组 = 清空)。
 * 按题防抖调用,属后台请求:不挂全局加载,失败由调用方自行提示。
 */
export function saveAssignmentDraft(id: number, data: DraftSaveRequest): Promise<Result<null>> {
  return api.put(`${BASE}/assignments/${id}/draft`, data, { loading: false, silent: true })
}

/** 我的提交 GET /coursework/assignments/{id}/my-submission —— **未提交时 data 为 null**,不是 404 */
export function fetchMySubmission(id: number): Promise<Result<SubmissionView | null>> {
  return api.get(`${BASE}/assignments/${id}/my-submission`)
}

// ---- 作业:教师批改 ----

/** 提交名单(完整花名册,未交学生也在列,按学号升序;不分页) GET /coursework/assignments/{id}/submissions */
export function fetchSubmissions(id: number): Promise<Result<SubmissionRowView[]>> {
  return api.get(`${BASE}/assignments/${id}/submissions`)
}

/** 教师视角单份提交详情(恒含标准答案) GET /coursework/submissions/{id} */
export function fetchSubmissionDetail(id: number): Promise<Result<TeacherSubmissionView>> {
  return api.get(`${BASE}/submissions/${id}`)
}

/**
 * 逐题批改 POST /coursework/submissions/{id}/grade。
 * items 仅大题(客观题不可改判,传了 400);score ∈ [0, 题分]。
 * 全部大题判完自动合成总分并转「已批改」;改判再次调用即可(不重复通知学生)。
 */
export function gradeSubmission(
  id: number,
  data: GradeRequest,
): Promise<Result<TeacherSubmissionView>> {
  return api.post(`${BASE}/submissions/${id}/grade`, data)
}

// ---- 题库(教师个人) ----

/** 题库分页查询 GET /coursework/question-bank(课程标签/题型/题干关键词筛选) */
export function fetchQuestionBank(
  query: QuestionBankQuery,
): Promise<Result<PageResult<QuestionView>>> {
  const params = new URLSearchParams()
  if (query.page != null) params.set('page', String(query.page))
  if (query.pageSize != null) params.set('pageSize', String(query.pageSize))
  if (query.courseId != null) params.set('courseId', String(query.courseId))
  if (query.campaignId != null) params.set('campaignId', String(query.campaignId))
  if (query.type != null) params.set('type', query.type)
  if (query.keyword) params.set('keyword', query.keyword)
  const qs = params.toString()
  return api.get(`${BASE}/question-bank${qs ? `?${qs}` : ''}`)
}

/** 题库录入 POST /coursework/question-bank */
export function createBankQuestion(data: QuestionSaveRequest): Promise<Result<QuestionView>> {
  return api.post(`${BASE}/question-bank`, data)
}

/** 题库修改(全量字段,传 null 即清空) PUT /coursework/question-bank/{id} */
export function updateBankQuestion(
  id: number,
  data: QuestionSaveRequest,
): Promise<Result<QuestionView>> {
  return api.put(`${BASE}/question-bank/${id}`, data)
}

/**
 * 题库软删 DELETE /coursework/question-bank/{id}。
 * 已被作业引用的题可删 —— 作业里是快照副本,不受影响。
 */
export function deleteBankQuestion(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/question-bank/${id}`)
}

// ---- 教学视频 ----

/** 登记视频 POST /coursework/videos [multipart] */
export function registerVideo(
  data: VideoSaveRequest,
  file: PreparedSubmitFile,
): Promise<Result<VideoView>> {
  return postMultipart(`${BASE}/videos`, data, file)
}

/** 改视频元数据(JSON;文件本体不可换) PUT /coursework/videos/{id} */
export function updateVideo(id: number, data: VideoUpdateRequest): Promise<Result<VideoView>> {
  return api.put(`${BASE}/videos/${id}`, data)
}

/** 删除视频 DELETE /coursework/videos/{id} */
export function deleteVideo(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/videos/${id}`)
}

/** 视频列表(不分页,按 sortNo 升序、id 升序) GET /coursework/videos?teachInfoId= */
export function fetchVideos(teachInfoId: number): Promise<Result<VideoView[]>> {
  return api.get(`${BASE}/videos?teachInfoId=${teachInfoId}`)
}

/**
 * 视频元数据(播放前拿 sizeBytes/sha256) GET /coursework/videos/{id}。
 * 播放器还拿它当**握手失败的探测请求**(WS 失败时另发一次问真实原因),
 * 那种场景要传 `{ silent: true, loading: false }` —— 否则探测失败会再弹一次 toast
 * 盖在播放器自己的错误文案上,还会白闪一下全局加载药丸。
 */
export function fetchVideoDetail(
  id: number,
  options?: { silent?: boolean; loading?: boolean },
): Promise<Result<VideoView>> {
  return api.get(`${BASE}/videos/${id}`, options)
}

// ---- 课程资料 ----

/** 上传资料 POST /coursework/materials [multipart] */
export function uploadMaterial(
  data: MaterialSaveRequest,
  file: PreparedSubmitFile,
): Promise<Result<MaterialView>> {
  return postMultipart(`${BASE}/materials`, data, file)
}

/** 改资料标题/描述(JSON;文件本体不可替换,换文件=删除重传) PUT /coursework/materials/{id} */
export function updateMaterial(
  id: number,
  data: MaterialUpdateRequest,
): Promise<Result<MaterialView>> {
  return api.put(`${BASE}/materials/${id}`, data)
}

/** 删除资料 DELETE /coursework/materials/{id} */
export function deleteMaterial(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/materials/${id}`)
}

/** 资料列表(不分页,createTime 倒序) GET /coursework/materials?teachInfoId= */
export function fetchMaterials(teachInfoId: number): Promise<Result<MaterialView[]>> {
  return api.get(`${BASE}/materials?teachInfoId=${teachInfoId}`)
}

// ---- 课程公告 ----

/** 发布公告(JSON,**会通知授课组全体学生**) POST /coursework/announcements */
export function createAnnouncement(
  data: AnnouncementSaveRequest,
): Promise<Result<AnnouncementView>> {
  return api.post(`${BASE}/announcements`, data)
}

/** 编辑公告(JSON,**刻意不重复通知**,避免改错别字就给学生推一遍) PUT /coursework/announcements/{id} */
export function updateAnnouncement(
  id: number,
  data: AnnouncementSaveRequest,
): Promise<Result<AnnouncementView>> {
  return api.put(`${BASE}/announcements/${id}`, data)
}

/** 删除公告 DELETE /coursework/announcements/{id} */
export function deleteAnnouncement(id: number): Promise<Result<null>> {
  return api.delete(`${BASE}/announcements/${id}`)
}

/** 公告列表(不分页,createTime 倒序) GET /coursework/announcements?teachInfoId= */
export function fetchAnnouncements(teachInfoId: number): Promise<Result<AnnouncementView[]>> {
  return api.get(`${BASE}/announcements?teachInfoId=${teachInfoId}`)
}

// ---- 平时分合成 ----

/**
 * 由作业成绩合成平时分(无请求体) POST /coursework/teach-infos/{teachInfoId}/regular-score/sync。
 * 覆盖式重算、可反复点;已锁定(locked=1)的成绩行不会被覆盖。
 * 没有已发布作业 / 一份都没批改时返回 code 400(而不是静默成功)。
 */
export function syncRegularScore(teachInfoId: number): Promise<Result<RegularScoreSyncView>> {
  return api.post(`${BASE}/teach-infos/${teachInfoId}/regular-score/sync`)
}

// ---- 文件下载 ----

/**
 * 通用文件下载 POST /file/download(路径不进 URL/历史/网关日志,故后端用 POST 承载)。
 * filePath 传列表里的 fileName,originalName 传 fileOriginal 以还原展示文件名。
 */
export function downloadCourseFile(
  filePath: string,
  originalName?: string | null,
): Promise<void> {
  const body: FileDownloadRequest = {
    filePath,
    ...(originalName ? { originalName } : {}),
  }
  return api.downloadPost('/file/download', body, {
    fallbackName: originalName ?? filePath.split('/').pop() ?? 'download',
  })
}

// ---- 内部:multipart 组装 ----

/**
 * 课业带文件的端点统一是 POST + multipart,data 为必填 part(JSON 内容)、file 为选填 part。
 * `file` 与 `data.filePath` 只能二选一 —— 由 prepareSubmitFile 的返回形态天然保证
 * (≤20MB 给 file,>20MB 给 filePath),同时给会被后端 400(文档 §1.7)。
 *
 * 注意:data part 的 Content-Type 必须是 application/json,整体 Content-Type 不能手设 ——
 * 必须让浏览器补上 multipart 的 boundary,故走 api.postForm。
 */
function postMultipart<T>(url: string, data: object, file: PreparedSubmitFile): Promise<Result<T>> {
  // 各端点的请求 DTO 是具体接口而非索引签名,这里显式展开成可写字典再挂文件字段
  const payload: Record<string, unknown> = { ...data }
  if (file.filePath) {
    payload.filePath = file.filePath
    payload.fileOriginal = file.fileOriginal ?? undefined
  }
  const fd = new FormData()
  fd.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
  if (file.file) fd.append('file', file.file)
  return api.postForm(url, fd)
}
