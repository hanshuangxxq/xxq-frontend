<script setup lang="ts">
import { ref, computed, h, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NSelect,
  NDataTable,
  NSpin,
  NEmpty,
  NTag,
  NTabs,
  NTabPane,
  NButton,
  NInputNumber,
  NSwitch,
  NAlert,
  NDescriptions,
  NDescriptionsItem,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import {
  fetchMyWarnings,
  fetchWarnings,
  getWarningConfig,
  updateWarningConfig,
  scanWarnings,
} from '../api'
import { fetchAllSemesters } from '@/modules/curriculum/api'
import { fetchAllPages } from '@/shared/pagination'
import type { Semester } from '@/modules/curriculum/types'
import type { WarningItemDto, WarningConfigDto, WarningLevelCode } from '../types'
import {
  warningLevelColor,
  warningLevelTagType,
  warningStatusTagType,
  formatDateTime,
} from '../utils'

const { t } = useI18n()
const message = useMessage()
const { isStudent, isAcademicAdmin } = useRoleCheck()

// ---- 学生自查 ----
const myLoading = ref(false)
const myWarnings = ref<WarningItemDto[]>([])

async function loadMyWarnings() {
  myLoading.value = true
  try {
    const res = await fetchMyWarnings()
    myWarnings.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('analysis.wrnLoadFail'))
    myWarnings.value = []
  } finally {
    myLoading.value = false
  }
}

// ---- 看板 ----
const dashLoading = ref(false)
const dashWarnings = ref<WarningItemDto[]>([])
const semesterOptions = ref<Array<{ label: string; value: number }>>([])
const filterSemesterId = ref<number | null>(null)
const filterLevel = ref<WarningLevelCode | null>(null)
/** 看板表格本地分页（数据需全集以汇总各级别数量，故全量拉取后客户端分页） */
const dashPagination = reactive({
  pageSize: 20,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
})

const levelOptions = computed(() => [
  { label: t('analysis.wrnYellow'), value: 'YELLOW' as WarningLevelCode },
  { label: t('analysis.wrnOrange'), value: 'ORANGE' as WarningLevelCode },
  { label: t('analysis.wrnRed'), value: 'RED' as WarningLevelCode },
])

async function loadSemesters() {
  try {
    const res = await fetchAllSemesters()
    semesterOptions.value = res.data.map((s: Semester) => ({ label: s.name, value: s.id }))
  } catch {
    // 非阻塞
  }
}

async function loadDashboard() {
  dashLoading.value = true
  try {
    // 看板顶部「按级别汇总」依赖全集，故分块拉全量后客户端分页
    const all = await fetchAllPages((page, pageSize) =>
      fetchWarnings({
        semesterId: filterSemesterId.value ?? undefined,
        level: filterLevel.value ?? undefined,
        page,
        pageSize,
      }),
    )
    dashWarnings.value = all
  } catch (e) {
    message.error((e as Error).message || t('analysis.wrnLoadFail'))
    dashWarnings.value = []
  } finally {
    dashLoading.value = false
  }
}

const warningRowKey = (row: WarningItemDto) => row.id

const dashColumns = computed<DataTableColumns<WarningItemDto>>(() => [
  {
    title: t('analysis.wrnLevel'),
    key: 'level',
    width: 90,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: warningLevelTagType(r.level), size: 'small', bordered: false },
        () => r.level,
      ),
  },
  { title: t('analysis.wrnStudentName'), key: 'studentName', width: 90 },
  { title: t('analysis.wrnStudentNo'), key: 'studentNo', width: 110 },
  { title: t('analysis.wrnClassName'), key: 'className', width: 120, ellipsis: { tooltip: true } },
  { title: t('analysis.wrnReason'), key: 'reason', minWidth: 180, ellipsis: { tooltip: true } },
  { title: t('analysis.wrnGpa'), key: 'gpa', width: 80, align: 'center' },
  { title: t('analysis.wrnFailCount'), key: 'failCount', width: 90, align: 'center' },
  {
    title: t('analysis.wrnSemesterFailCount'),
    key: 'semesterFailCount',
    width: 100,
    align: 'center',
  },
  {
    title: t('analysis.wrnSemester'),
    key: 'semesterName',
    width: 140,
    ellipsis: { tooltip: true },
  },
  {
    title: t('analysis.wrnStatus'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: warningStatusTagType(r.status), size: 'small', bordered: false },
        () => r.status,
      ),
  },
  {
    title: t('analysis.wrnCreateTime'),
    key: 'createTime',
    width: 150,
    align: 'center',
    render: (r) => formatDateTime(r.createTime),
  },
])

