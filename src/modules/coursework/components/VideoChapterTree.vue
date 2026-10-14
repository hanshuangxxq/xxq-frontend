<script setup lang="ts">
/**
 * 章节树(章 → 节 → 视频),教师与学生共用同一份渲染。
 *
 * 刻意做成**纯展示组件**:数据加载与增删改全在调用方(Tab)手里,这里只把操作意图 emit 出去。
 * 教师侧可操作(editable),学生侧只留「播放」—— 同一棵树、同一套结构,两侧永不漂移。
 * 未挂节的视频不在树里 —— 展示在「课程资料 → 教学视频」节点(见 MaterialExplorer),公共区已从本组件迁走。
 *
 * 几个契约要点(章节树协议 §1/§3.7):
 * - 章/节/视频一律按 id 升序,没有人工排序,故这里不做任何排序;
 * - 删章级联其下所有节与视频、删节级联其下所有视频,确认文案必须写明连带范围;
 * - 节内视频表是抽出的 `VideoTable`(纯展示),播放/编辑/删除意图原样上抛。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NCollapse, NCollapseItem, NPopconfirm, NText } from 'naive-ui'
import type { ChapterTreeView, ChapterView, SectionView, VideoView } from '../types'
import VideoTable from './VideoTable.vue'

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

/** 默认展开第一章:整页全是折叠条的话,看不出课程结构 */
const defaultExpanded = computed<Array<string | number>>(() => {
  const first = props.tree.chapters[0]
  return first ? [first.id] : []
})
</script>

<template>
  <div class="video-tree">
    <NCollapse :default-expanded-names="defaultExpanded">
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

            <VideoTable
              v-if="section.videos.length"
              :videos="section.videos"
              :editable="editable"
              :busy-id="busyId"
              @play="emit('play', $event)"
              @edit="emit('edit', $event)"
              @remove="emit('removeVideo', $event)"
            />
            <NText v-else depth="3" class="node-empty">
              {{ t('coursework.video.sectionEmpty') }}
            </NText>
          </NCollapseItem>
        </NCollapse>
        <NText v-else depth="3" class="node-empty">{{ t('coursework.video.chapterEmpty') }}</NText>
      </NCollapseItem>
    </NCollapse>
  </div>
</template>

<style scoped src="./VideoChapterTree.css"></style>
