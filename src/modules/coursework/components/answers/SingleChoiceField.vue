<script setup lang="ts">
/**
 * 单选题作答:选项 key 单选。题干/配分/徽标由父级统一渲染,这里只管输入控件。
 */
import { NRadioGroup, NRadio, NSpace } from 'naive-ui'
import type { AssignmentQuestionView } from '../../types'

defineProps<{
  question: AssignmentQuestionView
  modelValue: string | null
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

function handleUpdate(value: string | null): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <NRadioGroup :value="modelValue" @update:value="handleUpdate">
    <NSpace vertical :size="8">
      <NRadio v-for="option in question.options ?? []" :key="option.key" :value="option.key">
        {{ option.key }}. {{ option.text }}
      </NRadio>
    </NSpace>
  </NRadioGroup>
</template>