// 按级别汇总（看板顶部）
const levelSummary = computed(() => {
  const counts: Record<string, number> = { 黄色预警: 0, 橙色预警: 0, 红色预警: 0 }
  for (const w of dashWarnings.value) counts[w.level] = (counts[w.level] ?? 0) + 1
  return (['黄色预警', '橙色预警', '红色预警'] as const).map((lv) => ({
    label: lv,
    value: counts[lv] ?? 0,
    color: warningLevelColor(lv),
  }))
})

// ---- 阈值配置 ----
interface ConfigRow {
  code: WarningLevelCode
  label: string
  gpaThreshold: number
  failCountThreshold: number
  semesterFailThreshold: number
  enabled: boolean
}

const configRows = ref<ConfigRow[]>([])
const configLoading = ref(false)
const configSaving = ref(false)

// 中文描述 -> code
const descToCode: Record<string, WarningLevelCode> = {
  黄色预警: 'YELLOW',
  橙色预警: 'ORANGE',
  红色预警: 'RED',
}

function defaultConfigRows(): ConfigRow[] {
  return [
    {
      code: 'YELLOW',
      label: t('analysis.wrnYellow'),
      gpaThreshold: 2.0,
      failCountThreshold: 2,
      semesterFailThreshold: 2,
      enabled: true,
    },
    {
      code: 'ORANGE',
      label: t('analysis.wrnOrange'),
      gpaThreshold: 1.5,
      failCountThreshold: 4,
      semesterFailThreshold: 3,
      enabled: true,
    },
    {
      code: 'RED',
      label: t('analysis.wrnRed'),
      gpaThreshold: 1.0,
      failCountThreshold: 6,
      semesterFailThreshold: 4,
      enabled: true,
    },
  ]
}

async function loadConfig() {
  configLoading.value = true
  try {
    const res = await getWarningConfig()
    const byCode = new Map<WarningLevelCode, WarningConfigDto>()
    for (const c of res.data) {
      const code = descToCode[c.level] ?? (c.level as WarningLevelCode)
      byCode.set(code, c)
    }
    configRows.value = defaultConfigRows().map((row) => {
      const dto = byCode.get(row.code)
      return dto
        ? {
            ...row,
            gpaThreshold: dto.gpaThreshold,
            failCountThreshold: dto.failCountThreshold,
            semesterFailThreshold: dto.semesterFailThreshold,
            enabled: dto.enabled === 1,
          }
        : row
    })
  } catch (e) {
    message.error((e as Error).message || t('analysis.wrnLoadFail'))
    configRows.value = defaultConfigRows()
  } finally {
    configLoading.value = false
  }
}

async function saveConfig() {
  configSaving.value = true
  try {
    await updateWarningConfig({
      configs: configRows.value.map((r) => ({
        level: r.code,
        gpaThreshold: r.gpaThreshold,
        failCountThreshold: r.failCountThreshold,
        semesterFailThreshold: r.semesterFailThreshold,
        enabled: r.enabled ? 1 : 0,
      })),
    })
    message.success(t('analysis.wrnSaveSuccess'))
  } catch (e) {
    message.error((e as Error).message || t('analysis.wrnSaveFail'))
  } finally {
    configSaving.value = false
  }
}

// ---- 扫描 ----
const scanning = ref(false)
interface ScanResult {
  scannedCount: number
  warnedCount: number
  resolvedCount: number
  byLevel: Record<string, number>
}
const scanResult = ref<ScanResult | null>(null)

