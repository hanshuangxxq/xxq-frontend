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
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  fetchStudentCampaigns,
  fetchStudentCourseGroups,
  fetchMyRecords,
  selectCourse,
  dropCourse,
} from '../api'
import type {
  Campaign,
  SelectionRecord,
  StudentCourseGroup,
  SelectionCourse,
} from '../types'

const { t } = useI18n()
const message = useMessage()

interface CampaignDetail {
  campaign: Campaign
  groups: StudentCourseGroup[]
}

interface SelectionItem {
  campaign: Campaign
  course: SelectionCourse | null
}

interface GroupedSelection {
  groupId: number
  groupName: string
  groupMax: number
  items: SelectionItem[]
}

const loading = ref(false)
const campaignDetails = ref<CampaignDetail[]>([])
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
  lastTickSecond = Math.floor(Date.now() / 1000)
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

function campaignCountdown(c: Campaign): string {
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
  const timeStr =
    days > 0
      ? `${days}${t('selection.dayShort')} ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
      : `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
  return t('selection.endIn', { time: timeStr })
}

type WindowStatus = 'before' | 'in' | 'after'

function campaignWindowStatus(c: Campaign): WindowStatus {
  const start = parseDateTime(c.startTime)
  const end = parseDateTime(c.endTime)
  const current = now.value
  if (current < start) return 'before'
  if (current > end) return 'after'
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

function findActiveRecord(campaignId: number): SelectionRecord | undefined {
  return records.value.find(
    (r) => r.campaignId === campaignId && r.status === 'SELECTED',
  )
}

function campaignNameOf(campaignId: number): string {
  return campaignDetails.value.find((d) => d.campaign.id === campaignId)?.campaign.name ?? '-'
}

/**
 * 活动 -> 所属选课组的映射（一个活动只绑定一个组）。
 * 用于按组累计已选数，不依赖 `group.courses` 是否返回。
 */
const campaignToGroup = computed(() => {
  const map = new Map<number, number>()
  for (const detail of campaignDetails.value) {
    if (detail.groups.length > 0) {
      map.set(detail.campaign.id, detail.groups[0]!.groupId)
    }
  }
  return map
})

/**
 * 跨活动累计的选课组已选数。
 * 直接基于 `records`（选课记录）统计，而非 `group.courses` 中的 `selectedByMe`，
 * 这样即使后端未返回课程详情，也能正确展示组上限进度。
 */
const crossCampaignSelectedCounts = computed(() => {
  const counts = new Map<number, number>()
  for (const record of records.value) {
    if (record.status !== 'SELECTED') continue
    const groupId = campaignToGroup.value.get(record.campaignId)
    if (groupId == null) continue
    counts.set(groupId, (counts.get(groupId) ?? 0) + 1)
  }
  return counts
})

function selectedInGroupCross(groupId: number): number {
  return crossCampaignSelectedCounts.value.get(groupId) ?? 0
}

/**
 * 将 `campaignDetails` 重新分组为 `groupedSelections`：
 * 选课组为数组，每组内为 (campaign, course) 列表。
 *
 * 即使活动在该组内没有可选课程（`courses` 为空或缺失），
 * 仍把活动作为一行加入 `items`（`course` 为 null），
 * 这样活动名称、状态、时间窗口等信息仍可见，
 * 只是行内不展示课程详情和选课按钮。
 */
const groupedSelections = computed<GroupedSelection[]>(() => {
  const map = new Map<number, GroupedSelection>()
  for (const detail of campaignDetails.value) {
    for (const group of detail.groups) {
      if (!map.has(group.groupId)) {
        map.set(group.groupId, {
          groupId: group.groupId,
          groupName: group.groupName,
          groupMax: group.groupMax,
          items: [],
        })
      }
      const courses = group.courses ?? []
      if (courses.length === 0) {
        map.get(group.groupId)!.items.push({
          campaign: detail.campaign,
          course: null,
        })
      } else {
        for (const course of courses) {
          map.get(group.groupId)!.items.push({
            campaign: detail.campaign,
            course,
          })
        }
      }
    }
  }
  return Array.from(map.values())
})

async function loadAll() {
  loading.value = true
  try {
    const campaignRes = await fetchStudentCampaigns()
    const campaigns = campaignRes.data
    if (campaigns.length === 0) {
      campaignDetails.value = []
      records.value = []
      return
    }
    const [groupResults, recordResults] = await Promise.all([
      Promise.all(campaigns.map((c) => fetchStudentCourseGroups(c.id).catch(() => null))),
      Promise.all(campaigns.map((c) => fetchMyRecords(c.id).catch(() => null))),
    ])
    campaignDetails.value = campaigns.map((c, idx) => ({
      campaign: c,
      groups: groupResults[idx]?.data ?? [],
    }))
    records.value = recordResults
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .flatMap((r) => r.data)
  } catch (e) {
    message.error((e as Error).message || t('selection.loadFail'))
  } finally {
    loading.value = false
  }
}

async function handleSelect(item: SelectionItem) {
  try {
    await selectCourse({
      campaignId: item.campaign.id,
      selectionCourseId: item.course?.id ?? item.campaign.id,
    })
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

const recordColumns = computed<DataTableColumns<SelectionRecord>>(() => [
  {
    title: t('selection.name'),
    key: 'campaignName',
    width: 160,
    ellipsis: { tooltip: true },
    render: (row) => campaignNameOf(row.campaignId),
  },
  { title: t('selection.courseName'), key: 'courseName', width: 180, ellipsis: { tooltip: true } },
  { title: t('selection.courseCode'), key: 'courseCode', width: 120 },
  { title: t('selection.credit'), key: 'credit', width: 70, align: 'center' },
  { title: t('selection.courseType'), key: 'courseType', width: 90 },
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
      const detail = campaignDetails.value.find((d) => d.campaign.id === row.campaignId)
      const inWindow = detail ? campaignWindowStatus(detail.campaign) === 'in' : false
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
            <template #header-extra>
              <NTag
                :type="selectedInGroupCross(group.groupId) >= group.groupMax ? 'warning' : 'info'"
                size="small"
                :bordered="false"
              >
                {{
                  t('selection.groupProgress', {
                    selected: selectedInGroupCross(group.groupId),
                    max: group.groupMax,
                  })
                }}
              </NTag>
            </template>

            <NEmpty
              v-if="group.items.length === 0"
              size="small"
              :description="$t('selection.groupCoursesEmpty')"
            />
            <div v-else class="campaign-list">
              <div
                v-for="item in group.items"
                :key="`${item.campaign.id}-${item.course?.id ?? 'none'}`"
                class="campaign-row"
              >
                <div class="campaign-row-main">
                  <div class="campaign-row-header">
                    <span class="campaign-row-name">{{ item.campaign.name }}</span>
                    <NTag
                      :type="windowStatusTagType[campaignWindowStatus(item.campaign)]"
                      size="small"
                      :bordered="false"
                    >
                      {{ windowStatusLabel(campaignWindowStatus(item.campaign)) }}
                    </NTag>
                    <span
                      class="countdown-text"
                      :title="`raw=${item.campaign.endTime} | parsed=${parseDateTime(item.campaign.endTime)} | now=${now}`"
                    >
                      {{ campaignCountdown(item.campaign) || '（倒计时不可用）' }}
                    </span>
                  </div>
                  <div class="campaign-row-meta">
                    <span>{{ $t('selection.semester') }}: {{ item.campaign.semesterName }}</span>
                    <span>
                      {{ $t('selection.startTime') }}: {{ formatDateTime(item.campaign.startTime) }}
                    </span>
                    <span>
                      {{ $t('selection.endTime') }}: {{ formatDateTime(item.campaign.endTime) }}
                    </span>
                    <span>
                      {{ $t('selection.weekRangeValue', { start: item.campaign.startWeek, end: item.campaign.endWeek }) }}
                    </span>
                    <span v-if="item.course" :class="{ 'capacity-full': item.course.remaining <= 0 }">
                      {{ $t('selection.remainingSlots', { n: item.course.remaining }) }}
                    </span>
                  </div>
                </div>
                <div class="campaign-row-actions">
                  <div v-if="findActiveRecord(item.campaign.id)" class="selected-actions">
                    <NTag type="success" size="small" :bordered="false">
                      {{ $t('selection.SELECTED') }}
                    </NTag>
                    <NPopconfirm
                      :on-positive-click="() => {
                        const rec = findActiveRecord(item.campaign.id)
                        if (rec) handleDrop(rec.id)
                      }"
                    >
                      <template #trigger>
                        <NButton
                          size="small"
                          type="error"
                          :disabled="campaignWindowStatus(item.campaign) !== 'in'"
                        >
                          {{ $t('selection.dropCourse') }}
                        </NButton>
                      </template>
                      {{ $t('selection.dropConfirm') }}
                    </NPopconfirm>
                  </div>
                  <NTooltip v-else-if="campaignWindowStatus(item.campaign) !== 'in'">
                    <template #trigger>
                      <NButton size="small" type="primary" disabled>
                        {{ $t('selection.selectCourse') }}
                      </NButton>
                    </template>
                    {{ $t('selection.notInWindowHint') }}
                  </NTooltip>
                  <NTooltip v-else-if="item.course && item.course.remaining <= 0">
                    <template #trigger>
                      <NButton size="small" type="primary" disabled>
                        {{ $t('selection.selectCourse') }}
                      </NButton>
                    </template>
                    {{ $t('selection.full') }}
                  </NTooltip>
                  <NTooltip
                    v-else-if="selectedInGroupCross(group.groupId) >= group.groupMax"
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
                    @click="handleSelect(item)"
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
            :row-key="(r: SelectionRecord) => r.id"
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
