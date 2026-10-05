<script setup lang="ts">
/** 学生：教学视频列表 + 播放（走 WS 流式，见 VideoPlayerModal）。只读。 */
import { computed, h, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NDataTable, NButton, NSpace, NText, useMessage, type DataTableColumns } from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { useLoading } from '@/shared/composables/useLoading'
import EmptyState from '@/shared/components/EmptyState.vue'
import { fetchVideos } from '../api'
import { formatDuration, formatFileSize } from '../utils'
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
      // 列表回带的是锚点行 id,采纳后播放前取元数据等请求都用它
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

function openPlayer(row: VideoView): void {
  playing.value = row
  showPlayer.value = true
}

const columns = computed<DataTableColumns<VideoView>>(() => [
  {
    title: t('coursework.video.title'),
    key: 'title',
    minWidth: 220,
    ellipsis: { tooltip: true },
  },
  {
    title: t('coursework.video.description'),
    key: 'description',
    minWidth: 200,
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
    title: t('coursework.common.actions'),
    key: 'actions',
    width: 100,
    fixed: 'right',
    render: (row) =>
      h(
        NSpace,
        { size: 8, wrap: false },
        () => [
          h(NButton, { size: 'small', type: 'primary', onClick: () => openPlayer(row) }, () =>
            t('coursework.video.play'),
          ),
        ],
      ),
  },
])

const rowKey = (row: VideoView) => row.id
</script>

<template>
  <div class="tab-body">
    <div class="tab-toolbar">
      <NText depth="3" class="tab-hint">{{ t('coursework.video.tab') }}</NText>
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
      :scroll-x="760"
    />

    <VideoPlayerModal v-model:show="showPlayer" :video="playing" />
  </div>
</template>

<style scoped src="./TabShared.css"></style>
