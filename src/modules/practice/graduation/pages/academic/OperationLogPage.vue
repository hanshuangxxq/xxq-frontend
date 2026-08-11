<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpin,
  NEmpty,
  NDataTable,
  NResult,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import { fetchOperationLogs } from '../../api'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import { formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { OperationLogResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const campaignId = ref<number | null>(null)
const logs = ref<OperationLogResponse[]>([])
const loading = ref(false)
const { pagination, reset } = useRemotePagination(loadLogs)

async function loadLogs(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const res = await fetchOperationLogs(campaignId.value, pagination.page, pagination.pageSize)
    logs.value = res.data.records
    pagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  logs.value = []
  if (id != null) {
    reset()
    loadLogs()
  }
}

const columns = computed<DataTableColumns<OperationLogResponse>>(() => [
  { title: t('graduation.academic.operatorName'), key: 'operatorName', width: 100 },
  {
    title: t('graduation.academic.operatorType'),
    key: 'operatorType',
    width: 90,
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
    <NResult
      v-if="!isAcademicAdmin"
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

      <NCard :title="$t('graduation.academic.operationLogTitle')" class="content-card">
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && !logs.length"
            :description="$t('graduation.academic.logEmpty')"
          />
          <NDataTable
            v-else
            :columns="columns"
            :data="logs"
            :row-key="(r: OperationLogResponse) => r.id"
            :single-line="false"
            :bordered="false"
            :scroll-x="960"
            remote
            :pagination="pagination"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./OperationLogPage.css"></style>
