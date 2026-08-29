<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpin,
  NEmpty,
  NButton,
  NDataTable,
  NModal,
  NForm,
  NFormItem,
  NInputNumber,
  NResult,
  NTag,
  NSpace,
  NPopconfirm,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import { fetchScores, submitDefenseScore, confirmScore } from '../../api'
import { scoreStatusTagType, formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { ScoreResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isDepartment } = useRoleCheck()

const campaignId = ref<number | null>(null)
const list = ref<ScoreResponse[]>([])
const loading = ref(false)

async function loadList(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const res = await fetchScores(campaignId.value)
    list.value = res.data ?? []
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  list.value = []
  if (id != null) void loadList()
}

/** F-R-33：缺哪几项 */
function missingItems(r: ScoreResponse): string[] {
  const missing: string[] = []
  if (r.advisorScore == null) missing.push(t('graduation.student.advisorScore'))
  if (r.reviewerScore == null) missing.push(t('graduation.student.reviewerScore'))
  if (r.defenseScore == null) missing.push(t('graduation.student.defenseScore'))
  return missing
}

// ===== 答辩分录入 =====
const showScore = ref(false)
const scoreFor = ref<ScoreResponse | null>(null)
const scoreValue = ref<number | null>(null)
const saving = ref(false)

function startScore(row: ScoreResponse): void {
  scoreFor.value = row
  scoreValue.value = row.defenseScore
  showScore.value = true
}

async function handleSubmitScore(): Promise<void> {
  if (!scoreFor.value || campaignId.value == null) return
  const s = scoreValue.value
  if (s == null || !Number.isInteger(s) || s < 0 || s > 100) {
    message.warning(t('graduation.teacher.scoreRange'))
    return
  }
  saving.value = true
  try {
    await submitDefenseScore({
      campaignId: campaignId.value,
      studentId: scoreFor.value.studentId,
      score: s,
    })
    message.success(t('graduation.common.operationSuccess'))
    showScore.value = false
    await loadList()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
    await loadList()
  } finally {
    saving.value = false
  }
}

// ===== 确认发布（F-R-33：仅 COMPLETE 可发布，发布后不可修改）=====
async function handleConfirm(row: ScoreResponse): Promise<void> {
  if (campaignId.value == null) return
  try {
    await confirmScore({ campaignId: campaignId.value, studentId: row.studentId })
    message.success(t('graduation.common.operationSuccess'))
    await loadList()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
    await loadList()
  }
}

function renderScoreCell(
  value: number | null,
  by: string | null,
  time: string | null,
): ReturnType<typeof h> {
  if (value == null) return h('span', { style: 'color:#bbb' }, '-')
  return h('div', null, [
    h('div', null, String(value)),
    h('div', { style: 'font-size:12px;color:#999' }, `${by ?? '-'} ${formatDateTime(time)}`),
  ])
}

const scoreRowKey = (row: ScoreResponse) => row.id

const columns = computed<DataTableColumns<ScoreResponse>>(() => [
  { title: t('graduation.common.student'), key: 'studentName', width: 110 },
  {
    title: t('graduation.student.advisorScore'),
    key: 'advisorScore',
    width: 150,
    render: (r) => renderScoreCell(r.advisorScore, r.advisorName, r.advisorTime),
  },
  {
    title: t('graduation.student.reviewerScore'),
    key: 'reviewerScore',
    width: 150,
    render: (r) => renderScoreCell(r.reviewerScore, r.reviewerName, r.reviewerTime),
  },
  {
    title: t('graduation.student.defenseScore'),
    key: 'defenseScore',
    width: 150,
    render: (r) => renderScoreCell(r.defenseScore, r.defenseName, r.defenseTime),
  },
  {
    title: t('graduation.student.totalScore'),
    key: 'totalScore',
    width: 80,
    align: 'center',
    render: (r) => r.totalScore ?? '-',
  },
  {
    title: t('graduation.common.status'),
    key: 'status',
    width: 110,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: scoreStatusTagType(r.status), size: 'small', bordered: false },
        () => r.status,
      ),
  },
  {
    title: t('graduation.common.publishTime'),
    key: 'publishTime',
    width: 150,
    render: (r) => formatDateTime(r.publishTime),
  },
  {
    title: t('graduation.common.actions'),
    key: 'actions',
    width: 150,
    render: (row) => {
      if (row.status === '已发布') return '-'
      return h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'small', onClick: () => startScore(row) }, () =>
          t('graduation.teacher.enterScore'),
        ),
        row.status === '已合成总评'
          ? h(
              NPopconfirm,
              { onPositiveClick: () => handleConfirm(row) },
              {
                default: () => t('graduation.dept.publishConfirm'),
                trigger: () =>
                  h(NButton, { size: 'small', type: 'primary' }, () =>
                    t('graduation.dept.publish'),
                  ),
              },
            )
          : h(
              NTag,
              { size: 'small', type: 'default', bordered: false },
              () => `${t('graduation.dept.missingItems')}：${missingItems(row).join('/') || '-'}`,
            ),
      ])
    },
  },
])
</script>

<template>
  <div class="graduation-page">
    <NResult
      v-if="!isDepartment"
      status="403"
      :title="$t('graduation.common.noPermission')"
      :description="$t('graduation.common.noPermissionDesc')"
    />
    <template v-else>
      <NCard class="context-card">
        <CampaignContextSelector
          v-model:campaign-id="campaignId"
          @update:campaign-id="onCampaignChange"
        />
      </NCard>

      <NCard :title="$t('graduation.dept.scoresPublishTitle')" class="content-card">
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && !list.length"
            :description="$t('graduation.dept.scoresEmpty')"
          />
          <NDataTable
            v-else
            :columns="columns"
            :data="list"
            :row-key="scoreRowKey"
            :single-line="false"
            :bordered="false"
            :scroll-x="1120"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>

      <!-- 答辩分录入弹窗 -->
      <NModal
        v-model:show="showScore"
        preset="card"
        :title="`${$t('graduation.student.defenseScore')} - ${scoreFor?.studentName ?? ''}`"
        class="graduation-score-modal"
      >
        <NForm label-placement="top">
          <NFormItem :label="$t('graduation.common.score')" required>
            <NInputNumber
              v-model:value="scoreValue"
              :min="0"
              :max="100"
              :precision="0"
              style="width: 100%"
            />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showScore = false">{{ $t('graduation.common.cancel') }}</NButton>
            <NButton type="primary" :loading="saving" @click="handleSubmitScore">
              {{ $t('graduation.common.confirm') }}
            </NButton>
          </NSpace>
        </template>
      </NModal>
    </template>
  </div>
</template>

<style scoped src="./DefenseScoresPage.css"></style>

<style>
.graduation-score-modal {
  width: 400px;
  max-width: 92vw;
}
</style>
