<script setup lang="ts">
/**
 * 题库课程标签选择器:常规课与公选活动**二选一**(可清空 = 不设标签)。
 *
 * 值用课程复合键 `source:id` —— 后端的 courseId(常规课)与 campaignId(公选活动)是两个字段、
 * 分别来自 course 表与 selection_campaign 表,两张表 id 可能重复,单看 id 分不清;
 * 提交时由 coursework/utils 的 courseTagFields 拆回对应字段(只出现一个,天然满足二选一)。
 *
 * 数据源 GET /courses(@RequireLogin,分页,端点不支持按名搜索):常规课 + 后端合成的公选课条目,
 * 后者的 id 就是 campaignId,正好覆盖题库的两个标签字段,故不必再调选课模块。
 * 拉取方式沿用「小窗口分页下拉」PagedSelect,与排课/补考/时段预留的选课一致。
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import { fetchCourse, fetchCourses } from '@/modules/course/api'
import { courseKey, isPublicCourse, parseCourseKey } from '@/modules/course/utils'
import type { Course } from '@/modules/course/types'

const props = defineProps<{
  /** 课程复合键 `MANUAL:12` / `SELECTION_CAMPAIGN:3`,null = 未设置 */
  modelValue: string | null
  /** 不传则用题库的默认占位文案 */
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const { t } = useI18n()

/** value -> label 缓存:选中项不在当前加载页时靠它回显,否则会退化成裸复合键 */
const labelCache = ref<Record<string, string>>({})

/** 端点无关键字搜索,每页给足条数减少翻页 */
const PAGE_SIZE = 50

const fetchPage = (page: number, pageSize: number) => fetchCourses(page, pageSize)
const labelOf = (c: Course) =>
  isPublicCourse(c) ? `${c.courseName}（${t('common.publicTag')}）` : c.courseName
const valueOf = (c: Course) => courseKey(c.id, c.source)

/**
 * 编辑回显:选中值不在已加载页时补一次详情查询把它还原成课程名。
 * 失败不阻断选择 —— 显示复合键也能用,重选一次即可。
 */
async function resolveLabel(key: string): Promise<void> {
  const { id, source } = parseCourseKey(key)
  if (!Number.isFinite(id)) return
  try {
    const res = await fetchCourse(id, source, { loading: false })
    labelCache.value = { ...labelCache.value, [key]: labelOf(res.data) }
  } catch {
    // 静默:回显失败不影响标签值本身
  }
}

watch(
  () => props.modelValue,
  (key) => {
    if (key && !labelCache.value[key]) void resolveLabel(key)
  },
  { immediate: true },
)

function handleUpdate(value: string | number | null | Array<string | number>): void {
  emit('update:modelValue', value == null ? null : String(value))
}
</script>

<template>
  <PagedSelect
    class="course-tag-select"
    :model-value="modelValue"
    :fetch-page="fetchPage"
    :label-of="labelOf"
    :value-of="valueOf"
    :page-size="PAGE_SIZE"
    :initial-labels="labelCache"
    :placeholder="placeholder ?? t('coursework.question.courseTagPlaceholder')"
    clearable
    filterable
    @update:model-value="handleUpdate"
  />
</template>

<style scoped src="./CourseTagSelect.css"></style>
