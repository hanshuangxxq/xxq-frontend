<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpin,
  NEmpty,
  NButton,
  NDataTable,
  NResult,
  NTag,
  NSpace,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import ReviewModal from '../../components/ReviewModal.vue'
import { fetchTeacherOpeningReports, reviewOpeningReport, downloadOpeningReport } from '../../api'
import { openingStatusTagType, formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { OpeningReportResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isTeacher } = useRoleCheck()

const campaignId = ref<number | null>(null)
const list = ref<OpeningReportResponse[]>([])
const loading = ref(false)

async function loadList(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const res = await fetchTeacherOpeningReports(campaignId.value)
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

// ===== 审核弹窗 =====
const showReview = ref(false)
const reviewing = ref<OpeningReportResponse | null>(null)
const submitting = ref(false)

function startReview(row: OpeningReportResponse): void {
  reviewing.value = row
  showReview.value = true
}

async function handleReview(value: { approve?: boolean; comment?: string }): Promise<void> {
  if (!reviewing.value) return
  submitting.value = true
  try {
    await reviewOpeningReport(reviewing.value.id, {
      approve: value.approve ?? false,
      comment: value.comment,
    })
    message.success(t('graduation.common.operationSuccess'))
    showReview.value = false
    await loadList()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  } finally {
    submitting.value = false
  }
}

async function handleDownload(row: OpeningReportResponse): Promise<void> {
  try {
    await downloadOpeningReport(row.id)
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  }
}

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
    <NResult
      v-if="!isTeacher"
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

      <NCard :title="$t('graduation.teacher.openingReviewTitle')" class="content-card">
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && !list.length"
            :description="$t('graduation.teacher.noPendingReview')"
          />
          <NDataTable
            v-else
            :columns="columns"
            :data="list"
            :row-key="(r: OpeningReportResponse) => r.id"
            :single-line="false"
            :bordered="false"
            :scroll-x="820"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
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
