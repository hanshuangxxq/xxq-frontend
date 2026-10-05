<script setup lang="ts">
/**
 * 教师：课程公告管理（发布 / 编辑 / 删除）。
 * 列表接口不分页，按 createTime 倒序返回。编辑不会重复通知学生（刻意设计）。
 */
import { computed, h, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NDataTable,
  NButton,
  NSpace,
  NPopconfirm,
  NText,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { formatDateTime } from '@/shared/utils/format'
import { useLoading } from '@/shared/composables/useLoading'
import EmptyState from '@/shared/components/EmptyState.vue'
import { deleteAnnouncement, fetchAnnouncements } from '../api'
import AnnouncementFormModal from './AnnouncementFormModal.vue'
import type { AnnouncementView } from '../types'
import { useCourseAnchor } from '../useCourseAnchor'

const props = defineProps<{ courseId: number | null }>()

/** 请求一律用锚点 id(文档 §1.6):服务端回带的 teachInfoId 才回写进 anchorId */
const { anchorId, adopt } = useCourseAnchor(() => props.courseId)

const { t } = useI18n()
const message = useMessage()

const rows = ref<AnnouncementView[]>([])
const { loading, withLoading } = useLoading()

const showForm = ref(false)
const editing = ref<AnnouncementView | null>(null)
const deletingId = ref<number | null>(null)

function loadData(): Promise<void> {
  const id = anchorId.value
  if (id == null) {
    rows.value = []
    return Promise.resolve()
  }
  return withLoading(async () => {
    try {
      const res = await fetchAnnouncements(id)
      rows.value = res.data
      // 列表回带的是锚点行 id,采纳后发布/编辑/删除等后续请求都用它
      adopt(res.data[0]?.teachInfoId)
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.loadFail'))
      }
      rows.value = []
    }
  })
}

watch(() => props.courseId, () => void loadData(), { immediate: true })

function openCreate() {
  editing.value = null
  showForm.value = true
}

function openEdit(row: AnnouncementView): void {
  editing.value = row
  showForm.value = true
}

function handleDelete(row: AnnouncementView) {
  return withLoading(async () => {
    deletingId.value = row.id
    try {
      await deleteAnnouncement(row.id)
      message.success(t('coursework.common.deleteSuccess'))
      await loadData()
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.deleteFail'))
      }
    } finally {
      deletingId.value = null
    }
  })
}

const columns = computed<DataTableColumns<AnnouncementView>>(() => [
  {
    title: t('coursework.announcement.title'),
    key: 'title',
    minWidth: 180,
    ellipsis: { tooltip: true },
  },
  {
    title: t('coursework.announcement.content'),
    key: 'content',
    minWidth: 260,
    ellipsis: { tooltip: true },
  },
  {
    title: t('coursework.announcement.publishTime'),
    key: 'createTime',
    width: 160,
    render: (row) => formatDateTime(row.createTime),
  },
  {
    title: t('coursework.common.actions'),
    key: 'actions',
    width: 160,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8, wrap: false }, () => [
        h(NButton, { size: 'small', onClick: () => openEdit(row) }, () =>
          t('coursework.common.edit'),
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            default: () => t('coursework.announcement.deleteConfirm'),
            trigger: () =>
              h(
                NButton,
                { size: 'small', type: 'error', loading: deletingId.value === row.id },
                () => t('coursework.common.delete'),
              ),
          },
        ),
      ]),
  },
])

const rowKey = (row: AnnouncementView) => row.id
</script>

<template>
  <div class="tab-body">
    <div class="tab-toolbar">
      <NText depth="3" class="tab-hint">{{ t('coursework.announcement.publishNotifyTip') }}</NText>
      <NButton type="primary" :disabled="courseId == null" @click="openCreate">
        {{ t('coursework.announcement.addTitle') }}
      </NButton>
    </div>
    <EmptyState
      v-if="!loading && courseId != null && !rows.length"
      :description="t('coursework.common.empty')"
    />
    <NDataTable
      v-else-if="rows.length"
      :columns="columns"
      :data="rows"
      :row-key="rowKey"
      :pagination="false"
      :single-line="false"
      :bordered="false"
      :scroll-x="900"
    />

    <AnnouncementFormModal
      v-model:show="showForm"
      :course-id="anchorId ?? 0"
      :announcement="editing"
      @saved="loadData"
    />
  </div>
</template>

<style scoped src="./TabShared.css"></style>
