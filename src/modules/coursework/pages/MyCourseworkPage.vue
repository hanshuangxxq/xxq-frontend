<script setup lang="ts">
/**
 * 学生课业页：选一门课，查看并参与该授课组的作业 / 教学视频 / 课程资料 / 课程公告。
 *
 * 结构与教师工作台一致（共享课程选择器 + 四个 Tab），只是各 Tab 换成学生视角：
 * 作业可提交/重交、视频可播放、资料可下载、公告只读。
 */
import { ref } from 'vue'
import { NCard, NTabs, NTabPane } from 'naive-ui'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import ForbiddenState from '@/shared/components/ForbiddenState.vue'
import CourseContextSelector from '../components/CourseContextSelector.vue'
import AssignmentListTab from '../components/AssignmentListTab.vue'
import VideoListTab from '../components/VideoListTab.vue'
import MaterialListTab from '../components/MaterialListTab.vue'
import AnnouncementListTab from '../components/AnnouncementListTab.vue'

const { isStudent } = useRoleCheck()

const courseId = ref<number | null>(null)
const activeTab = ref('assignment')
</script>

<template>
  <div class="coursework-page">
    <ForbiddenState v-if="!isStudent" />
    <template v-else>
      <NCard class="context-card">
        <CourseContextSelector v-model:course-id="courseId" />
      </NCard>
      <NCard class="tabs-card">
        <NTabs v-model:value="activeTab" type="line" animated>
          <NTabPane name="assignment" :tab="$t('coursework.assignment.tab')">
            <AssignmentListTab :course-id="courseId" />
          </NTabPane>
          <NTabPane name="video" :tab="$t('coursework.video.tab')">
            <VideoListTab :course-id="courseId" />
          </NTabPane>
          <NTabPane name="material" :tab="$t('coursework.material.tab')">
            <MaterialListTab :course-id="courseId" />
          </NTabPane>
          <NTabPane name="announcement" :tab="$t('coursework.announcement.tab')">
            <AnnouncementListTab :course-id="courseId" />
          </NTabPane>
        </NTabs>
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./CourseworkPage.css"></style>
