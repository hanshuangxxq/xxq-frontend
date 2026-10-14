<script setup lang="ts">
/**
 * 课程资料资源管理器(师生共用):面包屑 + 当前层文件夹/资料 + 根层「教学视频」虚拟节点。
 *
 * 数据按层懒加载(见 useMaterialExplorer);editable=教师端(建文件夹/上传/改名/移动/删除/
 * 视频归入小节),学生端只读(预览/下载/播放)。
 *
 * 「教学视频」是虚拟节点:不是数据库文件夹,不可改名/删除/上传,展开才拉 /videos/common;
 * 其内视频仍属当前授课组。教师从这里把视频「归入小节」时,节级联需要章节树 —— 首次打开
 * 编辑弹窗才现拉 chapters/tree(懒加载,不随页面加载)。
 */
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NBreadcrumb,
  NBreadcrumbItem,
  NButton,
  NDataTable,
  NPopconfirm,
  NSpace,
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
import {
  createMaterialFolder,
  deleteMaterial,
  deleteMaterialFolder,
  deleteVideo,
  downloadCourseFile,
  fetchChapterTree,
  renameMaterialFolder,
} from '../api'
import { formatFileSize } from '../utils'
import { useMaterialExplorer } from '../useMaterialExplorer'
import MaterialFolderModal from './MaterialFolderModal.vue'
import MaterialFormModal from './MaterialFormModal.vue'
import VideoFormModal from './VideoFormModal.vue'
import VideoPlayerModal from './VideoPlayerModal.vue'
import VideoTable from './VideoTable.vue'
import type { ChapterView, MaterialFolderView, MaterialView, VideoView } from '../types'

const props = withDefaults(defineProps<{ courseId: number | null; editable?: boolean }>(), {
  editable: false,
})

const { t } = useI18n()
const message = useMessage()

const {
  location,
  pathStack,
  browse,
  videos,
  loading,
  anchorId,
  enterFolder,
  enterVideos,
  jumpTo,
  reload,
} = useMaterialExplorer(() => props.courseId)

const { loading: mutating, withLoading: withMutation } = useLoading()
/** 正在增删改的行 id:对应按钮转圈,避免连点 */
const busyId = ref<number | null>(null)

// ---- 派生状态 ----

const inVideos = computed(() => location.value.kind === 'videos')
const folders = computed(() => browse.value?.folders ?? [])
const materials = computed(() => browse.value?.materials ?? [])
/** 根层「教学视频」入口仅在根层且有未挂节视频时渲染(数量来自 browse,不预拉列表) */
const showVideoArea = computed(
  () => location.value.kind === 'root' && (browse.value?.commonVideoCount ?? 0) > 0,
)
/** 空态只在数据回来且确实空时渲染(加载期由全局 loading 覆盖,不渲染空壳) */
const rootEmpty = computed(
  () =>
    props.courseId != null &&
    browse.value != null &&
    location.value.kind === 'root' &&
    folders.value.length === 0 &&
    materials.value.length === 0 &&
    !showVideoArea.value,
)
const levelEmpty = computed(
  () =>
    browse.value != null &&
    location.value.kind === 'folder' &&
    folders.value.length === 0 &&
    materials.value.length === 0,
)

// ---- 增删改统一入口(与 VideoManageTab.mutate 同款:loading + toast + 刷新当前层) ----

async function mutate(
  id: number | null,
  action: () => Promise<unknown>,
  successKey: string,
): Promise<boolean> {
  return withMutation(async () => {
    busyId.value = id
    try {
      await action()
      message.success(t(successKey))
      await reload()
      return true
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.operationFail'))
      }
      return false
    } finally {
      busyId.value = null
    }
  })
}

// ---- 文件夹 ----

const showFolderModal = ref(false)
const folderModalMode = ref<'create' | 'rename'>('create')
const renamingFolder = ref<MaterialFolderView | null>(null)

function openCreateFolder(): void {
  folderModalMode.value = 'create'
  renamingFolder.value = null
  showFolderModal.value = true
}

function openRenameFolder(folder: MaterialFolderView): void {
  folderModalMode.value = 'rename'
  renamingFolder.value = folder
  showFolderModal.value = true
}

