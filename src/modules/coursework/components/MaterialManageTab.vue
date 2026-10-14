<script setup lang="ts">
/**
 * 教师：课程资料管理（文件夹树 + 资料 + 「教学视频」节点）。
 * 交互全在 MaterialExplorer(editable)，这里只是薄宿主。
 */
import MaterialExplorer from './MaterialExplorer.vue'

defineProps<{ courseId: number | null }>()
</script>

<template>
  <MaterialExplorer :course-id="courseId" editable />
</template>
