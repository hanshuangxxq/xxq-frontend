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
import { fetchTeacherPool, fetchMyAssignments, pickStudent } from '../../api'
import { proposalStatusTagType, assignmentSourceTagType } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { TeacherPickPoolRow, AssignmentResponse, CampaignResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isTeacher } = useRoleCheck()

const campaignId = ref<number | null>(null)
const pool = ref<TeacherPickPoolRow[]>([])
const myAssignments = ref<AssignmentResponse[]>([])
const loading = ref(false)
const pickingId = ref<number | null>(null)

/** 已自选数（来源=教师自选） */
const pickedCount = computed(
  () => myAssignments.value.filter((a) => a.source === '教师自选').length,
)

/** 自由选择上限（来自选中活动的 freeSelectCapacity） */
const freeLimit = ref<number | null>(null)

/** F-R-23：达到自由选择上限后所有未选行禁用 */
const limitReached = computed(() => {
  const l = freeLimit.value
  return l != null && pickedCount.value >= l
})

function canPick(row: TeacherPickPoolRow): boolean {
  if (row.assigned) return false
  if (limitReached.value) return false
  return true
}

async function loadPool(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const [poolRes, myRes] = await Promise.all([
      fetchTeacherPool(campaignId.value),
      fetchMyAssignments(campaignId.value),
    ])
    pool.value = poolRes.data ?? []
    myAssignments.value = myRes.data ?? []
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  pool.value = []
  myAssignments.value = []
  if (id != null) void loadPool()
}

/** 活动上下文（含名额上限） */
function onCampaign(c: CampaignResponse | null): void {
  freeLimit.value = c?.freeSelectCapacity ?? null
}

async function handlePick(row: TeacherPickPoolRow): Promise<void> {
  if (campaignId.value == null) return
  pickingId.value = row.studentId
  try {
    await pickStudent({ campaignId: campaignId.value, studentId: row.studentId })
    message.success(t('graduation.common.operationSuccess'))
    await loadPool()
  } catch (e) {
    // F-R-24：409 抢选失败时刷新池列表（错误提示已由 api 层展示）
    message.error((e as Error).message || t('graduation.common.operationFail'))
    await loadPool()
  } finally {
    pickingId.value = null
  }
}

const poolColumns = computed<DataTableColumns<TeacherPickPoolRow>>(() => [
  { title: t('graduation.common.studentNo'), key: 'studentNo', width: 120 },
  { title: t('graduation.common.student'), key: 'studentName', width: 100 },
  { title: t('graduation.common.className'), key: 'className', width: 120 },
  {
    title: t('graduation.common.title'),
    key: 'proposalTitle',
    minWidth: 180,
    ellipsis: { tooltip: true },
    render: (r) => r.proposalTitle ?? '-',
  },
  {
    title: t('graduation.common.content'),
    key: 'proposalContent',
    minWidth: 220,
    ellipsis: { tooltip: true },
    render: (r) => r.proposalContent ?? '-',
  },
  {
    title: t('graduation.common.status'),
    key: 'proposalStatus',
    width: 110,
    align: 'center',
    render: (r) =>
      r.proposalStatus
        ? h(
            NTag,
            { type: proposalStatusTagType(r.proposalStatus), size: 'small', bordered: false },
            () => r.proposalStatus,
          )
        : '-',
  },
  {
    title: t('graduation.common.source'),
    key: 'assignmentSource',
    width: 100,
    align: 'center',
    render: (r) =>
      r.assigned && r.assignmentSource
        ? h(
            NTag,
            { type: assignmentSourceTagType(r.assignmentSource), size: 'small', bordered: false },
            () => r.assignmentSource,
          )
        : '-',
  },
  {
    title: t('graduation.common.actions'),
    key: 'actions',
    width: 110,
    render: (row) => {
      if (row.assigned) {
        return h(NTag, { type: 'info', size: 'small', bordered: false }, () =>
          t('graduation.teacher.alreadyPicked'),
        )
      }
      return h(
        NButton,
        {
          size: 'small',
          type: 'primary',
          disabled: !canPick(row),
          loading: pickingId.value === row.studentId,
          onClick: () => handlePick(row),
        },
        () => t('graduation.teacher.pick'),
      )
    },
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
        <NSpace align="center" :size="16">
          <CampaignContextSelector
            v-model:campaign-id="campaignId"
            @update:campaign-id="onCampaignChange"
            @update:campaign="onCampaign"
          />
          <span class="limit-hint">
            {{
              $t('graduation.teacher.pickLimit', { count: pickedCount, limit: freeLimit ?? '-' })
            }}
          </span>
        </NSpace>
      </NCard>

      <NCard :title="$t('graduation.teacher.poolTitle')" class="content-card">
        <template #header-extra>
          <span class="pool-hint">{{ $t('graduation.teacher.poolHint') }}</span>
        </template>
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && !pool.length"
            :description="$t('graduation.teacher.poolEmpty')"
          />
          <NDataTable
            v-else
            :columns="poolColumns"
            :data="pool"
            :row-key="(r: TeacherPickPoolRow) => r.studentId"
            :single-line="false"
            :bordered="false"
            :scroll-x="1080"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./StudentPoolPage.css"></style>
