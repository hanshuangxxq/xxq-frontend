<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NDataTable,
  NButton,
  NTag,
  NSpin,
  NEmpty,
  NAlert,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { solve, getSolution, stopSolving } from '../api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { ScheduleSolution, ScheduledLesson } from '../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const status = ref<'NOT_SOLVING' | 'SOLVING' | 'FINISHED'>('NOT_SOLVING')
const score = ref('')
const scheduleId = ref<number | null>(null)
const solving = ref(false)
const lessons = ref<ScheduledLesson[]>([])
let pollTimer: ReturnType<typeof setInterval> | null = null

const DAY_MAP: Record<string, string> = {
  MONDAY: '周一',
  TUESDAY: '周二',
  WEDNESDAY: '周三',
  THURSDAY: '周四',
  FRIDAY: '周五',
  SATURDAY: '周六',
  SUNDAY: '周日',
}

function formatDay(day: string): string {
  return DAY_MAP[day] ?? day
}

function formatTime(time: string): string {
  return time.substring(0, 5)
}

const columns: DataTableColumns<ScheduledLesson> = [
  {
    title: t('scheduling.columnCourseName'),
    key: 'courseName',
    width: 140,
    ellipsis: { tooltip: true },
  },
  {
    title: t('scheduling.columnTeacherName'),
    key: 'teacherName',
    width: 100,
  },
  {
    title: t('scheduling.columnClassName'),
    key: 'className',
    width: 140,
    render(row) {
      return row.studentGroups
        .map((g) => g.name)
        .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
        .join(', ')
    },
  },
  {
    title: t('scheduling.columnDayOfWeek'),
    key: 'day',
    width: 70,
    render(row) {
      return formatDay(row.timeslot.dayOfWeek)
    },
  },
  {
    title: t('scheduling.columnTime'),
    key: 'time',
    width: 110,
    render(row) {
      return `${formatTime(row.timeslot.startTime)}-${formatTime(row.timeslot.endTime)}`
    },
  },
  {
    title: t('scheduling.columnBuilding'),
    key: 'building',
    width: 100,
    render(row) {
      return row.room.building
    },
  },
  {
    title: t('scheduling.columnClassroom'),
    key: 'classroom',
    width: 70,
    render(row) {
      return row.room.roomName
    },
  },
]

function startPolling() {
  if (!scheduleId.value) return
  pollTimer = setInterval(async () => {
    try {
      const res = await getSolution(scheduleId.value!)
      const data = res.data
      status.value = data.solverStatus
      score.value = data.score
      if (data.solverStatus === 'FINISHED') {
        lessons.value = data.lessonList
        stopPolling()
      }
    } catch {
      // polling error, keep trying
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function handleSolve() {
  solving.value = true
  try {
    const res = await solve()
    scheduleId.value = res.data.scheduleId
    status.value = 'SOLVING'
    score.value = ''
    lessons.value = []
    message.success(t('scheduling.solveSuccess'))
    startPolling()
  } catch (e) {
    message.error((e as Error).message || t('scheduling.solveFail'))
  } finally {
    solving.value = false
  }
}

async function handleStop() {
  if (!scheduleId.value) return
  try {
    await stopSolving(scheduleId.value)
    stopPolling()
    status.value = 'NOT_SOLVING'
    message.success(t('scheduling.stopSuccess'))
  } catch (e) {
    message.error((e as Error).message || t('scheduling.stopFail'))
  }
}

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="scheduling-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('scheduling.title')">
        <NSpace align="center">
          <NButton
            v-if="isAcademicAdmin"
            type="primary"
            :loading="solving"
            :disabled="status === 'SOLVING'"
            @click="handleSolve"
          >
            {{ $t('scheduling.startSolve') }}
          </NButton>
          <NButton
            v-if="status === 'SOLVING'"
            type="warning"
            @click="handleStop"
          >
            {{ $t('scheduling.stopSolve') }}
          </NButton>
        </NSpace>
      </NCard>

      <NCard v-if="status !== 'NOT_SOLVING'" :title="$t('scheduling.status')">
        <NSpace vertical :size="12">
          <NSpace align="center">
            <NTag v-if="status === 'SOLVING'" type="info" :bordered="false">
              <template #icon>
                <NSpin :size="14" />
              </template>
              {{ $t('scheduling.statusSolving') }}
            </NTag>
            <NTag v-else-if="status === 'FINISHED'" type="success" :bordered="false">
              {{ $t('scheduling.statusFinished') }}
            </NTag>
            <span v-if="score" class="scheduling-score">
              {{ $t('scheduling.score') }}: {{ score }}
            </span>
          </NSpace>
        </NSpace>
      </NCard>

      <NCard v-if="status === 'FINISHED' && lessons.length > 0">
        <NEmpty
          v-if="lessons.length === 0"
          :description="$t('scheduling.empty')"
        />
        <NDataTable
          v-else
          :columns="columns"
          :data="lessons"
          :row-key="(l: ScheduledLesson) => l.id"
          :single-line="false"
          :bordered="false"
        />
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped src="./SchedulingPage.css"></style>