async function handleFolderSubmit(title: string): Promise<void> {
  const id = anchorId.value
  if (folderModalMode.value === 'create') {
    if (id == null) return
    const parentId = location.value.kind === 'folder' ? location.value.id : null
    const ok = await mutate(null, () => {
      const data: { teachInfoId: number; parentId?: number; title: string } = {
        teachInfoId: id,
        title,
      }
      if (parentId != null) data.parentId = parentId
      return createMaterialFolder(data)
    }, 'coursework.common.operationSuccess')
    if (ok) showFolderModal.value = false
    return
  }
  const folder = renamingFolder.value
  if (!folder) return
  const ok = await mutate(
    folder.id,
    () => renameMaterialFolder(folder.id, { title }),
    'coursework.common.operationSuccess',
  )
  if (ok) showFolderModal.value = false
}

function handleDeleteFolder(folder: MaterialFolderView): Promise<boolean> {
  return mutate(
    folder.id,
    () => deleteMaterialFolder(folder.id),
    'coursework.common.deleteSuccess',
  )
}

// ---- 资料 ----

const showMaterialForm = ref(false)
const editingMaterial = ref<MaterialView | null>(null)

function openUpload(): void {
  editingMaterial.value = null
  showMaterialForm.value = true
}

function openEditMaterial(row: MaterialView): void {
  editingMaterial.value = row
  showMaterialForm.value = true
}

/** 上传/编辑弹窗的默认所在文件夹:当前层(videos 层不会触发,入口已隐藏) */
const currentFolderId = computed(() =>
  location.value.kind === 'folder' ? location.value.id : null,
)

function handleDeleteMaterial(row: MaterialView): Promise<boolean> {
  return mutate(row.id, () => deleteMaterial(row.id), 'coursework.common.deleteSuccess')
}

function handleDownload(row: MaterialView): void {
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

const previewFile = ref<PreviewFileTarget | null>(null)
const showPreview = ref(false)

function openPreview(row: MaterialView): void {
  previewFile.value = { path: row.fileName, name: row.fileOriginal ?? row.title }
  showPreview.value = true
}

const materialColumns = computed<DataTableColumns<MaterialView>>(() => [
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
    width: props.editable ? 210 : 100,
    fixed: 'right',
    render: (row) => renderMaterialActions(row),
  },
])

function renderMaterialActions(row: MaterialView) {
  const buttons = [
    h(NButton, { size: 'small', onClick: () => handleDownload(row) }, () =>
      t('coursework.common.download'),
    ),
  ]
  if (props.editable) {
    buttons.push(
      h(NButton, { size: 'small', onClick: () => openEditMaterial(row) }, () =>
        t('coursework.common.edit'),
      ),
      h(
        NPopconfirm,
        { onPositiveClick: () => void handleDeleteMaterial(row) },
        {
          default: () => t('coursework.material.deleteConfirm'),
          trigger: () =>
            h(
              NButton,
              { size: 'small', type: 'error', loading: busyId.value === row.id },
              () => t('coursework.common.delete'),
            ),
        },
      ),
    )
  }
  return h(NSpace, { size: 8, wrap: false }, () => buttons)
}

const materialRowKey = (row: MaterialView) => row.id

// ---- 「教学视频」节点 ----

const playing = ref<VideoView | null>(null)
const showPlayer = ref(false)

function openPlayer(video: VideoView): void {
  playing.value = video
  showPlayer.value = true
}

/**
 * 节级联数据源:首次编辑未挂节视频才拉(懒加载,不随页面加载)。
 * 拉取后缓存不失效 —— 教师期间新建的章/节要组件重挂载才可见(已知取舍,影响面小)。
 */
const videoChapters = ref<ChapterView[] | null>(null)
const showVideoForm = ref(false)
const editingVideo = ref<VideoView | null>(null)

async function openEditVideo(video: VideoView): Promise<void> {
  const id = anchorId.value
  if (id == null) return
  if (videoChapters.value === null) {
    try {
      const res = await fetchChapterTree(id)
      videoChapters.value = res.data.chapters
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.loadFail'))
      }
      return
    }
  }
  editingVideo.value = video
  showVideoForm.value = true
}

function handleDeleteVideo(video: VideoView): Promise<boolean> {
  return mutate(video.id, () => deleteVideo(video.id), 'coursework.common.deleteSuccess')
}

/** 视频编辑后刷新当前层:归入小节的视频从公共区消失,清空后入口由根层 browse 自然隐藏 */
async function handleVideoSaved(): Promise<void> {
  await reload()
}
</script>

