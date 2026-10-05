<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect, NSpace, NText } from 'naive-ui'
import { useAuthStore } from '@/stores/useAuthStore'
import { useLoading } from '@/shared/composables/useLoading'
import { fetchTeachInfoList } from '@/modules/curriculum/api'
import { buildCourseOptions } from '../utils'
import type { CourseOption } from '../types'

/**
 * 课业上下文选择器：作业/视频/资料/公告四个子域共享同一门课,故课程只在这里选一次。
 *
 * - 数据源 GET /teach-info：后端按登录身份返回「本人的课」(教师=任课,学生=本班+选课班),
 *   每行都带 id = teachInfoId;去重与学期收敛的规则见 buildCourseOptions
 * - 选中项按角色记忆到 localStorage,切换课程即整体刷新下方数据
 * - 教师端不显示教师名,学生端显示(公选课会有同名课由不同教师开设)
 */
const props = defineProps<{ courseId: number | null }>()

const emit = defineEmits<{ 'update:courseId': [value: number | null] }>()

const { t } = useI18n()
const authStore = useAuthStore()

const courses = ref<CourseOption[]>([])
const { loading, withLoading } = useLoading()

const isStudent = computed(() => authStore.user?.userType === 'student')
const storageKey = computed(() => `coursework.course.${authStore.user?.userType ?? 'unknown'}`)

const options = computed(() => courses.value.map((c) => ({ label: c.label, value: c.id })))

const current = computed<CourseOption | null>(
  () => courses.value.find((c) => c.id === props.courseId) ?? null,
)

function loadCourses(): Promise<void> {
  return withLoading(async () => {
    try {
      const listRes = await fetchTeachInfoList()
      courses.value = buildCourseOptions(listRes.data?.courses ?? [], isStudent.value)
      // 优先恢复记忆的课程,否则默认选第一门
      const remembered = localStorage.getItem(storageKey.value)
      const hit =
        courses.value.find((c) => String(c.id) === remembered) ?? courses.value[0] ?? null
      if (hit && hit.id !== props.courseId) {
        emit('update:courseId', hit.id)
        localStorage.setItem(storageKey.value, String(hit.id))
      } else if (!hit) {
        emit('update:courseId', null)
      }
    } catch {
      courses.value = []
    }
  })
}

function handleChange(id: number | null) {
  emit('update:courseId', id)
  if (id != null) localStorage.setItem(storageKey.value, String(id))
}

// 首屏加载在 setup 内同步发起(而非等 onMounted):保证首帧渲染时 loading 已为 true,
// 「无课程」占位不会在「首帧闪现 → 加载开始消失 → 加载结束复现」之间抖动造成闪屏
void loadCourses()
</script>

<template>
  <div class="course-context-selector">
    <NSpace align="center" :size="12">
      <NSelect
        class="course-select"
        :value="courseId"
        :options="options"
        :loading="loading"
        :placeholder="t('coursework.common.selectCourse')"
        @update:value="handleChange"
      />
      <NText v-if="current" depth="3" class="course-meta">
        {{ current.className }}
      </NText>
      <NText v-else-if="!loading" depth="3" class="course-meta">
        {{ t('coursework.common.noCourse') }}
      </NText>
    </NSpace>
  </div>
</template>

<style scoped src="./CourseContextSelector.css"></style>
