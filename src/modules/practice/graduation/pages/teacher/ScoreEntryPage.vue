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
  NTag,
  NSpace,
  NTabs,
  NTabPane,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import ForbiddenState from '@/shared/components/ForbiddenState.vue'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import {
  fetchAdvisorScoreEntries,
  fetchReviewerScoreEntries,
  fetchTeacherTheses,
  submitAdvisorScore,
  submitReviewerScore,
} from '../../api'
import { scoreStatusTagType, formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { ScoreResponse, ThesisResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isTeacher } = useRoleCheck()

const activeTab = ref('advisor')
const campaignId = ref<number | null>(null)
const advisorRows = ref<ScoreResponse[]>([])
const reviewerRows = ref<ScoreResponse[]>([])
const theses = ref<ThesisResponse[]>([])
const loading = ref(false)

/** 学生 id -> 最新版论文状态（用于 F-R-27 预判） */
const thesisStatusOf = computed(() => {
  const map = new Map<number, string>()
  for (const th of theses.value) {
    if (th.isLatest === 1) map.set(th.studentId, th.status)
  }
  return map
})

function isDuplicatePassed(studentId: number): boolean {
  return thesisStatusOf.value.get(studentId) === '查重通过'
}

async function loadData(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const [aRes, rRes, thRes] = await Promise.all([
      fetchAdvisorScoreEntries(campaignId.value),
      fetchReviewerScoreEntries(campaignId.value),
      fetchTeacherTheses(campaignId.value),
    ])
    advisorRows.value = aRes.data ?? []
    reviewerRows.value = rRes.data ?? []
    theses.value = thRes.data ?? []
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  advisorRows.value = []
  reviewerRows.value = []
  theses.value = []
  if (id != null) void loadData()
}

// ===== 评分弹窗 =====
const showScore = ref(false)
const scoreFor = ref<{
  studentId: number
  studentName: string
  mode: 'advisor' | 'reviewer'
} | null>(null)
const scoreValue = ref<number | null>(null)
const saving = ref(false)

function startScore(row: ScoreResponse, mode: 'advisor' | 'reviewer'): void {
  scoreFor.value = {
    studentId: row.studentId,
    studentName: row.studentName,
    mode,
  }
  scoreValue.value = mode === 'advisor' ? (row.advisorScore ?? null) : (row.reviewerScore ?? null)
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
    const body = { campaignId: campaignId.value, studentId: scoreFor.value.studentId, score: s }
    if (scoreFor.value.mode === 'advisor') {
      await submitAdvisorScore(body)
    } else {
      await submitReviewerScore(body)
    }
    message.success(t('graduation.common.operationSuccess'))
    showScore.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  } finally {
    saving.value = false
  }
}

// ===== 列定义 =====
const scoreRowKey = (row: ScoreResponse) => row.studentId

const advisorColumns = computed<DataTableColumns<ScoreResponse>>(() => [
  { title: t('graduation.common.student'), key: 'studentName', width: 110 },
  {
    title: t('graduation.student.advisorScore'),
    key: 'advisorScore',
    width: 90,
    align: 'center',
    render: (r) => r.advisorScore ?? '-',
  },
  {
    title: t('graduation.dept.recordBy'),
    key: 'advisorName',
    width: 100,
    render: (r) => r.advisorName ?? '-',
  },
  {
    title: t('graduation.dept.recordTime'),
    key: 'advisorTime',
    width: 150,
    render: (r) => formatDateTime(r.advisorTime),
  },
  {
    title: t('graduation.common.status'),
    key: 'status',
    width: 110,
    align: 'center',
    render: (r) => {
      if (!r.status) return '-'
      return h(
        NTag,
        { type: scoreStatusTagType(r.status), size: 'small', bordered: false },
        () => r.status,
      )
    },
  },
  {
    title: t('graduation.common.actions'),
    key: 'actions',
    width: 150,
    render: (row) => {
      // F-R-26：已发布只读；F-R-27：未查重通过标注原因
      if (row.status === '已发布') {
        return h(NTag, { size: 'small', type: 'default', bordered: false }, () =>
          t('graduation.teacher.publishedReadonly'),
        )
      }
      if (!isDuplicatePassed(row.studentId)) {
        return h(NTag, { size: 'small', type: 'warning', bordered: false }, () =>
          t('graduation.teacher.notDuplicatePassed'),
        )
      }
      return h(
        NButton,
        { size: 'small', type: 'primary', onClick: () => startScore(row, 'advisor') },
        () => t('graduation.teacher.enterScore'),
      )
    },
  },
])

