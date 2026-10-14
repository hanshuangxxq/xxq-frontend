<script setup lang="ts">
/**
 * 资料文件夹标题弹窗:新建与重命名共用(请求体都是 `{ title }`,只有落库端点不同)。
 * 刻意不带任何接口调用 —— 由调用方决定打哪个端点,弹窗只负责取一个非空标题。
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NForm, NFormItem, NInput, NButton, NSpace, useMessage } from 'naive-ui'

const props = defineProps<{
  show: boolean
  /** 弹窗标题(新建文件夹 / 重命名文件夹) */
  title: string
  /** 打开时的初值:重命名传原名,新建传空串 */
  initialValue: string
  /** 提交进行中(由调用方的请求决定) */
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  submit: [title: string]
}>()

const { t } = useI18n()
const message = useMessage()

const value = ref('')

watch(
  () => [props.show, props.initialValue] as const,
  ([show]) => {
    if (show) value.value = props.initialValue
  },
  { immediate: true },
)

function handleSubmit() {
  // 提交在途时忽略重复触发(连按 Enter 可能建出两个同名文件夹)
  if (props.loading) return
  const title = value.value.trim()
  if (!title) {
    message.warning(t('coursework.material.folderNameRequired'))
    return
  }
  emit('submit', title)
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="material-folder-modal"
    :title="title"
    @update:show="emit('update:show', $event)"
  >
    <NForm label-placement="top" @submit.prevent>
      <NFormItem :label="t('coursework.material.folder')" required>
        <NInput
          v-model:value="value"
          maxlength="100"
          show-count
          :placeholder="t('coursework.material.folderNamePlaceholder')"
          @keyup.enter="handleSubmit"
        />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">{{ t('coursework.common.cancel') }}</NButton>
        <NButton type="primary" :loading="loading" @click="handleSubmit">
          {{ t('coursework.common.save') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<!-- 弹窗内容被 teleport 到 body,scoped 选择器命不中,故这条走非 scoped(与同模块其它弹窗一致) -->
<style>
.material-folder-modal {
  width: 460px;
  max-width: 92vw;
}
</style>
