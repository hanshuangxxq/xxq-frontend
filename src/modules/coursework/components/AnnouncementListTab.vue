<script setup lang="ts">
/** 学生：课程公告列表（只读）。公告正文可能较长，用展开行看全文而不是窄列截断。 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NDataTable, NText, useMessage, type DataTableColumns } from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { formatDateTime } from '@/shared/utils/format'
import { useLoading } from '@/shared/composables/useLoading'
import EmptyState from '@/shared/components/EmptyState.vue'
import { fetchAnnouncements } from '../api'
import type { AnnouncementView } from '../types'
import { useCourseAnchor } from '../useCourseAnchor'

const props = defineProps<{ courseId: number | null }>()

/** 请求一律用锚点 id(文档 §1.6):服务端回带的 teachInfoId 才回写进 anchorId */
const { anchorId, adopt } = useCourseAnchor(() => props.courseId)

const { t } = useI18n()
const message = useMessage()

const rows = ref<AnnouncementView[]>([])
const { loading, withLoading } = useLoading()

function loadData(): Promise<void> {
  const id = anchorId.value
  if (id == null) {
    rows.value = []
    return Promise.resolve()
  }
  return withLoading(async () => {
    try {
      const res = await fetchAnnouncements(id)
      rows.value = res.data
      // 列表回带的是锚点行 id,采纳后后续请求都用它
      adopt(res.data[0]?.teachInfoId)
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.loadFail'))
      }
      rows.value = []
    }
  })
}

watch(() => props.courseId, () => void loadData(), { immediate: true })

const columns = computed<DataTableColumns<AnnouncementView>>(() => [
  {
    title: t('coursework.announcement.title'),
    key: 'title',
    minWidth: 200,
    ellipsis: { tooltip: true },
  },
  {
    title: t('coursework.announcement.content'),
    key: 'content',
    minWidth: 320,
    ellipsis: { tooltip: true },
  },
  {
    title: t('coursework.announcement.publishTime'),
    key: 'createTime',
    width: 160,
    render: (row) => formatDateTime(row.createTime),
  },
])

const rowKey = (row: AnnouncementView) => row.id
</script>

<template>
  <div class="tab-body">
    <div class="tab-toolbar">
      <NText depth="3" class="tab-hint">{{ t('coursework.announcement.tab') }}</NText>
    </div>
    <EmptyState
      v-if="!loading && courseId != null && !rows.length"
      :description="t('coursework.common.empty')"
    />
    <NDataTable
      v-else-if="rows.length"
      :columns="columns"
      :data="rows"
      :row-key="rowKey"
      :pagination="false"
      :single-line="false"
      :bordered="false"
      :scroll-x="760"
    />
  </div>
</template>

<style scoped src="./TabShared.css"></style>