async function handleScan() {
  if (!confirm(t('analysis.wrnScanConfirm'))) return
  scanning.value = true
  scanResult.value = null
  try {
    const res = await scanWarnings()
    scanResult.value = res.data
    message.success(t('analysis.wrnScanSuccess'))
    // 扫描后刷新看板
    await loadDashboard()
  } catch (e) {
    message.error((e as Error).message || t('analysis.wrnScanFail'))
  } finally {
    scanning.value = false
  }
}

const scanByLevel = computed(() =>
  (['黄色预警', '橙色预警', '红色预警'] as const).map((lv) => ({
    label: lv,
    value: scanResult.value?.byLevel?.[lv] ?? 0,
    color: warningLevelColor(lv),
  })),
)

const activeTab = ref<'dashboard' | 'config' | 'scan'>('dashboard')

onMounted(() => {
  if (isStudent.value) {
    loadMyWarnings()
  } else {
    loadSemesters()
    loadDashboard()
    if (isAcademicAdmin.value) loadConfig()
  }
})
</script>

<template>
  <div class="analysis-warning-page">
    <!-- 学生自查 -->
    <template v-if="isStudent">
      <NCard :title="$t('analysis.wrnMyWarnings')">
        <NSpin :show="myLoading">
          <NEmpty
            v-if="!myLoading && myWarnings.length === 0"
            :description="$t('analysis.wrnEmpty')"
          />
          <div v-else class="warning-card-list">
            <div
              v-for="w in myWarnings"
              :key="w.id"
              class="warning-card"
              :style="{ borderLeftColor: warningLevelColor(w.level) }"
            >
              <div class="warning-card-head">
                <NTag :type="warningLevelTagType(w.level)" size="small" :bordered="false">
                  {{ w.level }}
                </NTag>
                <NTag :type="warningStatusTagType(w.status)" size="small" :bordered="false">
                  {{ w.status }}
                </NTag>
                <span class="warning-card-time">{{ formatDateTime(w.createTime) }}</span>
              </div>
              <div class="warning-card-reason">{{ w.reason }}</div>
              <div class="warning-card-meta">
                <span>{{ $t('analysis.wrnGpa') }}：{{ w.gpa }}</span>
                <span>{{ $t('analysis.wrnFailCount') }}：{{ w.failCount }}</span>
                <span>{{ $t('analysis.wrnSemesterFailCount') }}：{{ w.semesterFailCount }}</span>
                <span>{{ $t('analysis.wrnSemester') }}：{{ w.semesterName }}</span>
              </div>
            </div>
          </div>
        </NSpin>
      </NCard>
    </template>

    <!-- 管理员/院系 -->
    <template v-else>
      <NTabs v-model:value="activeTab" type="line" animated>
        <!-- 看板 -->
        <NTabPane name="dashboard" :tab="$t('analysis.wrnDashboard')">
          <NSpace vertical :size="16">
            <NCard>
              <NSpace align="center" :size="12" wrap>
                <NSelect
                  v-model:value="filterSemesterId"
                  :options="semesterOptions"
                  :placeholder="$t('analysis.wrnSemester')"
                  clearable
                  style="width: 200px"
                />
                <NSelect
                  v-model:value="filterLevel"
                  :options="levelOptions"
                  :placeholder="$t('analysis.wrnLevelAll')"
                  clearable
                  style="width: 160px"
                />
                <NButton type="primary" @click="loadDashboard">{{ $t('score.statQuery') }}</NButton>
              </NSpace>
            </NCard>

            <div class="level-summary">
              <div
                v-for="s in levelSummary"
                :key="s.label"
                class="level-summary-card"
                :style="{ borderTopColor: s.color }"
              >
                <div class="level-summary-label" :style="{ color: s.color }">{{ s.label }}</div>
                <div class="level-summary-value">{{ s.value }}</div>
              </div>
            </div>

            <NCard>
              <NSpin :show="dashLoading">
                <NEmpty
                  v-if="!dashLoading && dashWarnings.length === 0"
                  :description="$t('analysis.wrnEmpty')"
                />
                <NDataTable
                  v-else
                  :columns="dashColumns"
                  :data="dashWarnings"
                  :row-key="warningRowKey"
                  :single-line="false"
                  :bordered="false"
                  :scroll-x="1400"
                  :pagination="dashPagination"
                />
              </NSpin>
            </NCard>
          </NSpace>
        </NTabPane>

        <!-- 阈值配置（仅教务） -->
        <NTabPane v-if="isAcademicAdmin" name="config" :tab="$t('analysis.wrnConfig')">
          <NCard>
            <NAlert type="info" :show-icon="true" class="config-hint">
              {{ $t('analysis.wrnConfigHint') }}
            </NAlert>
            <NSpin :show="configLoading">
              <div class="config-table">
                <div class="config-row config-head">
                  <div>{{ $t('analysis.wrnLevel') }}</div>
                  <div>{{ $t('analysis.wrnGpaThreshold') }}</div>
                  <div>{{ $t('analysis.wrnFailCountThreshold') }}</div>
                  <div>{{ $t('analysis.wrnSemesterFailThreshold') }}</div>
                  <div>{{ $t('analysis.wrnEnabled') }}</div>
                </div>
                <div
                  v-for="row in configRows"
                  :key="row.code"
                  class="config-row"
                  :style="{ borderLeftColor: warningLevelColor(row.label) }"
                >
                  <div class="config-level">
                    <span
                      class="config-level-dot"
                      :style="{ background: warningLevelColor(row.label) }"
                    ></span>
                    {{ row.label }}
                  </div>
                  <div>
                    <NInputNumber
                      v-model:value="row.gpaThreshold"
                      :min="0"
                      :max="5"
                      :step="0.1"
                      size="small"
                      style="width: 110px"
                    />
                  </div>
                  <div>
                    <NInputNumber
                      v-model:value="row.failCountThreshold"
                      :min="0"
                      :step="1"
                      size="small"
                      style="width: 110px"
                    />
                  </div>
                  <div>
                    <NInputNumber
                      v-model:value="row.semesterFailThreshold"
                      :min="0"
                      :step="1"
                      size="small"
                      style="width: 110px"
                    />
                  </div>
                  <div>
                    <NSwitch v-model:value="row.enabled" size="small" />
                  </div>
                </div>
              </div>
              <div class="config-actions">
                <NButton type="primary" :loading="configSaving" @click="saveConfig">
                  {{ $t('analysis.wrnSaveConfig') }}
                </NButton>
              </div>
            </NSpin>
          </NCard>
        </NTabPane>

        <!-- 扫描（仅教务） -->
        <NTabPane v-if="isAcademicAdmin" name="scan" :tab="$t('analysis.wrnScan')">
          <NCard>
            <div class="scan-actions">
              <NButton type="error" :loading="scanning" @click="handleScan">
                {{ $t('analysis.wrnScanBtn') }}
              </NButton>
            </div>
            <template v-if="scanResult">
              <div class="scan-title">{{ $t('analysis.wrnScanResult') }}</div>
              <NDescriptions :column="3" label-placement="left" bordered>
                <NDescriptionsItem :label="$t('analysis.wrnScannedCount')">
                  {{ scanResult.scannedCount }}
                </NDescriptionsItem>
                <NDescriptionsItem :label="$t('analysis.wrnWarnedCount')">
                  {{ scanResult.warnedCount }}
                </NDescriptionsItem>
                <NDescriptionsItem :label="$t('analysis.wrnResolvedCount')">
                  {{ scanResult.resolvedCount }}
                </NDescriptionsItem>
              </NDescriptions>
              <div class="scan-title">{{ $t('analysis.wrnByLevel') }}</div>
              <div class="level-summary">
                <div
                  v-for="s in scanByLevel"
                  :key="s.label"
                  class="level-summary-card"
                  :style="{ borderTopColor: s.color }"
                >
                  <div class="level-summary-label" :style="{ color: s.color }">{{ s.label }}</div>
                  <div class="level-summary-value">{{ s.value }}</div>
                </div>
              </div>
            </template>
            <NEmpty v-else-if="!scanning" :description="$t('analysis.wrnEmpty')" />
          </NCard>
        </NTabPane>
      </NTabs>
    </template>
  </div>
</template>

<style scoped src="./WarningPage.css"></style>
