<script setup lang="ts">
/**
 * 多选题作答:选项 key 多选(顺序无关)。题干/配分/计分规则徽标由父级统一渲染。
 */
import { NCheckboxGroup, NCheckbox, NSpace } from 'naive-ui'
import type { AssignmentQuestionView } from '../../types'

defineProps<{
  question: AssignmentQuestionView
  modelValue: string[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

function handleUpdate(value: (string | number)[]): void {
  emit('update:modelValue', value.map(String))
}
</script>

<template>
  <NCheckboxGroup :value="modelValue" @update:value="handleUpdate">
    <NSpace vertical :size="8">
      <NCheckbox v-for="option in question.options ?? []" :key="option.key" :value="option.key">
        {{ option.key }}. {{ option.text }}
      </NCheckbox>
    </NSpace>
  </NCheckboxGroup>
</template>
