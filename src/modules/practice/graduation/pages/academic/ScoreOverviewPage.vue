<script setup lang="ts">
/** 教务-成绩总览:活动内全部学生的分项/总评成绩一览,学号与院系从看板行合并补充,支持按院系过滤与成绩表导出 */
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NEmpty,
  NButton,
  NDataTable,
  NSelect,
  NTag,
  NSpace,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import ForbiddenState from '@/shared/components/ForbiddenState.vue'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import { fetchScores, exportScores, fetchDashboard } from '../../api'
import { fetchColleges } from '@/modules/college/api'
import { fetchAllPages } from '@/shared/pagination'
import { scoreStatusTagType, formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import { useLoading } from '@/shared/composables/useLoading'
import { isReportedError } from '@/shared/api'
import type { ScoreResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const campaignId = ref<number | null>(null)
const list = ref<ScoreResponse[]>([])
const { loading, withLoading } = useLoading()
const { loading: exporting, withLoading: withExporting } = useLoading()
/** 院系筛选按 collegeId 过滤（院系名可能重名，且院系字典是权威来源） */
const collegeFilter = ref<number | null>(null)
const colleges = ref<{ id: number; name: string }[]>([])

/** 学号/院系来自看板行合并（ScoreResponse 不含学号/院系） */
const studentMeta = ref(
  new Map<number, { studentNo: string; collegeId: number; collegeName: string }>(),
)

// 院系下拉取院系字典本身，不从看板行里 Set 出来——
// 后者只能覆盖看板返回的那些学生，选项会随数据残缺而缺项、随数据变化而漂移
const collegeOptions = computed(() => colleges.value.map((c) => ({ label: c.name, value: c.id })))

const filteredRows = computed(() => {
  if (collegeFilter.value == null) return list.value
  return list.value.filter(
    (s) => studentMeta.value.get(s.studentId)?.collegeId === collegeFilter.value,
  )
})

function loadData(): Promise<void> {
  return withLoading(async () => {
    const id = campaignId.value
    if (id == null) return
    try {
      // 看板必须拉全量:只取前 100 行会让后段学生的学号/院系显示成「-」
      const [sRes, allRows] = await Promise.all([
        fetchScores(id),
        fetchAllPages((page, pageSize) => fetchDashboard(id, { page, pageSize })),
      ])
      list.value = sRes.data ?? []
      const meta = new Map<number, { studentNo: string; collegeId: number; collegeName: string }>()
      for (const r of allRows) {
        meta.set(r.studentId, {
          studentNo: r.studentNo,
          collegeId: r.collegeId,
          collegeName: r.collegeName,
        })
      }
      studentMeta.value = meta
    } catch (e) {
      if (!isReportedError(e))
        message.error((e as Error).message || t('graduation.common.loadFail'))
    }
  })
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  list.value = []
  studentMeta.value = new Map()
  collegeFilter.value = null
  if (id != null) {
    void loadData()
    if (!colleges.value.length) {
      void fetchColleges().then((res) => {
        colleges.value = (res.data ?? []).map((c) => ({ id: c.id, name: c.collegeName }))
      })
    }
  }
}

function handleExport(): Promise<void> {
  return withExporting(async () => {
    if (campaignId.value == null) return
    try {
      await exportScores(campaignId.value)
    } catch (e) {
      if (!isReportedError(e))
        message.error((e as Error).message || t('graduation.common.operationFail'))
    }
  })
}

const scoreRowKey = (row: ScoreResponse) => row.id

const columns = computed<DataTableColumns<ScoreResponse>>(() => [
  {
    title: t('graduation.common.studentNo'),
    key: 'studentNo',
    width: 110,
    render: (r) => studentMeta.value.get(r.studentId)?.studentNo ?? '-',
  },
  { title: t('graduation.common.student'), key: 'studentName', width: 100 },
  {
    title: t('graduation.academic.colName'),
    key: 'collegeName',
    width: 120,
    render: (r) => studentMeta.value.get(r.studentId)?.collegeName ?? '-',
  },
  {
    title: t('graduation.student.advisorScore'),
    key: 'advisorScore',
    width: 80,
    align: 'center',
    render: (r) => r.advisorScore ?? '-',
  },
  {
    title: t('graduation.student.reviewerScore'),
    key: 'reviewerScore',
    width: 80,
    align: 'center',
    render: (r) => r.reviewerScore ?? '-',
  },
  {
    title: t('graduation.student.defenseScore'),
    key: 'defenseScore',
    width: 80,
    align: 'center',
    render: (r) => r.defenseScore ?? '-',
  },
  {
    title: t('graduation.student.totalScore'),
    key: 'totalScore',
    width: 80,
    align: 'center',
    render: (r) => r.totalScore ?? '-',
  },
  {
    title: t('graduation.common.status'),
    key: 'status',
    width: 110,
    align: 'center',
    render: (r) =>
      h(
        NTag,
        { type: scoreStatusTagType(r.status), size: 'small', bordered: false },
        () => r.status,
      ),
  },
  {
    title: t('graduation.common.publishTime'),
    key: 'publishTime',
    width: 150,
    render: (r) => formatDateTime(r.publishTime),
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

      <NCard :title="$t('graduation.academic.scoreTableTitle')" class="content-card">
        <template #header-extra>
          <NSpace align="center" :size="12">
            <NSelect
              v-model:value="collegeFilter"
              :options="collegeOptions"
              :placeholder="$t('graduation.academic.filterCollege')"
              clearable
              style="width: 160px"
            />
            <NButton type="primary" :loading="exporting" @click="handleExport">
              {{ $t('graduation.academic.exportScoreTable') }}
            </NButton>
          </NSpace>
        </template>
        <NEmpty
          v-if="campaignId != null && !loading && !list.length"
          :description="$t('graduation.academic.scoresEmpty')"
        />
        <NDataTable
          v-else-if="list.length > 0"
          :columns="columns"
          :data="filteredRows"
          :row-key="scoreRowKey"
          :single-line="false"
          :bordered="false"
          :scroll-x="980"
        >
          <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
        </NDataTable>
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./ScoreOverviewPage.css"></style>
