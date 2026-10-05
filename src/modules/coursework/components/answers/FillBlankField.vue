<script setup lang="ts">
/**
 * 填空题作答:按 question.blankCount(后端随题目下发的空位数)渲染对应个数的输入框,
 * 作答数组按空位顺序。大小写敏感徽标由父级统一渲染。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NInput, NText } from 'naive-ui'
import type { AssignmentQuestionView } from '../../types'

const props = defineProps<{
  question: AssignmentQuestionView
  /** 各空内容,按下标对应空位 */
  modelValue: string[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const { t } = useI18n()

const blankCount = computed(() => props.question.blankCount ?? 0)

function updateAt(index: number, value: string): void {
  const next = [...props.modelValue]
  next[index] = value
  emit('update:modelValue', next)
}

function valueAt(index: number): string {
  return props.modelValue[index] ?? ''
}
</script>

<template>
  <NText v-if="blankCount === 0" depth="3">{{ t('coursework.answer.noBlanks') }}</NText>
  <div v-else class="blank-answer-list">
    <div v-for="index in blankCount" :key="index" class="blank-answer-row">
      <NText depth="3" class="blank-answer-label">
        {{ t('coursework.answer.blankN', { n: index }) }}
      </NText>
      <NInput :value="valueAt(index - 1)" @update:value="(v) => updateAt(index - 1, v)" />
    </div>
  </div>
</template>

<style scoped>
.blank-answer-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.blank-answer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.blank-answer-label {
  flex-shrink: 0;
  min-width: 48px;
}
</style>
