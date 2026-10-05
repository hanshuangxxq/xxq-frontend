<script setup lang="ts">
/**
 * 题目编辑弹窗:题库录入/修改与作业直接录入共用。
 *
 * - 纯表单组件:校验通过后把扁平表单值 emit 给父级,题库 Tab 自行调接口、
 *   作业表单把结果收进题目列表(转换与校验规则都在 ../questionForm.ts);
 * - 编辑时题型锁定(换题型会让已填的答案形状失效,容易把坏题交出去);
 * - 新建时切题型会重置该题型的答案字段,题干/解析/配分保留。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NRadioGroup,
  NRadio,
  NCheckboxGroup,
  NCheckbox,
  NButton,
  NSpace,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import {
  MAX_BLANKS,
  MAX_OPTIONS,
  emptyQuestionForm,
  optionKeyOf,
  validateQuestionForm,
} from '../questionForm'
import { questionTypeLabelKey } from '../utils'
import CourseTagSelect from './CourseTagSelect.vue'
import type { QuestionType } from '../types'
import type { QuestionFormValue } from '../questionForm'

const props = defineProps<{
  show: boolean
  /** bank = 题库录入/修改(默认配分);assignment = 作业直接录入(本题配分 + 同步入题库) */
  mode: 'bank' | 'assignment'
  /** null = 新建;非 null = 编辑(由父级用 questionFormFromBank/FromAssignment 预填) */
  initial: QuestionFormValue | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  submit: [value: QuestionFormValue]
}>()

const { t } = useI18n()
const message = useMessage()

const form = ref<QuestionFormValue>(emptyQuestionForm('SINGLE_CHOICE'))

const isEdit = computed(() => props.initial !== null)
const isChoice = computed(
  () => form.value.type === 'SINGLE_CHOICE' || form.value.type === 'MULTI_CHOICE',
)

const typeOptions = computed(() =>
  (
    ['SINGLE_CHOICE', 'MULTI_CHOICE', 'JUDGE', 'FILL_BLANK', 'ESSAY'] as QuestionType[]
  ).map((type) => ({ label: t(questionTypeLabelKey(type)), value: type })),
)

const scoreRuleOptions = computed(() => [
  { label: t('coursework.question.scoreRuleHalf'), value: 'HALF_ON_PARTIAL' },
  { label: t('coursework.question.scoreRuleAll'), value: 'ALL_OR_NOTHING' },
])

const judgeOptions = computed(() => [
  { label: t('coursework.question.judgeTrue'), value: true },
  { label: t('coursework.question.judgeFalse'), value: false },
])

watch(
  () => [props.show, props.initial] as const,
  ([show]) => {
    if (!show) return
    // 深拷贝嵌套结构:弹窗内的编辑不能提前污染父级持有的题目列表(未点保存即取消要可回退)
    form.value = props.initial
      ? {
          ...props.initial,
          options: props.initial.options.map((o) => ({ ...o })),
          multiAnswer: [...props.initial.multiAnswer],
          blanks: props.initial.blanks.map((group) => [...group]),
        }
      : emptyQuestionForm('SINGLE_CHOICE')
  },
  { immediate: true },
)

/** 新建时切题型:重建该题型的答案字段,保留题干/解析/配分等跨题型字段 */
function handleTypeChange(type: QuestionType): void {
  const keep = form.value
  const next = emptyQuestionForm(type)
  next.stem = keep.stem
  next.analysis = keep.analysis
  next.defaultScore = keep.defaultScore
  next.score = keep.score
  next.saveToBank = keep.saveToBank
  next.courseTag = keep.courseTag
  form.value = next
}

function addOption(): void {
  const options = form.value.options
  if (options.length >= MAX_OPTIONS) return
  options.push({ key: optionKeyOf(options.length), text: '' })
}

