<script setup lang="ts">
/** 学生：课程资料浏览（文件夹树 + 资料 + 「教学视频」节点）。只读，没有任何写操作。 */
import MaterialExplorer from './MaterialExplorer.vue'

defineProps<{ courseId: number | null }>()
</script>

<template>
  <MaterialExplorer :course-id="courseId" />
</template>
