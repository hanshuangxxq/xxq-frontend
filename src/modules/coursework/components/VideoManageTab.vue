<script setup lang="ts">
/**
 * 教师：教学视频管理（登记 / 改元数据 / 预览播放 / 删除）。
 * 列表接口不分页，按 sortNo 升序、id 升序返回。
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
import { deleteVideo, fetchVideos } from '../api'
import { formatDuration, formatFileSize } from '../utils'
import VideoFormModal from './VideoFormModal.vue'
import VideoPlayerModal from './VideoPlayerModal.vue'
import type { VideoView } from '../types'
import { useCourseAnchor } from '../useCourseAnchor'

const props = defineProps<{ courseId: number | null }>()

/** 请求一律用锚点 id(文档 §1.6):服务端回带的 teachInfoId 才回写进 anchorId */
const { anchorId, adopt } = useCourseAnchor(() => props.courseId)

const { t } = useI18n()
const message = useMessage()

const rows = ref<VideoView[]>([])
const { loading, withLoading } = useLoading()

const showForm = ref(false)
const editing = ref<VideoView | null>(null)
const deletingId = ref<number | null>(null)
const playing = ref<VideoView | null>(null)
const showPlayer = ref(false)

function loadData(): Promise<void> {
  const id = anchorId.value
  if (id == null) {
    rows.value = []
    return Promise.resolve()
  }
  return withLoading(async () => {
    try {
      const res = await fetchVideos(id)
      rows.value = res.data
      // 列表回带的是锚点行 id,采纳后登记/删除等后续请求都用它
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

function openEdit(row: VideoView): void {
  editing.value = row
  showForm.value = true
}

function openPlayer(row: VideoView): void {
  playing.value = row
  showPlayer.value = true
}

function handleDelete(row: VideoView) {
  return withLoading(async () => {
    deletingId.value = row.id
    try {
      await deleteVideo(row.id)
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

const columns = computed<DataTableColumns<VideoView>>(() => [
  { title: t('coursework.video.sortNo'), key: 'sortNo', width: 80, align: 'center' },
  {
    title: t('coursework.video.title'),
    key: 'title',
    minWidth: 200,
    ellipsis: { tooltip: true },
  },
  {
    title: t('coursework.video.description'),
    key: 'description',
    minWidth: 160,
    ellipsis: { tooltip: true },
    render: (row) => row.description || '-',
  },
  {
    title: t('coursework.video.playDuration'),
    key: 'durationSec',
    width: 110,
    align: 'center',
    render: (row) => formatDuration(row.durationSec),
  },
  {
    title: t('coursework.video.size'),
    key: 'sizeBytes',
    width: 110,
    align: 'center',
    render: (row) => formatFileSize(row.sizeBytes),
  },
  {
    title: t('coursework.video.uploadTime'),
    key: 'createTime',
    width: 150,
    render: (row) => formatDateTime(row.createTime),
  },
  {
    title: t('coursework.common.actions'),
    key: 'actions',
    width: 210,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8, wrap: false }, () => [
        h(NButton, { size: 'small', onClick: () => openPlayer(row) }, () =>
          t('coursework.video.play'),
        ),
        h(NButton, { size: 'small', onClick: () => openEdit(row) }, () =>
          t('coursework.common.edit'),
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            default: () => t('coursework.video.deleteConfirm'),
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

const rowKey = (row: VideoView) => row.id
</script>

<template>
  <div class="tab-body">
    <div class="tab-toolbar">
      <NText depth="3" class="tab-hint">{{ t('coursework.video.tab') }}</NText>
      <NButton type="primary" :disabled="courseId == null" @click="openCreate">
        {{ t('coursework.video.addTitle') }}
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
      :scroll-x="1020"
    />

    <VideoFormModal
      v-model:show="showForm"
      :course-id="anchorId ?? 0"
      :video="editing"
      @saved="loadData"
    />
    <VideoPlayerModal v-model:show="showPlayer" :video="playing" />
  </div>
</template>

<style scoped src="./TabShared.css"></style>
