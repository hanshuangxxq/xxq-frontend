<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpin,
  NEmpty,
  NTag,
  NSpace,
  NDescriptions,
  NDescriptionsItem,
  useMessage,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import ForbiddenState from '@/shared/components/ForbiddenState.vue'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import { fetchMyScore } from '../../api'
import { scoreStatusTagType, formatDateTime } from '@/modules/practice/utils'
import { useLoading } from '@/shared/composables/useLoading'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { ScoreResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isStudent } = useRoleCheck()

const campaignId = ref<number | null>(null)
const score = ref<ScoreResponse | null>(null)
const { loading, withLoading } = useLoading()

function loadScore() {
  if (campaignId.value == null) return
  const id = campaignId.value
  return withLoading(async () => {
    try {
      const res = await fetchMyScore(id)
      score.value = res.data
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('graduation.common.loadFail'))
      }
    }
  })
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  score.value = null
  if (id != null) void loadScore()
}

/** F-R-21：非已发布状态标注「未最终发布」 */
const isPublished = computed(() => score.value?.status === '已发布')
/** 总评仅在已合成后展示 */
const showTotal = computed(
  () =>
    score.value != null && (score.value.status === '已合成总评' || score.value.status === '已发布'),
)
</script>

<template>
  <div class="graduation-page">
    <ForbiddenState v-if="!isStudent" />
    <template v-else>
      <NCard class="context-card">
        <CampaignContextSelector
          v-model:campaign-id="campaignId"
          @update:campaign-id="onCampaignChange"
        />
      </NCard>

      <NCard :title="$t('graduation.student.myScoreTitle')" class="content-card">
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && campaignId != null && !score"
            :description="$t('graduation.student.scoreNotPublished')"
          />
          <template v-if="score">
            <NSpace align="center" :size="12" style="margin-bottom: 16px">
              <NTag :type="scoreStatusTagType(score.status)" size="small" :bordered="false">
                {{ score.status }}
              </NTag>
              <span v-if="!isPublished" class="unpublished-hint">
                {{ $t('graduation.student.scoreUnpublishedHint') }}
              </span>
            </NSpace>
            <NDescriptions :column="3" bordered size="small">
              <NDescriptionsItem :label="$t('graduation.student.advisorScore')">
                {{ score.advisorScore ?? '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('graduation.student.reviewerScore')">
                {{ score.reviewerScore ?? '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('graduation.student.defenseScore')">
                {{ score.defenseScore ?? '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('graduation.student.totalScore')">
                {{ showTotal ? score.totalScore : '-' }}
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('graduation.common.publishTime')" :span="2">
                {{ formatDateTime(score.publishTime) }}
              </NDescriptionsItem>
            </NDescriptions>
          </template>
        </NSpin>
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./MyScorePage.css"></style>
