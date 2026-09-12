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
import { fetchTeacherOpeningReports, reviewOpeningReport, downloadOpeningReport } from '../../api'
import { openingStatusTagType, formatDateTime } from '@/modules/practice/utils'
import { useLoading } from '@/shared/composables/useLoading'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { OpeningReportResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isTeacher } = useRoleCheck()

const campaignId = ref<number | null>(null)
const list = ref<OpeningReportResponse[]>([])
const { loading, withLoading } = useLoading()

function loadList() {
  if (campaignId.value == null) return
  const id = campaignId.value
  return withLoading(async () => {
    try {
      const res = await fetchTeacherOpeningReports(id)
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

// ===== 审核弹窗 =====
const showReview = ref(false)
const reviewing = ref<OpeningReportResponse | null>(null)
const { loading: submitting, withLoading: withSubmitting } = useLoading()

function startReview(row: OpeningReportResponse): void {
  reviewing.value = row
  showReview.value = true
}

function handleReview(value: { approve?: boolean; comment?: string }) {
  if (!reviewing.value) return
  const target = reviewing.value
  return withSubmitting(async () => {
    try {
      await reviewOpeningReport(target.id, {
        approve: value.approve ?? false,
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

async function handleDownload(row: OpeningReportResponse): Promise<void> {
  try {
    await downloadOpeningReport(row.id)
  } catch (e) {
    if (!isReportedError(e)) {
      message.error((e as Error).message || t('graduation.common.operationFail'))
    }
  }
}

const openingReportRowKey = (row: OpeningReportResponse) => row.id

const columns = computed<DataTableColumns<OpeningReportResponse>>(() => [
  {
    type: 'expand',
    width: 40,
    renderExpand: (row) =>
      h('div', { class: 'review-detail' }, [
        h('div', { class: 'detail-label' }, t('graduation.teacher.openingContentLabel')),
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
    title: t('graduation.student.openingTitleField'),
    key: 'title',
    minWidth: 180,
    ellipsis: { tooltip: true },
  },
  {
    title: t('graduation.common.status'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: openingStatusTagType(r.status), size: 'small', bordered: false },
        () => r.status,
      ),
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

      <NCard :title="$t('graduation.teacher.openingReviewTitle')" class="content-card">
        <NEmpty
          v-if="!loading && !list.length"
          :description="$t('graduation.teacher.noPendingReview')"
        />
        <NDataTable
          v-else
          :columns="columns"
          :data="list"
          :row-key="openingReportRowKey"
          :single-line="false"
          :bordered="false"
          :scroll-x="820"
        >
          <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
        </NDataTable>
      </NCard>

      <ReviewModal
        v-model:show="showReview"
        mode="approve"
        :title="$t('graduation.teacher.reviewOpening')"
        :hint="reviewing ? `${reviewing.studentName} - ${reviewing.title}` : undefined"
        :reject-label="$t('graduation.common.return')"
        :submitting="submitting"
        @submit="handleReview"
      />
    </template>
  </div>
</template>

<style scoped src="./OpeningReviewPage.css"></style>
