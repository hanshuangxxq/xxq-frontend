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
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import ReviewModal from '../../components/ReviewModal.vue'
import { fetchPendingDeptProposals, reviewProposalDept } from '../../api'
import { formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { ProposalResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isDepartment } = useRoleCheck()

const campaignId = ref<number | null>(null)
const list = ref<ProposalResponse[]>([])
const loading = ref(false)

async function loadList(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const res = await fetchPendingDeptProposals(campaignId.value)
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

// ===== 初审弹窗 =====
const showReview = ref(false)
const reviewing = ref<ProposalResponse | null>(null)
const submitting = ref(false)

function startReview(row: ProposalResponse): void {
  reviewing.value = row
  showReview.value = true
}

async function handleReview(value: { approve?: boolean; comment?: string }): Promise<void> {
  if (!reviewing.value) return
  submitting.value = true
  try {
    await reviewProposalDept(reviewing.value.id, {
      approve: value.approve ?? false,
      comment: value.comment,
    })
    message.success(t('graduation.common.operationSuccess'))
    showReview.value = false
    await loadList()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
    // F-R-42：409 状态不匹配（他人已处理）时刷新队列
    await loadList()
  } finally {
    submitting.value = false
  }
}

const proposalRowKey = (row: ProposalResponse) => row.id

const columns = computed<DataTableColumns<ProposalResponse>>(() => [
  {
    type: 'expand',
    width: 40,
    renderExpand: (row) =>
      h('div', { class: 'review-detail' }, [
        h('div', { class: 'detail-label' }, t('graduation.common.contentFull')),
        h('div', { class: 'detail-content' }, row.content),
      ]),
  },
  { title: t('graduation.common.studentNo'), key: 'studentNo', width: 120 },
  { title: t('graduation.common.student'), key: 'studentName', width: 100 },
  {
    title: t('graduation.common.title'),
    key: 'title',
    minWidth: 200,
    ellipsis: { tooltip: true },
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
    width: 100,
    render: (row) =>
      h(NButton, { size: 'small', type: 'primary', onClick: () => startReview(row) }, () =>
        t('graduation.dept.reviewProposal'),
      ),
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

      <NCard :title="$t('graduation.dept.proposalReviewTitle')" class="content-card">
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && !list.length"
            :description="$t('graduation.dept.pendingEmpty')"
          />
          <NDataTable
            v-else
            :columns="columns"
            :data="list"
            :row-key="proposalRowKey"
            :single-line="false"
            :bordered="false"
            :scroll-x="760"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>

      <ReviewModal
        v-model:show="showReview"
        mode="approve"
        :title="$t('graduation.dept.reviewProposal')"
        :hint="reviewing ? `${reviewing.studentName} - ${reviewing.title}` : undefined"
        :submitting="submitting"
        @submit="handleReview"
      />
    </template>
  </div>
</template>

<style scoped src="./ProposalReviewPage.css"></style>
