<script setup lang="ts">
import { ref, computed, h, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NDataTable,
  NButton,
  NInputNumber,
  NSelect,
  NTag,
  NSpin,
  NEmpty,
  NAlert,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import StatCard from '@/shared/components/StatCard.vue'
import {
  getScoreConfig,
  setScoreConfig,
  fetchRoster,
  batchCreateScores,
  fetchScoresByTeachInfo,
  exportScores,
} from '../api'
import { fetchTeacherExams } from '@/modules/exam/api'
import type { ExamView } from '@/modules/exam/types'
import type { ScoreView, ScoreConfig, ScoreRosterDto, ScoreEntryRequest } from '../types'
import { computeTotal, levelOf, levelTagType } from '../utils'

const { t } = useI18n()
const message = useMessage()

interface RosterRow extends ScoreRosterDto {
  regular: number | null
  final: number | null
  locked: number
  scoreId: number | null
}

/** 考试选项（仅期末/期中且有授课安排） */
interface ExamOption {
  label: string
  value: number
  teachInfoId: number
}

const examOptions = ref<ExamOption[]>([])
const selectedExamId = ref<number | null>(null)
const selectedTeachInfoId = computed(() => {
  const opt = examOptions.value.find((o) => o.value === selectedExamId.value)
  return opt?.teachInfoId ?? null
})
const config = ref<ScoreConfig | null>(null)
const ratioInput = ref<number | null>(null)
const ratioSaving = ref(false)

const rosterRows = ref<RosterRow[]>([])
const loadingRoster = ref(false)
const saving = ref(false)
const exporting = ref(false)
const exportFormat = ref<'excel' | 'pdf'>('excel')

const hasConfig = computed(() => config.value !== null)
const activeRatio = computed(() => config.value?.regularRatio ?? 0)
const restRatio = computed(() => 100 - (ratioInput.value ?? 0))

async function loadExamOptions() {
  try {
    const res = await fetchTeacherExams()
    // 仅期末/期中考试且绑定了授课安排的才可录入成绩
    examOptions.value = res.data
      .filter(
        (e: ExamView) =>
          e.teachInfoId != null &&
          (e.examType === '期末考试' || e.examType === '期中考试'),
      )
      .map((e: ExamView) => ({
        label: `${e.examName} - ${e.courseName}（${e.examType}）`,
        value: e.id,
        teachInfoId: e.teachInfoId as number,
      }))
  } catch (e) {
    message.error((e as Error).message || t('score.mgLoadFail'))
  }
}

async function loadConfigAndRoster() {
  const teachId = selectedTeachInfoId.value
  const examId = selectedExamId.value
  if (teachId == null || examId == null) return
  // 占比配置
  try {
    const cfgRes = await getScoreConfig(teachId)
    config.value = cfgRes.data
    ratioInput.value = cfgRes.data?.regularRatio ?? 30
  } catch (e) {
    message.error((e as Error).message || t('score.mgLoadFail'))
    config.value = null
    ratioInput.value = 30
  }
  // 已录成绩 + 名单（按考试过滤，仅返回参加该考试的学生）
  loadingRoster.value = true
  try {
    const [sRes, rRes] = await Promise.all([
      fetchScoresByTeachInfo(teachId),
      fetchRoster(teachId, examId),
    ])
    // 仅取「正常」成绩用于录入预填（补考/重修在考试模块录入）
    const regularMap = new Map<number, ScoreView>()
    for (const s of sRes.data) {
      if (s.scoreType === '正常') regularMap.set(s.studentUserId, s)
    }
    rosterRows.value = rRes.data.map((r) => {
      const exist = regularMap.get(r.studentUserId)
      return {
        ...r,
        regular: exist ? exist.regularScore : null,
        final: exist ? exist.finalScore : null,
        locked: exist ? exist.locked : 0,
        scoreId: exist ? exist.id : null,
      }
    })
  } catch (e) {
    message.error((e as Error).message || t('score.mgLoadFail'))
    rosterRows.value = []
  } finally {
    loadingRoster.value = false
  }
}

async function handleSetRatio() {
  const teachId = selectedTeachInfoId.value
  if (teachId == null) return
  if (ratioInput.value == null || ratioInput.value < 0 || ratioInput.value > 100) {
    message.warning(t('score.mgRatioRequired'))
    return
  }
  ratioSaving.value = true
  try {
    const res = await setScoreConfig(teachId, ratioInput.value)
    config.value = res.data
    message.success(t('score.mgRatioSaved'))
  } catch (e) {
    message.error((e as Error).message || t('score.mgSaveFail'))
  } finally {
    ratioSaving.value = false
  }
}

function inRange(v: number | null): v is number {
  return v != null && v >= 0 && v <= 100
}

/** 实时预览总评（按已保存占比；与 POST 批量录入时服务端计算一致） */
function previewTotal(row: RosterRow): number | null {
  if (!hasConfig.value) return null
  return computeTotal(row.regular, row.final, activeRatio.value)
}

function previewLevel(row: RosterRow): string | null {
  const total = previewTotal(row)
  return total == null ? null : levelOf(total)
}

// ---- 概要统计 ----
const stats = computed(() => {
  let entered = 0
  let fail = 0
  for (const row of rosterRows.value) {
    if (row.regular != null && row.final != null) entered++
    const total = previewTotal(row)
    if (total != null && total < 60) fail++
  }
  return {
    total: rosterRows.value.length,
    entered,
    fail,
  }
})

async function handleBatchSave() {
  const teachId = selectedTeachInfoId.value
  const examId = selectedExamId.value
  if (teachId == null || examId == null) return
  const entries: ScoreEntryRequest[] = []
  for (const row of rosterRows.value) {
    if (row.locked === 1) continue // 锁定行不可改
    if (row.regular == null && row.final == null) continue
    if (!inRange(row.regular) || !inRange(row.final)) {
      message.warning(t('score.mgScoreRange'))
      return
    }
    entries.push({
      studentUserId: row.studentUserId,
      regularScore: row.regular,
      finalScore: row.final,
    })
  }
  if (entries.length === 0) {
    message.warning(t('score.mgScoreRange'))
    return
  }
  saving.value = true
  try {
    await batchCreateScores({ teachInfoId: teachId, examId, entries })
    message.success(t('score.mgBatchSuccess'))
    await loadConfigAndRoster()
  } catch (e) {
    message.error((e as Error).message || t('score.mgSaveFail'))
  } finally {
    saving.value = false
  }
}

async function handleExport() {
  const teachId = selectedTeachInfoId.value
  if (teachId == null) return
  exporting.value = true
  try {
    await exportScores(teachId, exportFormat.value)
    message.success(t('score.mgExportSuccess'))
  } catch (e) {
    message.error((e as Error).message || t('score.mgExportFail'))
  } finally {
    exporting.value = false
  }
}

const rosterRowKey = (row: RosterRow) => row.studentUserId

const rosterColumns = computed<DataTableColumns<RosterRow>>(() => [
  { title: t('score.mgStudentNo'), key: 'studentNo', width: 130 },
  { title: t('score.mgStudentName'), key: 'studentName', width: 110 },
  {
    title: t('score.mgRegularScore'),
    key: 'regular',
    width: 130,
    align: 'center',
    render: (row) =>
      h(NInputNumber, {
        value: row.regular,
        min: 0,
        max: 100,
        showButton: false,
        placeholder: '0-100',
        disabled: !hasConfig.value || row.locked === 1,
        onUpdateValue: (v: number | null) => {
          row.regular = v
        },
      }),
  },
  {
    title: t('score.mgFinalScore'),
    key: 'final',
    width: 130,
    align: 'center',
    render: (row) =>
      h(NInputNumber, {
        value: row.final,
        min: 0,
        max: 100,
        showButton: false,
        placeholder: '0-100',
        disabled: !hasConfig.value || row.locked === 1,
        onUpdateValue: (v: number | null) => {
          row.final = v
        },
      }),
  },
  {
    title: t('score.mgTotalScore'),
    key: 'total',
    width: 100,
    align: 'center',
    render: (row) => {
      const total = previewTotal(row)
      return total == null ? '-' : total.toFixed(2)
    },
  },
  {
    title: t('score.mgScoreLevel'),
    key: 'level',
    width: 90,
    align: 'center',
    render: (row) => {
      const level = previewLevel(row)
      return level == null
        ? '-'
        : h(NTag, { type: levelTagType(level), size: 'small', bordered: false }, () => level)
    },
  },
  {
    title: t('score.mgLocked'),
    key: 'locked',
    width: 80,
    align: 'center',
    render: (row) =>
      h(
        NTag,
        { size: 'small', bordered: false, type: row.locked === 1 ? 'error' : 'default' },
        () => (row.locked === 1 ? t('score.mgLockedYes') : t('score.mgLockedNo')),
      ),
  },
])

watch(selectedExamId, (v) => {
  if (v != null) loadConfigAndRoster()
})

onMounted(loadExamOptions)
</script>

<template>
  <div class="score-mg-page">
    <NSpace vertical :size="16">
      <!-- 考试安排选择 -->
      <NCard :title="$t('score.mgTitle')">
        <NSpace align="center" :size="12" wrap>
          <NSelect
            v-model:value="selectedExamId"
            :options="examOptions"
            :placeholder="$t('score.mgSelectExamPlaceholder')"
            filterable
            style="width: 400px"
          />
        </NSpace>
        <NAlert v-if="examOptions.length === 0" type="warning" class="mg-alert">
          {{ $t('score.mgNoExam') }}
        </NAlert>
      </NCard>

      <template v-if="selectedExamId != null">
        <!-- 占比配置 -->
        <NCard :title="$t('score.mgConfig')">
          <NSpace align="center" :size="12" wrap>
            <NInputNumber v-model:value="ratioInput" :min="0" :max="100" style="width: 160px" />
            <span class="ratio-hint">
              {{ $t('score.mgRatioHint', { ratio: ratioInput ?? 0, rest: restRatio }) }}
            </span>
            <NButton type="primary" :loading="ratioSaving" @click="handleSetRatio">
              {{ $t('score.mgConfirmRatio') }}
            </NButton>
          </NSpace>
          <NAlert v-if="!hasConfig" type="info" :show-icon="true" class="mg-alert">
            {{ $t('score.mgRatioDefaultHint') }}
          </NAlert>
        </NCard>

        <!-- 概要统计 -->
        <div class="stat-band">
          <StatCard :label="$t('score.mgRoster')" :value="stats.total" tone="primary" />
          <StatCard :label="$t('score.mgStatEntered')" :value="stats.entered" tone="success" />
          <StatCard
            :label="$t('score.mgStatFail')"
            :value="stats.fail"
            :tone="stats.fail > 0 ? 'error' : 'default'"
          />
        </div>

        <!-- 统一可编辑名单表 -->
        <NCard>
          <template #header>
            <span>{{ $t('score.mgRoster') }}</span>
            <span class="preview-hint">{{ $t('score.mgPreviewHint') }}</span>
          </template>
          <template #header-extra>
            <NSpace align="center" :size="12">
              <NSelect
                v-model:value="exportFormat"
                :options="[
                  { label: $t('score.mgExportExcel'), value: 'excel' },
                  { label: $t('score.mgExportPdf'), value: 'pdf' },
                ]"
                style="width: 110px"
              />
              <NButton :loading="exporting" @click="handleExport">
                {{ $t('score.mgExport') }}
              </NButton>
              <NButton type="primary" :loading="saving" :disabled="!hasConfig" @click="handleBatchSave">
                {{ $t('score.mgBatchSave') }}
              </NButton>
            </NSpace>
          </template>
          <NSpin :show="loadingRoster">
            <NEmpty v-if="!loadingRoster && rosterRows.length === 0" :description="$t('score.mgEmpty')" />
            <NDataTable
              v-else
              :columns="rosterColumns"
              :data="rosterRows"
              :row-key="rosterRowKey"
              :single-line="false"
              :bordered="false"
              :max-height="460"
            />
          </NSpin>
        </NCard>
      </template>
      <NCard v-else>
        <NEmpty :description="$t('score.mgSelectExamPlaceholder')" />
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped src="./ScoreManagementPage.css"></style>
