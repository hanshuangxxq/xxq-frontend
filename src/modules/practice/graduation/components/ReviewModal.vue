<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadio,
  NInput,
  NText,
  NSpace,
  NButton,
  createDiscreteApi,
} from 'naive-ui'
import type { MidtermConclusionCode } from '../types'

const { message } = createDiscreteApi(['message'])

/**
 * 毕设审核/评审弹窗（F-R-44）：
 * - mode=approve：通过/驳回（或退回）单选，驳回时意见必填
 * - mode=conclusion：中期结论单选（必选）+ 意见选填
 * 父组件监听 submit 事件调用接口，成功后自行关闭弹窗。
 */
const props = defineProps<{
  show: boolean
  mode: 'approve' | 'conclusion'
  title: string
  /** approve 模式下「不通过」按钮文案（驳回/退回） */
  rejectLabel?: string
  /** 弹窗内补充说明（如学生名/标题） */
  hint?: string
  submitting?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  submit: [value: { approve?: boolean; conclusion?: MidtermConclusionCode; comment?: string }]
}>()

const { t } = useI18n()

const approve = ref(true)
const conclusion = ref<MidtermConclusionCode | null>(null)
const comment = ref('')

const conclusionOptions = [
  { label: t('graduation.teacher.conclusionNormal'), value: 'NORMAL' as MidtermConclusionCode },
  { label: t('graduation.teacher.conclusionWarning'), value: 'WARNING' as MidtermConclusionCode },
  {
    label: t('graduation.teacher.conclusionSevere'),
    value: 'SEVERE_LAGGING' as MidtermConclusionCode,
  },
]

watch(
  () => props.show,
  (v) => {
    if (v) {
      approve.value = true
      conclusion.value = null
      comment.value = ''
    }
  },
)

function handleSubmit(): void {
  if (props.mode === 'conclusion') {
    if (!conclusion.value) {
      message.warning(t('graduation.teacher.conclusionRequired'))
      return
    }
    emit('submit', { conclusion: conclusion.value, comment: comment.value || undefined })
    return
  }
  if (!approve.value && !comment.value.trim()) {
    message.warning(t('graduation.common.rejectReasonRequired'))
    return
  }
  emit('submit', {
    approve: approve.value,
    comment: approve.value ? comment.value || undefined : comment.value,
  })
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="title"
    class="graduation-review-modal"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <NForm label-placement="top">
      <NText v-if="hint" depth="3" style="font-size: 13px">{{ hint }}</NText>
      <template v-if="mode === 'approve'">
        <NFormItem :label="$t('graduation.common.reviewComment')">
          <NRadioGroup v-model:value="approve">
            <NRadio :value="true">{{ $t('graduation.common.pass') }}</NRadio>
            <NRadio :value="false">{{ rejectLabel ?? $t('graduation.common.reject') }}</NRadio>
          </NRadioGroup>
        </NFormItem>
        <NFormItem :label="rejectLabel ?? $t('graduation.common.rejectReason')">
          <NInput
            v-model:value="comment"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :placeholder="$t('graduation.common.rejectReasonRequired')"
          />
        </NFormItem>
      </template>
      <template v-else>
        <NFormItem :label="$t('graduation.teacher.conclusion')" required>
          <NRadioGroup v-model:value="conclusion">
            <NRadio v-for="opt in conclusionOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </NRadio>
          </NRadioGroup>
        </NFormItem>
        <NFormItem :label="$t('graduation.common.commentOptional')">
          <NInput v-model:value="comment" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
      </template>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">{{ $t('graduation.common.cancel') }}</NButton>
        <NButton type="primary" :loading="submitting" @click="handleSubmit">
          {{ $t('graduation.common.confirm') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style>
.graduation-review-modal {
  width: 520px;
  max-width: 92vw;
}
</style>
