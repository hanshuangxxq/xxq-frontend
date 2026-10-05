<script setup lang="ts">
/** 学生：课程资料列表 + 在线预览/下载。只读，没有任何写操作。 */
import { computed, h, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NDataTable, NButton, NSpace, NText, useMessage, type DataTableColumns } from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { formatDateTime } from '@/shared/utils/format'
import { useLoading } from '@/shared/composables/useLoading'
import EmptyState from '@/shared/components/EmptyState.vue'
import FilePreviewModal from '@/modules/file/components/FilePreviewModal.vue'
import type { PreviewFileTarget } from '@/modules/file/preview'
import { downloadCourseFile, fetchMaterials } from '../api'
import { formatFileSize } from '../utils'
import type { MaterialView } from '../types'
import { useCourseAnchor } from '../useCourseAnchor'

const props = defineProps<{ courseId: number | null }>()

/** 请求一律用锚点 id(文档 §1.6):服务端回带的 teachInfoId 才回写进 anchorId */
const { anchorId, adopt } = useCourseAnchor(() => props.courseId)

const { t } = useI18n()
const message = useMessage()

const rows = ref<MaterialView[]>([])
const { loading, withLoading } = useLoading()
const downloadingId = ref<number | null>(null)

function loadData(): Promise<void> {
  const id = anchorId.value
  if (id == null) {
    rows.value = []
    return Promise.resolve()
  }
  return withLoading(async () => {
    try {
      const res = await fetchMaterials(id)
      rows.value = res.data
      // 列表回带的是锚点行 id,采纳后预览/下载等后续请求都用它
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

function handleDownload(row: MaterialView) {
  void (async () => {
    downloadingId.value = row.id
    try {
      await downloadCourseFile(row.fileName, row.fileOriginal ?? row.title)
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.downloadFail'))
      }
    } finally {
      downloadingId.value = null
    }
  })()
}

/** 预览目标;点击标题即预览,下载按钮保持原样 */
const previewFile = ref<PreviewFileTarget | null>(null)
const showPreview = ref(false)

function openPreview(row: MaterialView): void {
  previewFile.value = { path: row.fileName, name: row.fileOriginal ?? row.title }
  showPreview.value = true
}

const columns = computed<DataTableColumns<MaterialView>>(() => [
  {
    title: t('coursework.material.title'),
    key: 'title',
    minWidth: 200,
    ellipsis: { tooltip: true },
    render: (row) =>
      h(
        NButton,
        { text: true, type: 'primary', size: 'small', onClick: () => openPreview(row) },
        () => row.title,
      ),
  },
  {
    title: t('coursework.material.description'),
    key: 'description',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: (row) => row.description || '-',
  },
  {
    title: t('coursework.material.fileType'),
    key: 'fileExt',
    width: 90,
    align: 'center',
    render: (row) => row.fileExt || '-',
  },
  {
    title: t('coursework.material.size'),
    key: 'sizeBytes',
    width: 110,
    align: 'center',
    render: (row) => formatFileSize(row.sizeBytes),
  },
  {
    title: t('coursework.material.uploadTime'),
    key: 'createTime',
    width: 150,
    render: (row) => formatDateTime(row.createTime),
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
          h(
            NButton,
            { size: 'small', loading: downloadingId.value === row.id, onClick: () => handleDownload(row) },
            () => t('coursework.common.download'),
          ),
        ],
      ),
  },
])

const rowKey = (row: MaterialView) => row.id
</script>

<template>
  <div class="tab-body">
    <div class="tab-toolbar">
      <NText depth="3" class="tab-hint">{{ t('coursework.material.tab') }}</NText>
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
      :scroll-x="1000"
    />

    <FilePreviewModal v-model:show="showPreview" :file="previewFile" />
  </div>
</template>

<style scoped src="./TabShared.css"></style>