/** 评阅评分：本人为评阅人的学生（由 /scores/reviewer 录入列表返回） */
const reviewerColumns = computed<DataTableColumns<ScoreResponse>>(() => [
  { title: t('graduation.common.studentNo'), key: 'studentNo', width: 120 },
  { title: t('graduation.common.student'), key: 'studentName', width: 110 },
  {
    title: t('graduation.student.defenseGroup'),
    key: 'groupName',
    width: 120,
    render: (r) => r.groupName ?? '-',
  },
  {
    title: t('graduation.student.reviewerScore'),
    key: 'reviewerScore',
    width: 90,
    align: 'center',
    render: (r) => r.reviewerScore ?? '-',
  },
  {
    title: t('graduation.common.actions'),
    key: 'actions',
    width: 150,
    render: (row) => {
      if (row.status === '已发布') {
        return h(NTag, { size: 'small', type: 'default', bordered: false }, () =>
          t('graduation.teacher.publishedReadonly'),
        )
      }
      if (!isDuplicatePassed(row.studentId)) {
        return h(NTag, { size: 'small', type: 'warning', bordered: false }, () =>
          t('graduation.teacher.notDuplicatePassed'),
        )
      }
      return h(
        NButton,
        { size: 'small', type: 'primary', onClick: () => startScore(row, 'reviewer') },
        () => t('graduation.teacher.enterScore'),
      )
    },
  },
])
</script>

<template>
  <div class="graduation-page">
    <ForbiddenState v-if="!isTeacher" />
    <template v-else>
      <NCard class="context-card">
        <CampaignContextSelector
          v-model:campaign-id="campaignId"
          @update:campaign-id="onCampaignChange"
        />
      </NCard>

      <NCard :title="$t('graduation.teacher.scoreEntryTitle')" class="content-card">
        <NTabs v-model:value="activeTab" type="line" animated>
          <NTabPane name="advisor" :tab="$t('graduation.teacher.advisorTab')">
            <NSpin :show="loading">
              <NEmpty
                v-if="!loading && !advisorRows.length"
                :description="$t('graduation.common.empty')"
              />
              <NDataTable
                v-else
                :columns="advisorColumns"
                :data="advisorRows"
                :row-key="scoreRowKey"
                :single-line="false"
                :bordered="false"
                :scroll-x="720"
              >
                <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
              </NDataTable>
            </NSpin>
          </NTabPane>
          <NTabPane name="reviewer" :tab="$t('graduation.teacher.reviewerTab')">
            <NSpin :show="loading">
              <NEmpty
                v-if="!loading && !reviewerRows.length"
                :description="$t('graduation.common.empty')"
              />
              <NDataTable
                v-else
                :columns="reviewerColumns"
                :data="reviewerRows"
                :row-key="scoreRowKey"
                :single-line="false"
                :bordered="false"
                :scroll-x="620"
              >
                <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
              </NDataTable>
            </NSpin>
          </NTabPane>
        </NTabs>
      </NCard>

      <!-- 评分弹窗 -->
      <NModal
        v-model:show="showScore"
        preset="card"
        :title="
          (scoreFor?.mode === 'advisor'
            ? $t('graduation.teacher.advisorTab')
            : $t('graduation.teacher.reviewerTab')) + ` - ${scoreFor?.studentName ?? ''}`
        "
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

<style scoped src="./ScoreEntryPage.css"></style>

<style>
.graduation-score-modal {
  width: 400px;
  max-width: 92vw;
}
</style>