function removeOption(index: number): void {
  const options = form.value.options
  const removed = options[index]
  if (!removed) return
  // ★ 选项 key 是按行序派生的(A/B/C…),删行重排 key 后必须把答案按「行号」一起搬过去。
  //   只清掉「正好等于被删 key」的答案是错的:旧 key 依然存在于新集合里,但它已经指向
  //   另一个选项了 —— 校验照样通过,错的标准答案静默入库。
  const oldIndexOf = new Map(options.map((o, i) => [o.key, i]))
  const singleAt =
    form.value.singleAnswer != null ? oldIndexOf.get(form.value.singleAnswer) : undefined
  const multiAt = form.value.multiAnswer.map((k) => oldIndexOf.get(k))

  options.splice(index, 1)
  options.forEach((o, i) => {
    o.key = optionKeyOf(i)
  })

  /** 旧行号 -> 重排后的 key;被删的那一行返回 null */
  const rekey = (i: number | undefined): string | null =>
    i == null || i === index ? null : optionKeyOf(i > index ? i - 1 : i)

  form.value.singleAnswer = rekey(singleAt)
  form.value.multiAnswer = multiAt.map(rekey).filter((k): k is string => k != null)
}

function addBlank(): void {
  if (form.value.blanks.length >= MAX_BLANKS) return
  form.value.blanks.push([''])
}

function removeBlank(index: number): void {
  form.value.blanks.splice(index, 1)
}

function addAcceptable(blankIndex: number): void {
  form.value.blanks[blankIndex]?.push('')
}

function removeAcceptable(blankIndex: number, answerIndex: number): void {
  form.value.blanks[blankIndex]?.splice(answerIndex, 1)
}

function close(): void {
  emit('update:show', false)
}