<template>
  <div class="tab-body">
    <div class="tab-toolbar">
      <NBreadcrumb class="explorer-breadcrumb">
        <NBreadcrumbItem :clickable="location.kind !== 'root'" @click="jumpTo(-1)">
          {{ t('coursework.material.rootFolder') }}
        </NBreadcrumbItem>
        <NBreadcrumbItem
          v-for="(folder, i) in pathStack"
          :key="folder.id"
          :clickable="i < pathStack.length - 1"
          @click="jumpTo(i)"
        >
          {{ folder.title }}
        </NBreadcrumbItem>
        <NBreadcrumbItem v-if="inVideos" :clickable="false">
          {{ t('coursework.material.videoArea') }}
        </NBreadcrumbItem>
      </NBreadcrumb>
      <template v-if="editable && !inVideos">
        <NButton :disabled="courseId == null" @click="openCreateFolder">
          {{ t('coursework.material.newFolder') }}
        </NButton>
        <NButton type="primary" :disabled="courseId == null" @click="openUpload">
          {{ t('coursework.material.addTitle') }}
        </NButton>
      </template>
    </div>

    <!-- 首屏空态:数据回来且根层确实空才渲染(不渲染空壳,防闪屏) -->
    <EmptyState
      v-if="!loading && rootEmpty"
      :description="t('coursework.common.empty')"
    />

    <template v-else-if="!inVideos && browse">
      <!-- 「教学视频」虚拟节点入口(根层、有未挂节视频时) -->
      <div v-if="showVideoArea" class="folder-row" @click="enterVideos">
        <span class="folder-name folder-name--videos">{{ t('coursework.material.videoArea') }}</span>
        <NText depth="3" class="folder-hint">{{ t('coursework.material.videoAreaHint') }}</NText>
      </div>

      <!-- 当前层子文件夹 -->
      <div
        v-for="folder in folders"
        :key="folder.id"
        class="folder-row"
        @click="enterFolder(folder)"
      >
        <span class="folder-name">{{ folder.title }}</span>
        <div v-if="editable" class="folder-actions" @click.stop>
          <NButton size="tiny" quaternary :loading="busyId === folder.id"
            @click="openRenameFolder(folder)">
            {{ t('coursework.material.rename') }}
          </NButton>
          <NPopconfirm @positive-click="handleDeleteFolder(folder)">
            <template #trigger>
              <NButton size="tiny" quaternary type="error" :loading="busyId === folder.id">
                {{ t('coursework.common.delete') }}
              </NButton>
            </template>
            {{ t('coursework.material.folderDeleteConfirm') }}
          </NPopconfirm>
        </div>
      </div>

      <NText v-if="levelEmpty" depth="3" class="level-empty">
        {{ t('coursework.material.folderEmpty') }}
      </NText>

      <NDataTable
        v-if="materials.length"
        :columns="materialColumns"
        :data="materials"
        :row-key="materialRowKey"
        :pagination="false"
        :single-line="false"
        :bordered="false"
        :scroll-x="1000"
      />
    </template>

    <!-- 「教学视频」层:未挂节视频表格 -->
    <template v-else-if="inVideos && videos">
      <NText v-if="!videos.length" depth="3" class="level-empty">
        {{ t('coursework.material.videoAreaEmpty') }}
      </NText>
      <VideoTable
        v-else
        :videos="videos"
        :editable="editable"
        :busy-id="busyId"
        @play="openPlayer"
        @edit="openEditVideo"
        @remove="handleDeleteVideo"
      />
    </template>

    <MaterialFolderModal
      v-model:show="showFolderModal"
      :title="folderModalMode === 'create'
        ? t('coursework.material.addFolderTitle')
        : t('coursework.material.renameFolderTitle')"
      :initial-value="folderModalMode === 'rename' ? renamingFolder?.title ?? '' : ''"
      :loading="mutating"
      @submit="handleFolderSubmit"
    />
    <MaterialFormModal
      v-model:show="showMaterialForm"
      :course-id="anchorId ?? 0"
      :material="editingMaterial"
      :current-folder-id="currentFolderId"
      :folder-path="pathStack"
      @saved="reload"
    />
    <VideoFormModal
      v-model:show="showVideoForm"
      :chapters="videoChapters ?? []"
      :video="editingVideo"
      @saved="handleVideoSaved"
    />
    <VideoPlayerModal v-model:show="showPlayer" :video="playing" />
    <FilePreviewModal v-model:show="showPreview" :file="previewFile" />
  </div>
</template>

<style scoped src="./TabShared.css"></style>
<style scoped src="./MaterialExplorer.css"></style>
