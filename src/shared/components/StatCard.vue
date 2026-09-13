<script setup lang="ts">
/** 统计指标卡:统一各看板/统计页的数字展示样式(标签 + 数值 + 可选单位/强调色) */
import { computed } from 'vue'
import { NStatistic } from 'naive-ui'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    suffix?: string
    /** 数值强调色 */
    tone?: 'default' | 'primary' | 'success' | 'warning' | 'error'
  }>(),
  {
    tone: 'default',
    suffix: undefined,
  },
)

const displayValue = computed(() => props.value)
</script>

<template>
  <div class="stat-card" :class="`stat-card--${tone}`">
    <NStatistic :label="label" :value="displayValue">
      <template v-if="suffix" #suffix>
        <span class="stat-card-suffix">{{ suffix }}</span>
      </template>
    </NStatistic>
  </div>
</template>

<style scoped src="./StatCard.css"></style>