function handleSubmit(): void {
  const errorKey = validateQuestionForm(form.value, props.mode)
  if (errorKey) {
    message.warning(t(errorKey))
    return
  }
  emit('submit', form.value)
  close()
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="coursework-modal"
    :title="isEdit ? t('coursework.question.editTitle') : t('coursework.question.addTitle')"
    @update:show="emit('update:show', $event)"
  >
    <NForm label-placement="top">
      <NFormItem :label="t('coursework.question.type')" required>
        <NSelect
          :value="form.type"
          :options="typeOptions"
          :disabled="isEdit"
          class="question-type-select"
          @update:value="handleTypeChange"
        />
      </NFormItem>
      <NFormItem :label="t('coursework.question.stem')" required>
        <NInput
          v-model:value="form.stem"
          type="textarea"
          :rows="3"
          :placeholder="t('coursework.question.stemPlaceholder')"
        />
      </NFormItem>

      <!-- 选择题:选项编辑 + 正确答案 -->
      <template v-if="isChoice">
        <NFormItem :label="t('coursework.question.options')" required>
          <div class="option-list">
            <div v-for="(option, index) in form.options" :key="index" class="option-row">
              <NTag size="small" class="option-key">{{ optionKeyOf(index) }}</NTag>
              <NInput v-model:value="option.text" :placeholder="t('coursework.question.optionText')" />
              <NButton
                size="small"
                quaternary
                type="error"
                :disabled="form.options.length <= 2"
                @click="removeOption(index)"
              >
                {{ t('coursework.common.delete') }}
              </NButton>
            </div>
            <NButton size="small" dashed :disabled="form.options.length >= MAX_OPTIONS" @click="addOption">
              {{ t('coursework.question.addOption') }}
            </NButton>
          </div>
        </NFormItem>
        <NFormItem v-if="form.type === 'SINGLE_CHOICE'" :label="t('coursework.question.correctAnswer')" required>
          <NRadioGroup v-model:value="form.singleAnswer">
            <NSpace>
              <NRadio v-for="(option, index) in form.options" :key="index" :value="optionKeyOf(index)">
                {{ optionKeyOf(index) }}
              </NRadio>
            </NSpace>
          </NRadioGroup>
        </NFormItem>
        <template v-else>
          <NFormItem :label="t('coursework.question.correctAnswer')" required>
            <NCheckboxGroup v-model:value="form.multiAnswer">
              <NSpace>
                <NCheckbox v-for="(option, index) in form.options" :key="index" :value="optionKeyOf(index)">
                  {{ optionKeyOf(index) }}
                </NCheckbox>
              </NSpace>
            </NCheckboxGroup>
          </NFormItem>
          <NFormItem :label="t('coursework.question.scoreRule')">
            <NSelect v-model:value="form.scoreRule" :options="scoreRuleOptions" class="question-type-select" />
          </NFormItem>
        </template>
      </template>

      <!-- 判断题 -->
      <NFormItem v-if="form.type === 'JUDGE'" :label="t('coursework.question.correctAnswer')" required>
        <NRadioGroup v-model:value="form.judgeAnswer">
          <NSpace>
            <NRadio v-for="opt in judgeOptions" :key="String(opt.value)" :value="opt.value">
              {{ opt.label }}
            </NRadio>
          </NSpace>
        </NRadioGroup>
      </NFormItem>

      <!-- 填空题:每空一组可接受答案 -->
      <template v-if="form.type === 'FILL_BLANK'">
        <NFormItem :label="t('coursework.question.blanks')" required>
          <div class="blank-list">
            <div v-for="(group, blankIndex) in form.blanks" :key="blankIndex" class="blank-card">
              <div class="blank-header">
                <NText depth="3">{{ t('coursework.question.blankN', { n: blankIndex + 1 }) }}</NText>
                <NButton
                  size="tiny"
                  quaternary
                  type="error"
                  :disabled="form.blanks.length <= 1"
                  @click="removeBlank(blankIndex)"
                >
                  {{ t('coursework.common.delete') }}
                </NButton>
              </div>
              <div v-for="(_, answerIndex) in group" :key="answerIndex" class="acceptable-row">
                <NInput
                  v-model:value="group[answerIndex]"
                  :placeholder="t('coursework.question.acceptableAnswer')"
                />
                <NButton
                  size="small"
                  quaternary
                  type="error"
                  :disabled="group.length <= 1"
                  @click="removeAcceptable(blankIndex, answerIndex)"
                >
                  {{ t('coursework.common.delete') }}
                </NButton>
              </div>
              <NButton size="tiny" dashed @click="addAcceptable(blankIndex)">
                {{ t('coursework.question.addAcceptable') }}
              </NButton>
            </div>
            <NButton size="small" dashed :disabled="form.blanks.length >= MAX_BLANKS" @click="addBlank">
              {{ t('coursework.question.addBlank') }}
            </NButton>
          </div>
        </NFormItem>
        <NFormItem>
          <NSpace :size="16">
            <NCheckbox v-model:checked="form.ordered">
              {{ t('coursework.question.ordered') }}
            </NCheckbox>
            <NCheckbox v-model:checked="form.caseSensitive">
              {{ t('coursework.question.caseSensitive') }}
            </NCheckbox>
          </NSpace>
        </NFormItem>
      </template>

      <!-- 大题 -->
      <template v-if="form.type === 'ESSAY'">
        <NFormItem :label="t('coursework.question.referenceAnswer')">
          <NInput v-model:value="form.essayReference" type="textarea" :rows="3" />
        </NFormItem>
        <NFormItem>
          <NCheckbox v-model:checked="form.requireFile">
            {{ t('coursework.question.requireFile') }}
          </NCheckbox>
        </NFormItem>
      </template>

      <NFormItem :label="t('coursework.question.analysis')">
        <NInput v-model:value="form.analysis" type="textarea" :rows="2" />
      </NFormItem>
      <NFormItem
        v-if="mode === 'assignment'"
        :label="t('coursework.question.score')"
        required
      >
        <NInputNumber
          v-model:value="form.score"
          :min="0.5"
          :max="1000"
          :show-button="false"
          class="question-score-input"
        />
      </NFormItem>
      <NFormItem v-else :label="t('coursework.question.defaultScore')">
        <NInputNumber
          v-model:value="form.defaultScore"
          :min="0.5"
          :max="1000"
          :show-button="false"
          class="question-score-input"
        />
      </NFormItem>
      <!-- 课程标签只属于题库记录:作业题目快照不存该字段,故作业直录模式下不显示 -->
      <NFormItem v-if="mode === 'bank'" :label="t('coursework.question.courseTag')">
        <CourseTagSelect v-model="form.courseTag" />
      </NFormItem>
      <NFormItem v-if="mode === 'assignment'">
        <NCheckbox v-model:checked="form.saveToBank">
          {{ t('coursework.question.saveToBank') }}
        </NCheckbox>
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="close">{{ t('coursework.common.cancel') }}</NButton>
        <NButton type="primary" @click="handleSubmit">{{ t('coursework.common.save') }}</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped src="./QuestionFormModal.css"></style>

<style>
.coursework-modal {
  width: 640px;
  max-width: 92vw;
}
</style>
