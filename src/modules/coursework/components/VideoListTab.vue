<script setup lang="ts">
/**
 * 学生:教学视频章节树 + 播放(走 WS 流式,见 VideoPlayerModal)。只读。
 *
 * 与教师侧共用 `VideoChapterTree`(只是不传 editable),结构与数据来源完全一致;
 * 播放仍按视频 id 直达,不感知章节树 —— 点开才先取元数据再连 WS。
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NText } from 'naive-ui'
import EmptyState from '@/shared/components/EmptyState.vue'
import { useChapterTree } from '../useChapterTree'
import VideoChapterTree from './VideoChapterTree.vue'
import VideoPlayerModal from './VideoPlayerModal.vue'
import type { VideoView } from '../types'

const props = defineProps<{ courseId: number | null }>()

const { t } = useI18n()

const { visibleTree, loading } = useChapterTree(() => props.courseId)

const playing = ref<VideoView | null>(null)
const showPlayer = ref(false)

function openPlayer(video: VideoView): void {
  playing.value = video
  showPlayer.value = true
}
</script>

<template>
  <div class="tab-body">
    <div class="tab-toolbar">
      <NText depth="3" class="tab-hint">{{ t('coursework.video.hint') }}</NText>
    </div>

    <EmptyState
      v-if="!loading && courseId != null && !visibleTree"
      :description="t('coursework.common.empty')"
    />
    <VideoChapterTree v-else-if="visibleTree" :tree="visibleTree" @play="openPlayer" />

    <VideoPlayerModal v-model:show="showPlayer" :video="playing" />
  </div>
</template>

<style scoped src="./TabShared.css"></style>
