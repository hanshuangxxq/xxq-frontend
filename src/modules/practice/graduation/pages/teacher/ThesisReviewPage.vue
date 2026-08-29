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
import { fetchTeacherTheses, reviewThesis, downloadThesis } from '../../api'
import {
  thesisStatusTagType,
  duplicateResultTagType,
  formatDateTime,
} from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { ThesisResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isTeacher } = useRoleCheck()

const campaignId = ref<number | null>(null)
const list = ref<ThesisResponse[]>([])
const loading = ref(false)

async function loadList(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const res = await fetchTeacherTheses(campaignId.value)
    // 最新版优先展示
    list.value = (res.data ?? []).sort((a, b) => b.isLatest - a.isLatest || b.version - a.version)
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

// ===== 审查弹窗 =====
const showReview = ref(false)
const reviewing = ref<ThesisResponse | null>(null)
const submitting = ref(false)

/** 仅最新版状态为「待形式审查」时可审查（其余只读） */
function canReview(row: ThesisResponse): boolean {
  return row.isLatest === 1 && row.status === '待形式审查'
}

function startReview(row: ThesisResponse): void {
  reviewing.value = row
  showReview.value = true
}

async function handleReview(value: { approve?: boolean; comment?: string }): Promise<void> {
  if (!reviewing.value) return
  submitting.value = true
  try {
    await reviewThesis(reviewing.value.id, {
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

async function handleDownload(row: ThesisResponse): Promise<void> {
  try {
    await downloadThesis(row.id)
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  }
}

const thesisRowKey = (row: ThesisResponse) => row.id

const columns = computed<DataTableColumns<ThesisResponse>>(() => [
  {
    type: 'expand',
    width: 40,
    renderExpand: (row) =>
      h('div', { class: 'review-detail' }, [
        h('div', { class: 'detail-label' }, t('graduation.teacher.thesisVersionHistory')),
        ...list.value
          .filter((x) => x.studentId === row.studentId)
          .sort((a, b) => b.version - a.version)
          .map((v) =>
            h('div', { class: 'version-row' }, [
              h(NSpace, { size: 8, align: 'center' }, () => [
                h('b', null, `v${v.version}`),
                h(
                  NTag,
                  { size: 'tiny', type: thesisStatusTagType(v.status), bordered: false },
                  () => v.status,
                ),
                h('span', { class: 'version-meta' }, formatDateTime(v.submitTime)),
                h(
                  NButton,
                  { size: 'tiny', quaternary: true, onClick: () => handleDownload(v) },
                  () => t('graduation.common.download'),
                ),
              ]),
              v.reviewComment
                ? h(
                    'div',
                    { class: 'version-comment' },
                    `${t('graduation.common.reviewComment')}：${v.reviewComment}`,
                  )
                : null,
              v.duplicateChecks.length
                ? h(
                    'div',
                    { class: 'version-duplicates' },
                    v.duplicateChecks.map((c) =>
                      h('div', { class: 'duplicate-row' }, [
                        h(
                          'span',
                          null,
                          `${t('graduation.student.duplicateRate')}：${c.duplicateRate}% · ${t('graduation.student.duplicatePlatform')}：${c.platform ?? '-'} · ${t('graduation.student.duplicateTime')}：${formatDateTime(c.checkTime)} `,
                        ),
                        h(
                          NTag,
                          { size: 'tiny', type: duplicateResultTagType(c.result), bordered: false },
                          () => c.result,
                        ),
                      ]),
                    ),
                  )
                : null,
            ]),
          ),
      ]),
  },
  { title: t('graduation.common.student'), key: 'studentName', width: 100 },
  {
    title: t('graduation.student.thesisTitleField'),
    key: 'title',
    minWidth: 180,
    ellipsis: { tooltip: true },
  },
  {
    title: t('graduation.student.thesisVersion'),
    key: 'version',
    width: 90,
    align: 'center',
    render: (r) =>
      h(NSpace, { size: 6, align: 'center', justify: 'center' }, () => [
        h('span', null, `v${r.version}`),
        r.isLatest === 1
          ? h(NTag, { size: 'tiny', type: 'success', bordered: false }, () =>
              t('graduation.student.thesisLatest'),
            )
          : null,
      ]),
  },
  {
    title: t('graduation.common.status'),
    key: 'status',
    width: 120,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: thesisStatusTagType(r.status), size: 'small', bordered: false },
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
        canReview(row)
          ? h(NButton, { size: 'small', type: 'primary', onClick: () => startReview(row) }, () =>
              t('graduation.common.review'),
            )
          : h('span', { style: 'color:#999;font-size:13px' }, '-'),
        h(NButton, { size: 'small', onClick: () => handleDownload(row) }, () =>
          t('graduation.teacher.downloadThesis'),
        ),
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

      <NCard :title="$t('graduation.teacher.thesisReviewTitle')" class="content-card">
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && !list.length"
            :description="$t('graduation.teacher.noPendingReview')"
          />
          <NDataTable
            v-else
            :columns="columns"
            :data="list"
            :row-key="thesisRowKey"
            :single-line="false"
            :bordered="false"
            :scroll-x="860"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>

      <ReviewModal
        v-model:show="showReview"
        mode="approve"
        :title="$t('graduation.teacher.reviewThesis')"
        :hint="
          reviewing
            ? `${reviewing.studentName} - ${reviewing.title} (v${reviewing.version})`
            : undefined
        "
        :reject-label="$t('graduation.common.return')"
        :submitting="submitting"
        @submit="handleReview"
      />
    </template>
  </div>
</template>

<style scoped src="./ThesisReviewPage.css"></style>
