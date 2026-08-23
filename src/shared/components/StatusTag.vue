<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NTag } from 'naive-ui'
import type { StatusTagDef } from '@/shared/types'

/**
 * 统一状态标签:各模块在自己的 status.ts 中定义一份
 * Record<状态值, StatusTagDef>(状态值为后端枚举),页面不再各自维护颜色映射。
 * 未命中映射时降级为原文本展示。
 */
const props = defineProps<{
  value: string | null | undefined
  map: Record<string, StatusTagDef>
  size?: 'tiny' | 'small' | 'medium' | 'large'
}>()

const { t } = useI18n()

const def = computed(() => (props.value ? props.map[props.value] : undefined))
</script>

<template>
  <NTag v-if="def" :type="def.type" :size="size ?? 'small'" :bordered="false">
    {{ t(def.labelKey) }}
  </NTag>
  <span v-else>{{ value ?? '-' }}</span>
</template>
