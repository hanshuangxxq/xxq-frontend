<script setup lang="ts">
/**
 * 视频表格(节内 / 「课程资料 -> 教学视频」节点共用):时长/大小/上传时间都是只读元数据。
 * 纯展示组件:数据在调用方手里,操作意图经 emit 上抛;editable=教师侧(编辑/删除)。
 */
import { computed, h, type VNode } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NDataTable, NPopconfirm, NSpace, type DataTableColumns } from 'naive-ui'
import { formatDateTime } from '@/shared/utils/format'
import { formatDuration, formatFileSize } from '../utils'
import type { VideoView } from '../types'

const props = withDefaults(
  defineProps<{
    videos: VideoView[]
    /** 教师侧:显示 编辑/删除;学生侧只留「播放」 */
    editable?: boolean
    /** 正在增删改的视频 id,用于对应按钮的 loading 态 */
    busyId?: number | null
  }>(),
  { editable: false, busyId: null },
)

const emit = defineEmits<{
  play: [video: VideoView]
  /** 改元数据 / 改挂节(未挂节视频借此归入小节) */
  edit: [video: VideoView]
  remove: [video: VideoView]
}>()

const { t } = useI18n()

const columns = computed<DataTableColumns<VideoView>>(() => [
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
    width: 100,
    align: 'center',
    render: (row) => formatDuration(row.durationSec),
  },
  {
    title: t('coursework.video.size'),
    key: 'sizeBytes',
    width: 100,
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
    width: props.editable ? 200 : 90,
    fixed: 'right',
    render: (row) => renderActions(row),
  },
])

function renderActions(row: VideoView): VNode {
  const buttons: VNode[] = [
    h(NButton, { size: 'small', type: 'primary', onClick: () => emit('play', row) }, () =>
      t('coursework.video.play'),
    ),
  ]
  if (props.editable) {
    buttons.push(
      h(NButton, { size: 'small', onClick: () => emit('edit', row) }, () =>
        t('coursework.common.edit'),
      ),
      h(
        NPopconfirm,
        { onPositiveClick: () => emit('remove', row) },
        {
          default: () => t('coursework.video.deleteConfirm'),
          trigger: () =>
            h(NButton, { size: 'small', type: 'error', loading: props.busyId === row.id }, () =>
              t('coursework.common.delete'),
            ),
        },
      ),
    )
  }
  return h(NSpace, { size: 8, wrap: false }, () => buttons)
}

const rowKey = (row: VideoView) => row.id
</script>

<template>
  <NDataTable
    :columns="columns"
    :data="videos"
    :row-key="rowKey"
    :pagination="false"
    :single-line="false"
    :bordered="false"
    :scroll-x="860"
  />
</template>
