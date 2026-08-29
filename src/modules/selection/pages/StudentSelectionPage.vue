<script setup lang="ts">
import { ref, computed, h, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NButton,
  NTag,
  NTooltip,
  NPopconfirm,
  NDataTable,
  NEmpty,
  NSpin,
  NAlert,
  NProgress,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  fetchStudentCampaigns,
  fetchMyRecords,
  selectCourse,
  dropCourse,
} from '../api'
import type {
  SelectionRecord,
  StudentCampaign,
} from '../types'

const { t } = useI18n()
const message = useMessage()

interface GroupedSelection {
  groupId: number
  groupName: string
  groupMax: number | null
  selectedInGroup: number
  campaigns: StudentCampaign[]
}

const loading = ref(false)
const campaigns = ref<StudentCampaign[]>([])
const records = ref<SelectionRecord[]>([])

const now = ref(Date.now())
let rafHandle: number | undefined
let lastTickSecond = Math.floor(Date.now() / 1000)

function tick() {
  const current = Date.now()
  const currentSecond = Math.floor(current / 1000)
  if (currentSecond !== lastTickSecond) {
    lastTickSecond = currentSecond
    now.value = current
  }
  rafHandle = requestAnimationFrame(tick)
}

onMounted(() => {
  const current = Date.now()
  lastTickSecond = Math.floor(current / 1000)
  now.value = current
  rafHandle = requestAnimationFrame(tick)
})
onUnmounted(() => {
  if (rafHandle != null) cancelAnimationFrame(rafHandle)
})

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDateTime(s: string | null | undefined): string {
  return s ? s.replace('T', ' ') : ''
}

/**
 * 解析后端返回的时间字符串。
 * 后端格式为 "2026-7-31 23:08:20"（空格分隔，月/日可能不补零），
 * `new Date(...)` 对此格式解析不可靠（可能返回 Invalid Date），
 * 这里用正则提取数字后用 `new Date(year, month, ...)` 构造本地时间。
 */
function parseDateTime(s: string | null | undefined): number {
  if (!s) return NaN
  const normalized = s.replace('T', ' ')
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/)
  if (!match) return new Date(s).getTime()
  const [, year, month, day, hours, minutes, seconds] = match
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  ).getTime()
}

