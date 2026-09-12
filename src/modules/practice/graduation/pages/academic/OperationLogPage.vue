<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCard, NEmpty, NDataTable, NTag, useMessage, type DataTableColumns } from 'naive-ui'
import ForbiddenState from '@/shared/components/ForbiddenState.vue'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import { fetchOperationLogs } from '../../api'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import { useLoading } from '@/shared/composables/useLoading'
import { isReportedError } from '@/shared/api'
import { formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { OperationLogResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const campaignId = ref<number | null>(null)
const logs = ref<OperationLogResponse[]>([])
const { loading, withLoading } = useLoading()
const { pagination, reset } = useRemotePagination(loadLogs)

function loadLogs(): Promise<void> {
  return withLoading(async () => {
    if (campaignId.value == null) return
    try {
      const res = await fetchOperationLogs(campaignId.value, pagination.page, pagination.pageSize)
      logs.value = res.data.records
      pagination.itemCount = res.data.total
    } catch (e) {
      if (!isReportedError(e))
        message.error((e as Error).message || t('graduation.common.loadFail'))
    }
  })
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  logs.value = []
  if (id != null) {
    reset()
    loadLogs()
  }
}

const operationLogRowKey = (row: OperationLogResponse) => row.id

const columns = computed<DataTableColumns<OperationLogResponse>>(() => [
  { title: t('graduation.academic.operatorName'), key: 'operatorName', width: 100 },
  {
    title: t('graduation.academic.operatorType'),
    key: 'operatorType',
    width: 130,
    align: 'center',
    render: (r) => h(NTag, { size: 'small', bordered: false }, () => r.operatorType),
  },
  { title: t('graduation.academic.action'), key: 'action', minWidth: 140 },
  {
    title: t('graduation.academic.target'),
    key: 'targetType',
    width: 110,
    render: (r) => `${r.targetType} #${r.targetId}`,
  },
  {
    title: t('graduation.academic.detail'),
    key: 'detail',
    minWidth: 220,
    ellipsis: { tooltip: true },
    render: (r) => r.detail || '-',
  },
  {
    title: t('graduation.common.createTime'),
    key: 'createTime',
    width: 150,
    render: (r) => formatDateTime(r.createTime),
  },
])
</script>

<template>
  <div class="graduation-page">
    <ForbiddenState v-if="!isAcademicAdmin" />
    <template v-else>
      <NCard class="context-card">
        <CampaignContextSelector
          v-model:campaign-id="campaignId"
          @update:campaign-id="onCampaignChange"
        />
      </NCard>

      <NCard :title="$t('graduation.academic.operationLogTitle')" class="content-card">
        <NEmpty
          v-if="!loading && !logs.length"
          :description="$t('graduation.academic.logEmpty')"
        />
        <NDataTable
          v-else
          :columns="columns"
          :data="logs"
          :row-key="operationLogRowKey"
          :single-line="false"
          :bordered="false"
          :scroll-x="1000"
          remote
          :pagination="pagination"
        >
          <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
        </NDataTable>
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./OperationLogPage.css"></style>
