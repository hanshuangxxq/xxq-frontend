<script setup lang="ts">
/**
 * 教师发布/编辑课程公告弹窗（纯 JSON，无文件）。
 *
 * 契约要点：**编辑不重复通知学生**，这是刻意设计（避免改个错别字就给学生推一遍消息）。
 * 发布则会通知授课组全体学生 —— 两种模式各给一句提示，别让教师误以为编辑也会通知。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NForm, NFormItem, NInput, NButton, NSpace, NText, useMessage } from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { useLoading } from '@/shared/composables/useLoading'
import { createAnnouncement, updateAnnouncement } from '../api'
import type { AnnouncementView } from '../types'

const props = defineProps<{
  show: boolean
  courseId: number
  /** null = 发布新公告；非 null = 编辑该公告 */
  announcement: AnnouncementView | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const message = useMessage()

const isEdit = computed(() => props.announcement !== null)
const form = ref({ title: '', content: '' })
const { loading: saving, withLoading: withSaving } = useLoading()

watch(
  () => [props.show, props.announcement] as const,
  ([show]) => {
    if (!show) return
    const a = props.announcement
    form.value = { title: a?.title ?? '', content: a?.content ?? '' }
  },
  { immediate: true },
)

function handleSave() {
  const f = form.value
  if (!f.title.trim()) {
    message.warning(t('coursework.announcement.titleRequired'))
    return
  }
  if (!f.content.trim()) {
    message.warning(t('coursework.announcement.contentRequired'))
    return
  }
  return withSaving(async () => {
    try {
      const existing = props.announcement
      if (existing) {
        await updateAnnouncement(existing.id, { title: f.title.trim(), content: f.content.trim() })
      } else {
        await createAnnouncement({
          teachInfoId: props.courseId,
          title: f.title.trim(),
          content: f.content.trim(),
        })
      }
      message.success(
        t(existing ? 'coursework.announcement.editSuccess' : 'coursework.announcement.publishSuccess'),
      )
      emit('update:show', false)
      emit('saved')
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
    :title="isEdit ? t('coursework.announcement.editTitle') : t('coursework.announcement.addTitle')"
    @update:show="emit('update:show', $event)"
  >
    <NForm :model="form" label-placement="top">
      <NFormItem :label="t('coursework.announcement.title')" required>
        <NInput v-model:value="form.title" maxlength="100" show-count />
      </NFormItem>
      <NFormItem :label="t('coursework.announcement.content')" required>
        <NInput v-model:value="form.content" type="textarea" :rows="6" />
      </NFormItem>
      <NFormItem>
        <NText depth="3" class="form-hint">
          {{
            t(
              isEdit
                ? 'coursework.announcement.editNoNotifyTip'
                : 'coursework.announcement.publishNotifyTip',
            )
          }}
        </NText>
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">{{ t('coursework.common.cancel') }}</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">
          {{ t('coursework.common.save') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped src="./AnnouncementFormModal.css"></style>

<style>
.coursework-modal {
  width: 640px;
  max-width: 92vw;
}
</style>