function campaignCountdown(c: StudentCampaign): string {
  if (!c || !c.endTime) return ''
  const end = parseDateTime(c.endTime)
  if (isNaN(end)) return ''
  const current = now.value
  if (current >= end) return ''
  const diff = Math.max(0, end - current)
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  // 始终携带"天"部分，避免 days 从 1 跳到 0 时显示格式突变
  // （否则"1天 00:00:00" -> "23:59:59" 会被误读为"归零后重新从 24 小时开始"）
  const timeStr = `${days}${t('selection.dayShort')} ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
  return t('selection.endIn', { time: timeStr })
}

type WindowStatus = 'before' | 'in' | 'after'

function campaignWindowStatus(c: StudentCampaign): WindowStatus {
  const start = parseDateTime(c.startTime)
  const end = parseDateTime(c.endTime)
  const current = now.value
  if (current < start) return 'before'
  if (current >= end) return 'after'
  return 'in'
}

const windowStatusTagType: Record<WindowStatus, 'default' | 'success' | 'warning'> = {
  before: 'default',
  in: 'success',
  after: 'warning',
}

function windowStatusLabel(s: WindowStatus): string {
  if (s === 'before') return t('selection.windowNotStarted')
  if (s === 'in') return t('selection.windowInProgress')
  return t('selection.windowEnded')
}

function capacityPercentage(c: StudentCampaign): number {
  if (c.capacity <= 0) return 0
  return Math.min(100, Math.round((c.selectedCount / c.capacity) * 100))
}

function capacityColor(c: StudentCampaign): string {
  if (c.remaining <= 0) return '#d03050'
  const ratio = c.capacity > 0 ? c.selectedCount / c.capacity : 0
  if (ratio >= 0.8) return '#f0a020'
  return '#18a058'
}

function findActiveRecord(campaignId: number): SelectionRecord | undefined {
  return records.value.find(
    (r) => r.campaignId === campaignId && r.status === 'SELECTED',
  )
}

function campaignNameOf(campaignId: number): string {
  return campaigns.value.find((c) => c.id === campaignId)?.name ?? '-'
}

/**
 * 将学生端活动列表按选课组分组。
 * - 有 groupId 的活动归入对应组
 * - 无 groupId 的活动归入虚拟"未分组"组（groupId = 0），不显示组上限
 *
 * 新模型下活动即课程，组内课程数 = 组内活动数，
 * 组上限进度直接使用活动返回的 selectedInGroup（跨活动累计）。
 */
const UNGROUPED_ID = 0

const groupedSelections = computed<GroupedSelection[]>(() => {
  const map = new Map<number, GroupedSelection>()
  for (const c of campaigns.value) {
    const gid = c.groupId ?? UNGROUPED_ID
    if (!map.has(gid)) {
      map.set(gid, {
        groupId: gid,
        groupName: c.groupName ?? t('selection.ungrouped'),
        groupMax: c.groupMax,
        selectedInGroup: c.selectedInGroup,
        campaigns: [],
      })
    }
    map.get(gid)!.campaigns.push(c)
  }
  return Array.from(map.values())
})

async function loadAll() {
  loading.value = true
  try {
    const campaignRes = await fetchStudentCampaigns()
    const list = campaignRes.data
    if (list.length === 0) {
      campaigns.value = []
      records.value = []
      return
    }
    const recordResults = await Promise.all(
      list.map((c) => fetchMyRecords(c.id).catch(() => null)),
    )
    campaigns.value = list
    records.value = recordResults
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .flatMap((r) => r.data)
  } catch (e) {
    message.error((e as Error).message || t('selection.loadFail'))
  } finally {
    loading.value = false
  }
}

async function handleSelect(campaign: StudentCampaign) {
  try {
    await selectCourse({ campaignId: campaign.id })
    message.success(t('selection.selectSuccess'))
    await loadAll()
  } catch (e) {
    message.error((e as Error).message || t('selection.selectFail'))
    await loadAll()
  }
}

async function handleDrop(recordId: number) {
  try {
    await dropCourse(recordId)
    message.success(t('selection.dropSuccess'))
    await loadAll()
  } catch (e) {
    message.error((e as Error).message || t('selection.dropFail'))
    await loadAll()
  }
}

const recordStatusTagType: Record<string, 'success' | 'default'> = {
  SELECTED: 'success',
  DROPPED: 'default',
}

const recordRowKey = (row: SelectionRecord) => row.id

const recordColumns = computed<DataTableColumns<SelectionRecord>>(() => [
  {
    title: t('selection.name'),
    key: 'campaignName',
    width: 160,
    ellipsis: { tooltip: true },
    render: (row) => campaignNameOf(row.campaignId),
  },
  { title: t('selection.courseName'), key: 'courseName', width: 200, ellipsis: { tooltip: true } },
  { title: t('selection.courseCode'), key: 'courseCode', width: 120 },
  { title: t('selection.credit'), key: 'credit', width: 70, align: 'center' },
  {
    title: t('selection.recordStatus'),
    key: 'status',
    width: 90,
    align: 'center',
    render(row) {
      return h(
        NTag,
        { type: recordStatusTagType[row.status] ?? 'default', bordered: false },
        () => t(`selection.${row.status}`),
      )
    },
  },
  {
    title: t('selection.selectTime'),
    key: 'selectTime',
    width: 150,
    render: (row) => formatDateTime(row.selectTime),
  },
  {
    title: t('selection.dropTime'),
    key: 'dropTime',
    width: 150,
    render: (row) => (row.dropTime ? formatDateTime(row.dropTime) : '-'),
  },
  {
    title: t('selection.actions'),
    key: 'actions',
    width: 100,
    align: 'center',
    render(row) {
      if (row.status !== 'SELECTED') return '-'
      const campaign = campaigns.value.find((c) => c.id === row.campaignId)
      const inWindow = campaign ? campaignWindowStatus(campaign) === 'in' : false
      const button = h(
        NPopconfirm,
        { onPositiveClick: () => handleDrop(row.id) },
        {
          default: () => t('selection.dropConfirm'),
          trigger: () =>
            h(
              NButton,
              { size: 'small', type: 'error', disabled: !inWindow },
              () => t('selection.dropCourse'),
            ),
        },
      )
      if (!inWindow) {
        return h(
          NTooltip,
          {},
          { trigger: () => button, default: () => t('selection.notInWindowHint') },
        )
      }
      return button
    },
  },
])

onMounted(loadAll)
</script>

<template>
  <div class="student-selection-page">
    <h2 class="page-title">{{ $t('selection.studentTitle') }}</h2>
    <NSpace vertical :size="16">
      <NSpin :show="loading">
        <NEmpty
          v-if="!loading && groupedSelections.length === 0"
          :description="$t('selection.noOpenCampaigns')"
        />
        <NSpace v-else vertical :size="16">
          <NCard
            v-for="group in groupedSelections"
            :key="group.groupId"
            class="group-card"
          >
            <template #header>
              <span class="group-card-title">{{ group.groupName }}</span>
            </template>
            <template v-if="group.groupMax != null" #header-extra>
              <NTag
                :type="group.selectedInGroup >= group.groupMax ? 'warning' : 'info'"
                size="small"
                :bordered="false"
              >
                {{
                  t('selection.groupProgress', {
                    selected: group.selectedInGroup,
                    max: group.groupMax,
                  })
                }}
              </NTag>
            </template>

            <NEmpty
              v-if="group.campaigns.length === 0"
              size="small"
              :description="$t('selection.groupCoursesEmpty')"
            />
            <div v-else class="campaign-list">
              <div
                v-for="campaign in group.campaigns"
                :key="campaign.id"
                class="campaign-row"
              >
                <div class="campaign-row-main">
                  <div class="campaign-row-header">
                    <span class="campaign-row-name">{{ campaign.name }}</span>
                    <NTag size="small" type="info" :bordered="false">
                      {{ $t('selection.publicElectiveTag') }}
                    </NTag>
                    <NTag
                      :type="windowStatusTagType[campaignWindowStatus(campaign)]"
                      size="small"
                      :bordered="false"
                    >
                      {{ windowStatusLabel(campaignWindowStatus(campaign)) }}
                    </NTag>
                    <span
                      v-if="campaignCountdown(campaign)"
                      class="countdown-text"
                    >
                      {{ campaignCountdown(campaign) }}
                    </span>
                  </div>

                  <div class="campaign-row-attrs">
                    <span class="attr-item">
                      <span class="attr-label">{{ $t('selection.courseCode') }}</span>
                      <span class="attr-value">{{ campaign.courseCode }}</span>
                    </span>
                    <span class="attr-item">
                      <span class="attr-label">{{ $t('selection.credit') }}</span>
                      <span class="attr-value">{{ campaign.credit }}</span>
                    </span>
                    <span v-if="campaign.courseHour != null" class="attr-item">
                      <span class="attr-label">{{ $t('selection.courseHour') }}</span>
                      <span class="attr-value">{{ campaign.courseHour }}</span>
                    </span>
                  </div>

                  <div class="campaign-row-capacity">
                    <span
                      class="capacity-text"
                      :class="{ 'capacity-full': campaign.remaining <= 0 }"
                    >
                      {{
                        t('selection.capacityProgress', {
                          selected: campaign.selectedCount,
                          total: campaign.capacity,
                        })
                      }}
                    </span>
                    <NProgress
                      type="line"
                      :percentage="capacityPercentage(campaign)"
                      :show-indicator="false"
                      :height="6"
                      :color="capacityColor(campaign)"
                      :rail-color="'#e8e8e8'"
                      style="flex: 1; min-width: 120px"
                    />
                    <span
                      class="capacity-remaining"
                      :class="{ 'capacity-full': campaign.remaining <= 0 }"
                    >
                      {{ $t('selection.remainingSlots', { n: campaign.remaining }) }}
                    </span>
                  </div>

                  <div class="campaign-row-context">
                    <span>{{ $t('selection.semester') }}: {{ campaign.semesterName }}</span>
                    <span>
                      {{ $t('selection.startTime') }}: {{ formatDateTime(campaign.startTime) }}
                    </span>
                    <span>
                      {{ $t('selection.endTime') }}: {{ formatDateTime(campaign.endTime) }}
                    </span>
                    <span>
                      {{ $t('selection.weekRangeValue', { start: campaign.startWeek, end: campaign.endWeek }) }}
                    </span>
                  </div>

                  <div v-if="campaign.description" class="campaign-row-desc">
                    {{ campaign.description }}
                  </div>
                </div>
                <div class="campaign-row-actions">
                  <div v-if="findActiveRecord(campaign.id)" class="selected-actions">
                    <NTag type="success" size="small" :bordered="false">
                      {{ $t('selection.SELECTED') }}
                    </NTag>
                    <NPopconfirm
                      :on-positive-click="() => {
                        const rec = findActiveRecord(campaign.id)
                        if (rec) handleDrop(rec.id)
                      }"
                    >
                      <template #trigger>
                        <NButton
                          size="small"
                          type="error"
                          :disabled="campaignWindowStatus(campaign) !== 'in'"
                        >
                          {{ $t('selection.dropCourse') }}
                        </NButton>
                      </template>
                      {{ $t('selection.dropConfirm') }}
                    </NPopconfirm>
                  </div>
                  <NTooltip v-else-if="campaignWindowStatus(campaign) !== 'in'">
                    <template #trigger>
                      <NButton size="small" type="primary" disabled>
                        {{ $t('selection.selectCourse') }}
                      </NButton>
                    </template>
                    {{ $t('selection.notInWindowHint') }}
                  </NTooltip>
                  <NTooltip v-else-if="campaign.remaining <= 0">
                    <template #trigger>
                      <NButton size="small" type="primary" disabled>
                        {{ $t('selection.selectCourse') }}
                      </NButton>
                    </template>
                    {{ $t('selection.full') }}
                  </NTooltip>
                  <NTooltip
                    v-else-if="group.groupMax != null && group.selectedInGroup >= group.groupMax"
                  >
                    <template #trigger>
                      <NButton size="small" type="primary" disabled>
                        {{ $t('selection.selectCourse') }}
                      </NButton>
                    </template>
                    {{ t('selection.groupMaxReached', { n: group.groupMax }) }}
                  </NTooltip>
                  <NButton
                    v-else
                    size="small"
                    type="primary"
                    @click="handleSelect(campaign)"
                  >
                    {{ $t('selection.selectCourse') }}
                  </NButton>
                </div>
              </div>
            </div>
          </NCard>
        </NSpace>
      </NSpin>

      <NCard v-if="groupedSelections.length > 0" :title="$t('selection.myRecords')">
        <NSpin :show="loading">
          <NAlert v-if="records.length === 0 && !loading" type="info" :show-icon="false">
            {{ $t('selection.noRecords') }}
          </NAlert>
          <NDataTable
            v-else
            :columns="recordColumns"
            :data="records"
            :row-key="recordRowKey"
            :single-line="false"
            :bordered="false"
            :scroll-x="1100"
          />
        </NSpin>
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped src="./StudentSelectionPage.css"></style>
