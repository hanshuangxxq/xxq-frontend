<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpin,
  NEmpty,
  NDataTable,
  NResult,
  NSpace,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import { fetchDefenseList } from '../../api'
import { formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { DefenseResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isStudent } = useRoleCheck()

const campaignId = ref<number | null>(null)
const list = ref<DefenseResponse[]>([])
const loading = ref(false)

async function loadList(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const res = await fetchDefenseList(campaignId.value)
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

const defenseRowKey = (row: DefenseResponse) => row.id

const columns = computed<DataTableColumns<DefenseResponse>>(() => [
  {
    title: t('graduation.student.defenseGroup'),
    key: 'groupName',
    minWidth: 120,
    render: (r) => r.groupName ?? '-',
  },
  {
    title: t('graduation.student.defenseTime'),
    key: 'defenseTime',
    width: 160,
    render: (r) => formatDateTime(r.defenseTime),
  },
  {
    title: t('graduation.student.defenseLocation'),
    key: 'location',
    minWidth: 140,
    render: (r) => r.location ?? '-',
  },
  {
    title: t('graduation.student.defenseReviewer'),
    key: 'reviewerName',
    width: 110,
    render: (r) => r.reviewerName ?? '-',
  },
  {
    title: t('graduation.student.defenseTeachers'),
    key: 'defenseTeacherNames',
    minWidth: 200,
    render: (r) =>
      h(NSpace, { size: 4, wrap: true }, () =>
        (r.defenseTeacherNames.length ? r.defenseTeacherNames : ['-']).map((n) =>
          h(NTag, { size: 'small', bordered: false }, () => n),
        ),
      ),
  },
])
</script>

<template>
  <div class="graduation-page">
    <NResult
      v-if="!isStudent"
      status="403"
      :title="$t('graduation.common.noPermission')"
      :description="$t('graduation.common.noPermissionDesc')"
    />
    <template v-else>
      <NCard class="context-card">
        <CampaignContextSelector
          v-model:campaign-id="campaignId"
          @update:campaign-id="onCampaignChange"
        />
      </NCard>

      <NCard :title="$t('graduation.student.defenseTitle')" class="content-card">
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && !list.length"
            :description="$t('graduation.student.defenseEmpty')"
          />
          <NDataTable
            v-else
            :columns="columns"
            :data="list"
            :row-key="defenseRowKey"
            :single-line="false"
            :bordered="false"
            :scroll-x="760"
          >
            <template #empty><NEmpty :description="$t('graduation.common.empty')" /></template>
          </NDataTable>
        </NSpin>
      </NCard>
    </template>
  </div>
</template>

<style scoped src="./DefenseInfoPage.css"></style>
