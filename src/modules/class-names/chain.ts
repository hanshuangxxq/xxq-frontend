/**
 * 学籍归属链（院系 → 专业 → 班级 → 学生）的前端名称推导。
 *
 * 服务端的 {@link ClassName} 是裸实体，只有 majorId，不含 majorName / collegeName；
 * 学生也不再有「自己的专业」（学生的专业 = 其班级的专业）。列表页要显示名称时，
 * 用本模块在本地建一次索引按 id 映射 —— **不要逐行发请求**。
 *
 * 链上任一跳为空则下游全为空（服务端的静默失败语义）：
 * 班级没专业 → 该班所有学生没有专业与院系。因此所有解析函数在缺环时返回 null，
 * 调用方须按「正常空值」处理，而不是当异常。
 */
import type { College } from '@/modules/college/types'
import type { Major } from '@/modules/majors/types'
import type { ClassName } from './types'

/** 专业 id -> 专业（含所属院系 id） */
export type MajorById = Map<number, Major>

/** 院系 id -> 院系名 */
export type CollegeNameById = Map<number, string>

export function indexMajors(majors: Major[]): MajorById {
  return new Map(majors.map((m) => [m.id, m]))
}

export function indexColleges(colleges: College[]): CollegeNameById {
  return new Map(colleges.map((c) => [c.id, c.collegeName]))
}

/** 专业 -> 专业名；专业不存在或索引未加载时为 null */
export function majorNameOf(
  majorId: number | null | undefined,
  majorById: MajorById,
): string | null {
  if (majorId == null) return null
  return majorById.get(majorId)?.majorName ?? null
}

/** 班级 -> 专业名（一跳：班级 → major.majorName）；班级未挂专业时为 null */
export function majorNameOfClass(
  cls: ClassName | null | undefined,
  majorById: MajorById,
): string | null {
  return majorNameOf(cls?.majorId, majorById)
}

/** 班级 -> 院系名（两跳：班级 → major.collegeId → 院系）；任一跳缺失时为 null */
export function collegeNameOfClass(
  cls: ClassName | null | undefined,
  majorById: MajorById,
  collegeNameById: CollegeNameById,
): string | null {
  const major = cls?.majorId != null ? majorById.get(cls.majorId) : undefined
  if (major?.collegeId == null) return null
  return collegeNameById.get(major.collegeId) ?? null
}

/**
 * 班级下拉展示文案：`班级名（专业名）`。
 * 专业名缺失时仅显示班级名 —— 链断掉是正常状态，不额外拼占位符。
 */
export function classNameLabel(cls: ClassName, majorById: MajorById): string {
  const name = majorNameOfClass(cls, majorById)
  return name ? `${cls.className} (${name})` : cls.className
}
