<script setup lang="ts">
/**
 * 「由作业成绩生成平时分」按钮（挂在教师成绩录入页）。
 *
 * 契约要点（文档 §6）:
 * - 无请求体，覆盖式重算、可反复点；已锁定（locked=1）的成绩行不会被覆盖；
 * - 报错而不是静默成功：没有已发布作业 / 一份都没批改 → code 400，走默认 toast 即可（文案可读）；
 * - 返回的三个统计要**分开提示**，尤其「成绩已锁定、未覆盖」的人数 ——
 *   不提示的话用户会以为所有人都被更新了。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NPopconfirm,
  NModal,
  NDescriptions,
  NDescriptionsItem,
  NSpace,
  useMessage,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { useLoading } from '@/shared/composables/useLoading'
import { syncRegularScore } from '../api'
import type { RegularScoreSyncView } from '../types'

const props = defineProps<{ teachInfoId: number | null }>()

const emit = defineEmits<{
  /** 合成成功：调用方应重新拉成绩名单，让新的平时分显示出来 */
  synced: []
}>()

const { t } = useI18n()
const message = useMessage()
const { loading, withLoading } = useLoading()

const showResult = ref(false)
const result = ref<RegularScoreSyncView | null>(null)

const disabled = computed(() => props.teachInfoId == null)

function handleSync() {
  const teachInfoId = props.teachInfoId
  if (teachInfoId == null) return
  return withLoading(async () => {
    try {
      const res = await syncRegularScore(teachInfoId)
      result.value = res.data
      showResult.value = true
      emit('synced')
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.operationFail'))
      }
    }
  })
}
</script>

<template>
  <NPopconfirm @positive-click="handleSync">
    <template #trigger>
      <NButton :loading="loading" :disabled="disabled">
        {{ t('score.mgSyncRegular') }}
      </NButton>
    </template>
    {{ t('score.mgSyncRegularConfirm') }}
  </NPopconfirm>

  <NModal
    v-model:show="showResult"
    preset="card"
    class="coursework-modal"
    :title="t('score.mgSyncRegular')"
  >
    <NDescriptions v-if="result" :column="1" label-placement="left" bordered size="small">
      <NDescriptionsItem :label="t('score.mgSyncUpdated')">
        {{ result.updatedCount }}
      </NDescriptionsItem>
      <NDescriptionsItem :label="t('score.mgSyncLocked')">
        {{ result.skippedLockedUserIds.length }}
      </NDescriptionsItem>
      <NDescriptionsItem :label="t('score.mgSyncUngraded')">
        {{ result.skippedUngradedUserIds.length }}
      </NDescriptionsItem>
    </NDescriptions>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="showResult = false">{{ t('coursework.player.close') }}</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style>
.coursework-modal {
  width: 480px;
  max-width: 92vw;
}
</style>
