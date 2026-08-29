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
  NPopconfirm,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import { fetchMyAssignments, unpickStudent } from '../../api'
import { assignmentSourceTagType, formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { AssignmentResponse, CampaignResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isTeacher } = useRoleCheck()

const campaignId = ref<number | null>(null)
const list = ref<AssignmentResponse[]>([])
const loading = ref(false)
const topicEndTs = ref<number | null>(null)

async function loadList(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const res = await fetchMyAssignments(campaignId.value)
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

function onCampaign(c: CampaignResponse | null): void {
  topicEndTs.value = c ? new Date(c.topicEndTime).getTime() : null
}

/** F-R-25：教师自选 + 当前时间早于选题截止 → 显示放弃入口 */
function canUnpick(row: AssignmentResponse): boolean {
  if (row.source !== '教师自选') return false
  return topicEndTs.value != null && Date.now() < topicEndTs.value
}

async function handleUnpick(row: AssignmentResponse): Promise<void> {
  try {
    await unpickStudent(row.id)
    message.success(t('graduation.common.operationSuccess'))
    await loadList()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  }
}

const assignmentRowKey = (row: AssignmentResponse) => row.id

const columns = computed<DataTableColumns<AssignmentResponse>>(() => [
  { title: t('graduation.common.studentNo'), key: 'studentNo', width: 120 },
  { title: t('graduation.common.student'), key: 'studentName', width: 100 },
  {
    title: t('graduation.common.source'),
    key: 'source',
    width: 100,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: assignmentSourceTagType(r.source), size: 'small', bordered: false },
        () => r.source,
      ),
  },
  {
    title: t('graduation.common.assignTime'),
    key: 'assignTime',
    width: 150,
    render: (r) => formatDateTime(r.assignTime),
  },
  {
    title: t('graduation.common.prevTeacher'),
    key: 'prevTeacherName',
    width: 110,
    render: (r) => r.prevTeacherName ?? '-',
  },
  {
    title: t('graduation.common.reassignReason'),
    key: 'reassignReason',
    minWidth: 140,
    ellipsis: { tooltip: true },
    render: (r) => r.reassignReason ?? '-',
  },
  {
    title: t('graduation.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      canUnpick(row)
        ? h(
            NPopconfirm,
            { onPositiveClick: () => handleUnpick(row) },
            {
              default: () => t('graduation.teacher.unpickConfirm'),
              trigger: () =>
                h(NButton, { size: 'small', type: 'error' }, () => t('graduation.teacher.unpick')),
            },
          )
        : row.source === '教师自选' && !canUnpick(row)
          ? h(NTag, { size: 'small', type: 'default', bordered: false }, () =>
              t('graduation.teacher.deadlinePassedUnpick'),
            )
          : '-',
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
          @update:campaign="onCampaign"
        />
      </NCard>

      <NCard :title="$t('graduation.teacher.myStudentsTitle')" class="content-card">
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && !list.length"
            :description="$t('graduation.teacher.myStudentsEmpty')"
          />
          <NDataTable
            v-else
            :columns="columns"
            :data="list"
            :row-key="assignmentRowKey"
            :single-line="false"
            :bordered="false"
            :scroll-x="860"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./MyStudentsPage.css"></style>
