<script setup lang="ts">
/**
 * 判断题作答:正确/错误二选一。题干/配分由父级统一渲染。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NRadioGroup, NRadio, NSpace } from 'naive-ui'
import type { AssignmentQuestionView } from '../../types'

defineProps<{
  question: AssignmentQuestionView
  modelValue: boolean | null
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean | null] }>()

const { t } = useI18n()

const judgeOptions = computed(() => [
  { label: t('coursework.question.judgeTrue'), value: true },
  { label: t('coursework.question.judgeFalse'), value: false },
])

function handleUpdate(value: boolean | null): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <NRadioGroup :value="modelValue" @update:value="handleUpdate">
    <NSpace :size="16">
      <NRadio v-for="opt in judgeOptions" :key="String(opt.value)" :value="opt.value">
        {{ opt.label }}
      </NRadio>
    </NSpace>
  </NRadioGroup>
</template>
