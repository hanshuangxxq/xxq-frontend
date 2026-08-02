<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCard, NDataTable, NTag, NSpin, NEmpty, useMessage, type DataTableColumns } from 'naive-ui'
import { fetchMyExams } from '../api'
import type { ExamView } from '../types'
import { calcDurationMinutes } from '../utils'

const { t } = useI18n()
const message = useMessage()

const loading = ref(false)
const data = ref<ExamView[]>([])

function statusTagType(status: string): 'success' | 'info' | 'warning' | 'error' | 'default' {
  switch (status) {
    case '已安排':
      return 'info'
    case '已完成':
      return 'success'
    case '已取消':
      return 'error'
    default:
      return 'default'
  }
}

async function loadData() {
  loading.value = true
  try {
    const res = await fetchMyExams()
    data.value = res.data.sort((a, b) => a.examDate.localeCompare(b.examDate))
  } catch (e) {
    message.error((e as Error).message || t('exam.myLoadFail'))
    data.value = []
  } finally {
    loading.value = false
  }
}

const columns = computed<DataTableColumns<ExamView>>(() => [
  { title: t('exam.myExamName'), key: 'examName', minWidth: 220, ellipsis: { tooltip: true } },
  { title: t('exam.myCourse'), key: 'courseName', width: 150, ellipsis: { tooltip: true } },
  { title: t('exam.myExamType'), key: 'examType', width: 100 },
  { title: t('exam.myExamDate'), key: 'examDate', width: 120 },
  {
    title: t('exam.myTime'),
    key: 'time',
    width: 150,
    render: (r) => `${r.startTime?.slice(0, 5) ?? ''} - ${r.endTime?.slice(0, 5) ?? ''}`,
  },
  {
    title: t('exam.myDuration'),
    key: 'duration',
    width: 130,
    align: 'center',
    render: (r) => {
      const m = calcDurationMinutes(r.startTime, r.endTime)
      return m == null ? '-' : String(m)
    },
  },
  { title: t('exam.myLocation'), key: 'localName', width: 130, render: (r) => r.localName || '-' },
  {
    title: t('exam.myNotes'),
    key: 'notes',
    width: 160,
    ellipsis: { tooltip: true },
    render: (r) => r.notes || '-',
  },
  {
    title: t('exam.myStatus'),
    key: 'status',
    width: 90,
    align: 'center',
    render: (r) =>
      h(NTag, { type: statusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  },
])

onMounted(loadData)
</script>

<template>
  <div class="my-exams-page">
    <NCard :title="$t('exam.myTitle')">
      <NSpin :show="loading">
        <NEmpty v-if="!loading && data.length === 0" :description="$t('exam.myEmpty')" />
        <NDataTable
          v-else
          :columns="columns"
          :data="data"
          :row-key="(r: ExamView) => r.id"
          :single-line="false"
          :bordered="false"
          :scroll-x="1230"
        />
      </NSpin>
    </NCard>
  </div>
</template>

<style scoped src="./MyExamsPage.css"></style>
