<script setup lang="ts">
/**
 * 克隆作业到本人另一个授课组(题目快照与作业附件引用随复制,落为草稿需另行发布)。
 *
 * 目标授课组的选项与课程选择器同源(GET /teach-info 收敛),但排除源作业所在的锚点行 ——
 * 克隆的语义是「另一个授课组」。源作业无题目时后端 400,错误直接走 api 层提示。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NForm,
  NFormItem,
  NSelect,
  NDatePicker,
  NButton,
  NSpace,
  useMessage,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { useLoading } from '@/shared/composables/useLoading'
import { useLocaleStore } from '@/stores/useLocaleStore'
import { fetchTeachInfoList } from '@/modules/curriculum/api'
import { cloneAssignment } from '../api'
import { buildCourseOptions } from '../utils'
import type { AssignmentView, CourseOption } from '../types'

const props = defineProps<{
  show: boolean
  /** 源作业(克隆它) */
  assignment: AssignmentView | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  cloned: []
}>()

const { t } = useI18n()
const message = useMessage()
const localeStore = useLocaleStore()
const dateLocale = computed(() => localeStore.naiveConfig().dateLocale)

const targetTeachInfoId = ref<number | null>(null)
const deadline = ref<string | null>(null)
const courses = ref<CourseOption[]>([])
const { loading: saving, withLoading: withSaving } = useLoading()

const targetOptions = computed(() =>
  courses.value
    .filter((c) => c.id !== props.assignment?.teachInfoId)
    .map((c) => ({ label: c.label, value: c.id })),
)

watch(
  () => props.show,
  (show) => {
    if (!show) return
    targetTeachInfoId.value = null
    deadline.value = null
    void (async () => {
      try {
        const res = await fetchTeachInfoList()
        courses.value = buildCourseOptions(res.data?.courses ?? [], false)
      } catch {
        courses.value = []
      }
    })()
  },
)

function close(): void {
  emit('update:show', false)
}

function handleClone() {
  const source = props.assignment
  const teachInfoId = targetTeachInfoId.value
  const dl = deadline.value
  if (!source) return
  if (teachInfoId == null) {
    message.warning(t('coursework.assignment.cloneTargetRequired'))
    return
  }
  if (!dl) {
    message.warning(t('coursework.assignment.deadlineRequired'))
    return
  }
  return withSaving(async () => {
    try {
      await cloneAssignment(source.id, { teachInfoId, deadline: dl })
      message.success(t('coursework.assignment.cloneSuccess'))
      close()
      emit('cloned')
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.operationFail'))
      }
    }
  })
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="coursework-modal"
    :title="`${t('coursework.assignment.cloneTitle')}${assignment ? ` - ${assignment.title}` : ''}`"
    @update:show="emit('update:show', $event)"
  >
    <NForm label-placement="top">
      <NFormItem :label="t('coursework.assignment.cloneTarget')" required>
        <NSelect
          v-model:value="targetTeachInfoId"
          :options="targetOptions"
          :placeholder="t('coursework.common.selectCourse')"
          class="full-width"
        />
      </NFormItem>
      <NFormItem :label="t('coursework.assignment.deadline')" required>
        <NDatePicker
          v-model:formatted-value="deadline"
          type="datetime"
          value-format="yyyy-MM-dd'T'HH:mm:ss"
          :locale="dateLocale"
          clearable
          class="full-width"
        />
      </NFormItem>
      <NFormItem>
        <span class="clone-tip">{{ t('coursework.assignment.cloneTip') }}</span>
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="close">{{ t('coursework.common.cancel') }}</NButton>
        <NButton type="primary" :loading="saving" @click="handleClone">
          {{ t('coursework.assignment.clone') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped src="./AssignmentFormModal.css"></style>

<style>
.coursework-modal {
  width: 640px;
  max-width: 92vw;
}
</style>
