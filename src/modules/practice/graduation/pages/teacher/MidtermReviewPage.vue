<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NEmpty,
  NButton,
  NDataTable,
  NTag,
  NSpace,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import ForbiddenState from '@/shared/components/ForbiddenState.vue'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import ReviewModal from '../../components/ReviewModal.vue'
import { fetchTeacherMidterms, reviewMidterm, downloadMidterm } from '../../api'
import { midtermConclusionTagType, formatDateTime } from '@/modules/practice/utils'
import { useLoading } from '@/shared/composables/useLoading'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { MidtermResponse, MidtermConclusionCode } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isTeacher } = useRoleCheck()

const campaignId = ref<number | null>(null)
const list = ref<MidtermResponse[]>([])
const { loading, withLoading } = useLoading()

function loadList() {
  if (campaignId.value == null) return
  const id = campaignId.value
  return withLoading(async () => {
    try {
      const res = await fetchTeacherMidterms(id)
      list.value = res.data ?? []
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('graduation.common.loadFail'))
      }
    }
  })
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  list.value = []
  if (id != null) void loadList()
}

// ===== 评审弹窗（结论必选 + 意见选填）=====
const showReview = ref(false)
const reviewing = ref<MidtermResponse | null>(null)
const { loading: submitting, withLoading: withSubmitting } = useLoading()

function startReview(row: MidtermResponse): void {
  reviewing.value = row
  showReview.value = true
}

function handleReview(value: { conclusion?: MidtermConclusionCode; comment?: string }) {
  if (!reviewing.value || !value.conclusion) return
  const target = reviewing.value
  const conclusion = value.conclusion
  return withSubmitting(async () => {
    try {
      await reviewMidterm(target.id, {
        conclusion,
        comment: value.comment,
      })
      message.success(t('graduation.common.operationSuccess'))
      showReview.value = false
      await loadList()
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('graduation.common.operationFail'))
      }
    }
  })
}

async function handleDownload(row: MidtermResponse): Promise<void> {
  try {
    await downloadMidterm(row.id)
  } catch (e) {
    if (!isReportedError(e)) {
      message.error((e as Error).message || t('graduation.common.operationFail'))
    }
  }
}

const midtermRowKey = (row: MidtermResponse) => row.id

const columns = computed<DataTableColumns<MidtermResponse>>(() => [
  {
    type: 'expand',
    width: 40,
    renderExpand: (row) =>
      h('div', { class: 'review-detail' }, [
        h('div', { class: 'detail-label' }, t('graduation.teacher.midtermContentLabel')),
        h('div', { class: 'detail-content' }, row.content),
        row.reviewComment
          ? h(
              'div',
              { class: 'detail-comment' },
              `${t('graduation.common.reviewComment')}：${row.reviewComment}`,
            )
          : null,
      ]),
  },
  { title: t('graduation.common.student'), key: 'studentName', width: 100 },
  {
    title: t('graduation.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: r.status === '已评审' ? 'success' : 'warning', size: 'small', bordered: false },
        () => r.status,
      ),
  },
  {
    title: t('graduation.teacher.conclusion'),
    key: 'conclusion',
    width: 110,
    align: 'center',
    render: (r) =>
      r.conclusion
        ? h(
            NTag,
            { type: midtermConclusionTagType(r.conclusion), size: 'small', bordered: false },
            () => r.conclusion,
          )
        : '-',
  },
  {
    title: t('graduation.common.submitTime'),
    key: 'submitTime',
    width: 150,
    render: (r) => formatDateTime(r.submitTime),
  },
  {
    title: t('graduation.common.actions'),
    key: 'actions',
    width: 160,
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        row.status === '已提交'
          ? h(NButton, { size: 'small', type: 'primary', onClick: () => startReview(row) }, () =>
              t('graduation.common.review'),
            )
          : h('span', { style: 'color:#999;font-size:13px' }, '-'),
        row.fileOriginal
          ? h(NButton, { size: 'small', onClick: () => handleDownload(row) }, () =>
              t('graduation.common.download'),
            )
          : null,
      ]),
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

      <NCard :title="$t('graduation.teacher.midtermReviewTitle')" class="content-card">
        <NEmpty
          v-if="!loading && !list.length"
          :description="$t('graduation.teacher.noPendingReview')"
        />
        <NDataTable
          v-else
          :columns="columns"
          :data="list"
          :row-key="midtermRowKey"
          :single-line="false"
          :bordered="false"
          :scroll-x="720"
        >
          <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
        </NDataTable>
      </NCard>

      <ReviewModal
        v-model:show="showReview"
        mode="conclusion"
        :title="$t('graduation.teacher.reviewMidterm')"
        :hint="reviewing ? reviewing.studentName : undefined"
        :submitting="submitting"
        @submit="handleReview"
      />
    </template>
  </div>
</template>

<style scoped src="./MidtermReviewPage.css"></style>
