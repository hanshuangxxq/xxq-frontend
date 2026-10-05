<script setup lang="ts">
/**
 * 教师：课程资料管理（上传 / 改标题描述 / 预览 / 下载 / 删除）。
 * 列表接口不分页，按 createTime 倒序返回，直接整表展示。
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
import FilePreviewModal from '@/modules/file/components/FilePreviewModal.vue'
import type { PreviewFileTarget } from '@/modules/file/preview'
import { deleteMaterial, downloadCourseFile, fetchMaterials } from '../api'
import { formatFileSize } from '../utils'
import MaterialFormModal from './MaterialFormModal.vue'
import type { MaterialView } from '../types'
import { useCourseAnchor } from '../useCourseAnchor'

const props = defineProps<{ courseId: number | null }>()

/** 请求一律用锚点 id(文档 §1.6):服务端回带的 teachInfoId 才回写进 anchorId */
const { anchorId, adopt } = useCourseAnchor(() => props.courseId)

const { t } = useI18n()
const message = useMessage()

const rows = ref<MaterialView[]>([])
const { loading, withLoading } = useLoading()

const showForm = ref(false)
const editing = ref<MaterialView | null>(null)
const deletingId = ref<number | null>(null)

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
      // 列表回带的是锚点行 id,采纳后上传/删除等后续请求都用它
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

function openEdit(row: MaterialView): void {
  editing.value = row
  showForm.value = true
}

function handleDownload(row: MaterialView) {
  void (async () => {
    try {
      await downloadCourseFile(row.fileName, row.fileOriginal ?? row.title)
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.downloadFail'))
      }
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

function handleDelete(row: MaterialView) {
  return withLoading(async () => {
    deletingId.value = row.id
    try {
      await deleteMaterial(row.id)
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

const columns = computed<DataTableColumns<MaterialView>>(() => [
  {
    title: t('coursework.material.title'),
    key: 'title',
    minWidth: 180,
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
    minWidth: 160,
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
    width: 210,
    fixed: 'right',
    render: (row) =>
      h(NSpace, { size: 8, wrap: false }, () => [
        h(NButton, { size: 'small', onClick: () => handleDownload(row) }, () =>
          t('coursework.common.download'),
        ),
        h(NButton, { size: 'small', onClick: () => openEdit(row) }, () =>
          t('coursework.common.edit'),
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            default: () => t('coursework.material.deleteConfirm'),
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

const rowKey = (row: MaterialView) => row.id
</script>

<template>
  <div class="tab-body">
    <div class="tab-toolbar">
      <NText depth="3" class="tab-hint">{{ t('coursework.material.tab') }}</NText>
      <NButton type="primary" :disabled="courseId == null" @click="openCreate">
        {{ t('coursework.material.addTitle') }}
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
      :scroll-x="1000"
    />

    <MaterialFormModal
      v-model:show="showForm"
      :course-id="anchorId ?? 0"
      :material="editing"
      @saved="loadData"
    />
    <FilePreviewModal v-model:show="showPreview" :file="previewFile" />
  </div>
</template>

<style scoped src="./TabShared.css"></style>
