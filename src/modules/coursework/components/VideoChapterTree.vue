<script setup lang="ts">
/**
 * 章节树(章 → 节 → 视频)+ 公共区,教师与学生共用同一份渲染。
 *
 * 刻意做成**纯展示组件**:数据加载与增删改全在调用方(Tab)手里,这里只把操作意图 emit 出去。
 * 教师侧可操作(editable),学生侧只留「播放」—— 同一棵树、同一套结构,两侧永不漂移。
 *
 * 几个契约要点(章节树协议 §1/§3.7):
 * - 章/节/视频一律按 id 升序,没有人工排序,故这里不做任何排序;
 * - 删章级联其下所有节与视频、删节级联其下所有视频,确认文案必须写明连带范围;
 * - 公共区(commonVideos)是未挂节视频的固定分组,渲染在树末尾,学生侧同样可见。
 */
import { computed, h, type VNode } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NDataTable,
  NDivider,
  NPopconfirm,
  NSpace,
  NText,
  type DataTableColumns,
} from 'naive-ui'
import { formatDateTime } from '@/shared/utils/format'
import { formatDuration, formatFileSize } from '../utils'
import type { ChapterTreeView, ChapterView, SectionView, VideoView } from '../types'

const props = withDefaults(
  defineProps<{
    tree: ChapterTreeView
    /** 教师侧:显示建节/上传/改名/删除;学生侧只读(只剩「播放」) */
    editable?: boolean
    /** 正在增删改的节点/视频 id,用于对应按钮的 loading 态 */
    busyId?: number | null
  }>(),
  { editable: false, busyId: null },
)

const emit = defineEmits<{
  play: [video: VideoView]
  /** 改元数据 / 改挂节(公共区视频借此归入小节) */
  edit: [video: VideoView]
  removeVideo: [video: VideoView]
  addSection: [chapter: ChapterView]
  renameChapter: [chapter: ChapterView]
  removeChapter: [chapter: ChapterView]
  addVideo: [section: SectionView]
  renameSection: [section: SectionView]
  removeSection: [section: SectionView]
}>()

const { t } = useI18n()

/** 视频列(节内与公共区共用一套):时长/大小/上传时间都是只读元数据 */
const videoColumns = computed<DataTableColumns<VideoView>>(() => [
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
        { onPositiveClick: () => emit('removeVideo', row) },
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

/** 默认展开第一章:整页全是折叠条的话,看不出课程结构 */
const defaultExpanded = computed<Array<string | number>>(() => {
  const first = props.tree.chapters[0]
  return first ? [first.id] : []
})

const rowKey = (row: VideoView) => row.id
</script>

<template>
  <div class="video-tree">
    <NCollapse v-if="tree.chapters.length" :default-expanded-names="defaultExpanded">
      <NCollapseItem v-for="chapter in tree.chapters" :key="chapter.id" :name="chapter.id">
        <template #header>
          <span class="node-title">{{ chapter.title }}</span>
        </template>
        <!-- 操作按钮在折叠头里,必须 stop,否则点按钮会连带把章折叠掉 -->
        <template v-if="editable" #header-extra>
          <div class="node-actions" @click.stop>
            <NButton size="tiny" quaternary type="primary" @click="emit('addSection', chapter)">
              {{ t('coursework.video.newSection') }}
            </NButton>
            <NButton
              size="tiny"
              quaternary
              :loading="busyId === chapter.id"
              @click="emit('renameChapter', chapter)"
            >
              {{ t('coursework.video.rename') }}
            </NButton>
            <NPopconfirm @positive-click="emit('removeChapter', chapter)">
              <template #trigger>
                <NButton size="tiny" quaternary type="error" :loading="busyId === chapter.id">
                  {{ t('coursework.common.delete') }}
                </NButton>
              </template>
              {{ t('coursework.video.chapterDeleteConfirm') }}
            </NPopconfirm>
          </div>
        </template>

        <NCollapse v-if="chapter.sections.length" class="section-collapse" :bordered="false">
          <NCollapseItem v-for="section in chapter.sections" :key="section.id" :name="section.id">
            <template #header>
              <span class="node-title node-title--section">{{ section.title }}</span>
            </template>
            <template v-if="editable" #header-extra>
              <div class="node-actions" @click.stop>
                <NButton size="tiny" quaternary type="primary" @click="emit('addVideo', section)">
                  {{ t('coursework.video.uploadVideo') }}
                </NButton>
                <NButton
                  size="tiny"
                  quaternary
                  :loading="busyId === section.id"
                  @click="emit('renameSection', section)"
                >
                  {{ t('coursework.video.rename') }}
                </NButton>
                <NPopconfirm @positive-click="emit('removeSection', section)">
                  <template #trigger>
                    <NButton size="tiny" quaternary type="error" :loading="busyId === section.id">
                      {{ t('coursework.common.delete') }}
                    </NButton>
                  </template>
                  {{ t('coursework.video.sectionDeleteConfirm') }}
                </NPopconfirm>
              </div>
            </template>

            <NDataTable
              v-if="section.videos.length"
              :columns="videoColumns"
              :data="section.videos"
              :row-key="rowKey"
              :pagination="false"
              :single-line="false"
              :bordered="false"
              :scroll-x="860"
            />
            <NText v-else depth="3" class="node-empty">
              {{ t('coursework.video.sectionEmpty') }}
            </NText>
          </NCollapseItem>
        </NCollapse>
        <NText v-else depth="3" class="node-empty">{{ t('coursework.video.chapterEmpty') }}</NText>
      </NCollapseItem>
    </NCollapse>

    <!-- 走到这里说明还有公共区视频可看,只是章还没建 —— 轻提示即可,不占整屏空状态 -->
    <NText v-else depth="3" class="node-empty">{{ t('coursework.video.treeEmpty') }}</NText>

    <!-- 公共区:未挂节的视频(存量 + 孤儿兜底),教师可经「编辑」归入小节,学生只读 -->
    <NDivider v-if="tree.chapters.length && tree.commonVideos.length" class="tree-divider" />
    <div v-if="tree.commonVideos.length" class="common-block">
      <div class="common-header">
        <span class="node-title">{{ t('coursework.video.commonArea') }}</span>
        <NText depth="3" class="node-hint">{{ t('coursework.video.commonAreaHint') }}</NText>
      </div>
      <NDataTable
        :columns="videoColumns"
        :data="tree.commonVideos"
        :row-key="rowKey"
        :pagination="false"
        :single-line="false"
        :bordered="false"
        :scroll-x="860"
      />
    </div>
  </div>
</template>

<style scoped src="./VideoChapterTree.css"></style>
