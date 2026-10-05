<script setup lang="ts">
/**
 * 教师课业工作台：选一门课，管理该授课组的作业 / 教学视频 / 课程资料 / 课程公告。
 *
 * 课程上下文（teachInfoId）由四个子域共享，故选择器只在这里放一次；
 * 各 Tab 组件自己 watch courseId 加载数据（含首载），切到哪个 Tab 才拉哪个 Tab 的数据。
 *
 * 关于 teachInfoId 归一：本页传下去的一律是选择器里那个 id。服务端接受授课组**任意一行**的
 * id 并在内部归一到锚点行，所以不需要把响应里返回的 teachInfoId 回写后再用 —— 传原值即可。
 */
import { ref } from 'vue'
import { NCard, NTabs, NTabPane } from 'naive-ui'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import ForbiddenState from '@/shared/components/ForbiddenState.vue'
import CourseContextSelector from '../components/CourseContextSelector.vue'
import AssignmentManageTab from '../components/AssignmentManageTab.vue'
import QuestionBankTab from '../components/QuestionBankTab.vue'
import VideoManageTab from '../components/VideoManageTab.vue'
import MaterialManageTab from '../components/MaterialManageTab.vue'
import AnnouncementManageTab from '../components/AnnouncementManageTab.vue'

const { isTeacher } = useRoleCheck()

const courseId = ref<number | null>(null)
const activeTab = ref('assignment')
</script>

<template>
  <div class="coursework-page">
    <ForbiddenState v-if="!isTeacher" />
    <template v-else>
      <NCard class="context-card">
        <CourseContextSelector v-model:course-id="courseId" />
      </NCard>
      <NCard class="tabs-card">
        <NTabs v-model:value="activeTab" type="line" animated>
          <NTabPane name="assignment" :tab="$t('coursework.assignment.tab')">
            <AssignmentManageTab :course-id="courseId" />
          </NTabPane>
          <NTabPane name="questionBank" :tab="$t('coursework.question.tab')">
            <QuestionBankTab />
          </NTabPane>
          <NTabPane name="video" :tab="$t('coursework.video.tab')">
            <VideoManageTab :course-id="courseId" />
          </NTabPane>
          <NTabPane name="material" :tab="$t('coursework.material.tab')">
            <MaterialManageTab :course-id="courseId" />
          </NTabPane>
          <NTabPane name="announcement" :tab="$t('coursework.announcement.tab')">
            <AnnouncementManageTab :course-id="courseId" />
          </NTabPane>
        </NTabs>
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./CourseworkPage.css"></style>
