import type { BizCode } from '@/modules/file/types'

/**
 * 课业各子域对应的文件业务目录。客户端**不能自造目录**,非法值后端直接 400 ——
 * 这里收成常量,页面与弹窗一律引用,避免各写一遍字符串写错。
 * 取值与扩展名白名单见文档 §1.8 与后端 FileBizEnum。
 */
export const ASSIGNMENT_BIZ: BizCode = 'course-assignment'
export const SUBMISSION_BIZ: BizCode = 'course-assignment-submission'
export const VIDEO_BIZ: BizCode = 'course-video'
export const MATERIAL_BIZ: BizCode = 'course-material'

/** 作业列表分页大小(后端默认 20、上限 100) */
export const DEFAULT_PAGE_SIZE = 20
