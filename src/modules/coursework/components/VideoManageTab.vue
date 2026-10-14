<script setup lang="ts">
/**
 * 教师:教学视频管理(建章 / 建节 / 上传 / 改元数据与挂载点 / 预览播放 / 删除)。
 *
 * 列表不再是平铺的:整棵树由 `useChapterTree` 一次拉齐(章 → 节 → 视频),
 * 增删改后统一重拉 —— 服务端的创建顺序(id 升序)就是展示顺序,前端不维护排序。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NText, useMessage } from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { useLoading } from '@/shared/composables/useLoading'
import EmptyState from '@/shared/components/EmptyState.vue'
import {
  createChapter,
  createSection,
  deleteChapter,
  deleteSection,
  deleteVideo,
  renameChapter,
  renameSection,
} from '../api'
import { useChapterTree } from '../useChapterTree'
import VideoChapterTree from './VideoChapterTree.vue'
import VideoFormModal from './VideoFormModal.vue'
import VideoNodeTitleModal from './VideoNodeTitleModal.vue'
import VideoPlayerModal from './VideoPlayerModal.vue'
import type { ChapterView, SectionView, VideoView } from '../types'

const props = defineProps<{ courseId: number | null }>()

const { t } = useI18n()
const message = useMessage()

const { tree, visibleTree, loading, reload } = useChapterTree(() => props.courseId)
const { loading: mutating, withLoading: withMutation } = useLoading()

/** 正在增删改的节点/视频 id:树上对应按钮转圈,避免连点 */
const busyId = ref<number | null>(null)

const showForm = ref(false)
const editing = ref<VideoView | null>(null)
/** 从某个节「上传视频」进来时的预选挂载点 */
const defaultNodeId = ref<number | null>(null)

const playing = ref<VideoView | null>(null)
const showPlayer = ref(false)

type NodeDialogKind = 'createChapter' | 'renameChapter' | 'createSection' | 'renameSection'

/** 章/节弹窗的上下文:改名的目标是 chapter/section,新建节要带父章 */
interface NodeDialog {
  kind: NodeDialogKind
  chapter: ChapterView | null
  section: SectionView | null
}

const nodeDialog = ref<NodeDialog | null>(null)
const showNodeModal = ref(false)

/** 登记弹窗的「所属小节」级联数据源 */
const chapters = computed(() => tree.value?.chapters ?? [])

/**
 * 所有增删改的唯一入口:按钮 loading + 失败提示 + 成功后重拉整棵树。
 * 一律重拉而不是本地改树 —— 删除是级联软删,返回体也没有统计字段,本地维护只会越改越偏。
 */
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

// ---- 视频 ----

function handleAddVideo(section: SectionView) {
  editing.value = null
  defaultNodeId.value = section.id
  showForm.value = true
}

function handleEditVideo(video: VideoView) {
  editing.value = video
  defaultNodeId.value = null
  showForm.value = true
}

function handleRemoveVideo(video: VideoView) {
  return mutate(video.id, () => deleteVideo(video.id), 'coursework.common.deleteSuccess')
}

function openPlayer(video: VideoView): void {
  playing.value = video
  showPlayer.value = true
}

// ---- 章 / 节 ----

function openNodeDialog(kind: NodeDialogKind, chapter: ChapterView | null = null) {
  nodeDialog.value = { kind, chapter, section: null }
  showNodeModal.value = true
}

function handleAddSection(chapter: ChapterView) {
  openNodeDialog('createSection', chapter)
}

function handleRenameChapter(chapter: ChapterView) {
  openNodeDialog('renameChapter', chapter)
}

function handleRemoveChapter(chapter: ChapterView) {
  return mutate(chapter.id, () => deleteChapter(chapter.id), 'coursework.common.deleteSuccess')
}

function handleRenameSection(section: SectionView) {
  nodeDialog.value = { kind: 'renameSection', chapter: null, section }
  showNodeModal.value = true
}

function handleRemoveSection(section: SectionView) {
  return mutate(section.id, () => deleteSection(section.id), 'coursework.common.deleteSuccess')
}

const nodeModalTitle = computed(() => {
  switch (nodeDialog.value?.kind) {
    case 'createChapter':
      return t('coursework.video.addChapterTitle')
    case 'renameChapter':
      return t('coursework.video.renameChapterTitle')
    case 'createSection':
      return t('coursework.video.addSectionTitle')
    case 'renameSection':
      return t('coursework.video.renameSectionTitle')
    default:
      return ''
  }
})

/** 新建给空串(要的是新标题),改名给原名 */
const nodeModalValue = computed(() => {
  const dialog = nodeDialog.value
  if (dialog?.kind === 'renameChapter') return dialog.chapter?.title ?? ''
  if (dialog?.kind === 'renameSection') return dialog.section?.title ?? ''
  return ''
})

async function handleNodeSubmit(title: string) {
  const dialog = nodeDialog.value
  if (!dialog) return
  const courseId = props.courseId
  const successKey = 'coursework.common.operationSuccess'
  let ok = false

  switch (dialog.kind) {
    case 'createChapter': {
      if (courseId == null) return
      ok = await mutate(null, () => createChapter({ teachInfoId: courseId, title }), successKey)
      break
    }
    case 'renameChapter': {
      const chapter = dialog.chapter
      if (!chapter) return
      ok = await mutate(chapter.id, () => renameChapter(chapter.id, { title }), successKey)
      break
    }
    case 'createSection': {
      const chapter = dialog.chapter
      if (!chapter) return
      ok = await mutate(null, () => createSection({ chapterId: chapter.id, title }), successKey)
      break
    }
    case 'renameSection': {
      const section = dialog.section
      if (!section) return
      ok = await mutate(section.id, () => renameSection(section.id, { title }), successKey)
      break
    }
  }

  // 失败时留着弹窗让人改完重试;成功才关(树已重拉)
  if (ok) showNodeModal.value = false
}
</script>

<template>
  <div class="tab-body">
    <div class="tab-toolbar">
      <NText depth="3" class="tab-hint">{{ t('coursework.video.manageHint') }}</NText>
      <NButton type="primary" :disabled="courseId == null" @click="openNodeDialog('createChapter')">
        {{ t('coursework.video.newChapter') }}
      </NButton>
    </div>

    <EmptyState
      v-if="!loading && courseId != null && !visibleTree"
      :description="t('coursework.common.empty')"
    />
    <VideoChapterTree
      v-else-if="visibleTree"
      editable
      :tree="visibleTree"
      :busy-id="busyId"
      @play="openPlayer"
      @edit="handleEditVideo"
      @remove-video="handleRemoveVideo"
      @add-section="handleAddSection"
      @rename-chapter="handleRenameChapter"
      @remove-chapter="handleRemoveChapter"
      @add-video="handleAddVideo"
      @rename-section="handleRenameSection"
      @remove-section="handleRemoveSection"
    />

    <VideoFormModal
      v-model:show="showForm"
      :chapters="chapters"
      :video="editing"
      :default-node-id="defaultNodeId"
      @saved="reload"
    />
    <VideoNodeTitleModal
      v-model:show="showNodeModal"
      :title="nodeModalTitle"
      :initial-value="nodeModalValue"
      :loading="mutating"
      @submit="handleNodeSubmit"
    />
    <VideoPlayerModal v-model:show="showPlayer" :video="playing" />
  </div>
</template>

<style scoped src="./TabShared.css"></style>
