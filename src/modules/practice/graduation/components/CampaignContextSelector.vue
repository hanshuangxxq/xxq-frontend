<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect, NTag, NSpace, NText, NDivider } from 'naive-ui'
import { useAuthStore } from '@/stores/useAuthStore'
import { fetchAvailableCampaigns, fetchCampaigns, fetchSelectorCampaigns } from '../api'
import { fetchAllPages } from '@/shared/pagination'
import { campaignStatusTagType } from '@/modules/practice/utils'
import type { CampaignResponse } from '../types'

/**
 * 毕设活动上下文选择器（F-R-47）：
 * - 学生取 GET /campaigns/available；教师/院系取 GET /campaigns/selector；教务取分页 GET /campaigns 拉全量
 * - 选中项按角色记忆到 localStorage，切换活动即整体刷新数据
 * - 展示选中活动选题窗口与状态（F-R-48）；windowKey 指定时额外展示开题/中期/论文窗口
 */
const props = defineProps<{
  campaignId: number | null
  /** 需要展示的过程窗口（开题/中期/论文），未配置窗口时仅显示选题窗口 */
  windowKey?: 'opening' | 'midterm' | 'thesis'
}>()

const emit = defineEmits<{
  'update:campaignId': [value: number | null]
  'update:campaign': [value: CampaignResponse | null]
}>()

const { t } = useI18n()
const authStore = useAuthStore()

const campaigns = ref<CampaignResponse[]>([])
const loading = ref(false)

const isStudent = computed(() => authStore.user?.userType === 'student')
const isAcademic = computed(() => authStore.user?.userType === 'academic_admin')
const storageKey = computed(() => `graduation.campaign.${authStore.user?.userType ?? 'unknown'}`)

const options = computed(() =>
  campaigns.value.map((c) => ({
    label: `${c.name}（${c.status}）`,
    value: c.id,
  })),
)

const current = computed<CampaignResponse | null>(
  () => campaigns.value.find((c) => c.id === props.campaignId) ?? null,
)

const now = Date.now()

/** 选题窗口状态文案 */
const topicWindowText = computed(() => {
  const c = current.value
  if (!c) return ''
  const start = new Date(c.topicStartTime).getTime()
  const end = new Date(c.topicEndTime).getTime()
  if (now < start) return t('graduation.common.topicNotStarted')
  if (now > end) return t('graduation.common.topicEnded')
  return t('graduation.common.topicOpen')
})

/** 过程窗口（开题/中期/论文）信息：{ label, start, end, open }，未配置返回 null */
const processWindow = computed<{
  label: string
  start: string
  end: string
  open: boolean
  text: string
} | null>(() => {
  const c = current.value
  if (!c || !props.windowKey) return null
  const key = props.windowKey
  const start =
    key === 'opening'
      ? c.openingStartTime
      : key === 'midterm'
        ? c.midtermStartTime
        : c.thesisStartTime
  const end =
    key === 'opening' ? c.openingEndTime : key === 'midterm' ? c.midtermEndTime : c.thesisEndTime
  const label =
    key === 'opening'
      ? t('graduation.academic.openingWindow')
      : key === 'midterm'
        ? t('graduation.academic.midtermWindow')
        : t('graduation.academic.thesisWindow')
  if (!start || !end) return null
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  let open: boolean
  let text: string
  if (now < s) {
    open = false
    text = t('graduation.common.windowNotStarted')
  } else if (now > e) {
    open = false
    text = t('graduation.common.windowEnded')
  } else {
    open = true
    text = t('graduation.common.windowInProgress')
  }
  return { label, start, end, open, text }
})

async function loadCampaigns(): Promise<void> {
  loading.value = true
  try {
    if (isStudent.value) {
      const res = await fetchAvailableCampaigns()
      campaigns.value = res.data ?? []
    } else if (isAcademic.value) {
      // 教务无 /selector 权限，走分页列表拉全量；过滤草稿与 /selector 语义对齐
      const all = await fetchAllPages((page, pageSize) => fetchCampaigns({ page, pageSize }))
      campaigns.value = all.filter((c) => c.status !== '草稿')
    } else {
      const res = await fetchSelectorCampaigns()
      campaigns.value = res.data ?? []
    }
    // 优先恢复记忆的活动，否则默认选第一个（最新）
    const remembered = localStorage.getItem(storageKey.value)
    const hit =
      campaigns.value.find((c) => String(c.id) === remembered) ?? campaigns.value[0] ?? null
    if (hit && hit.id !== props.campaignId) {
      emit('update:campaignId', hit.id)
      emit('update:campaign', hit)
      localStorage.setItem(storageKey.value, String(hit.id))
    } else if (!hit) {
      emit('update:campaignId', null)
      emit('update:campaign', null)
    }
  } catch {
    campaigns.value = []
  } finally {
    loading.value = false
  }
}

function handleChange(id: number | null): void {
  emit('update:campaignId', id)
  const c = campaigns.value.find((x) => x.id === id) ?? null
  emit('update:campaign', c)
  if (id != null) localStorage.setItem(storageKey.value, String(id))
}

watch(
  () => props.campaignId,
  () => {
    if (props.campaignId != null && !current.value) {
      emit('update:campaign', null)
    }
  },
)

onMounted(loadCampaigns)
</script>

<template>
  <div class="campaign-context-selector">
    <NSpace align="center" :size="12">
      <NSelect
        :value="campaignId"
        :options="options"
        :loading="loading"
        :placeholder="$t('graduation.common.selectCampaign')"
        style="width: 260px"
        @update:value="handleChange"
      />
      <template v-if="current">
        <NTag :type="campaignStatusTagType(current.status)" size="small" :bordered="false">
          {{ current.status }}
        </NTag>
        <NText depth="3" style="font-size: 13px">
          {{
            $t('graduation.common.topicWindowTimes', {
              start: current.topicStartTime.slice(0, 16).replace('T', ' '),
              end: current.topicEndTime.slice(0, 16).replace('T', ' '),
            })
          }}
        </NText>
        <NText
          :type="topicWindowText === $t('graduation.common.topicOpen') ? 'success' : 'warning'"
          style="font-size: 13px"
        >
          {{ topicWindowText }}
        </NText>
        <template v-if="processWindow">
          <NDivider vertical style="margin: 0 4px" />
          <NText depth="3" style="font-size: 13px">
            {{ processWindow.label }}：{{ processWindow.start.slice(0, 16).replace('T', ' ') }} ~
            {{ processWindow.end.slice(0, 16).replace('T', ' ') }}
          </NText>
          <NText :type="processWindow.open ? 'success' : 'warning'" style="font-size: 13px">
            {{ processWindow.text }}
          </NText>
        </template>
      </template>
      <template v-else-if="!loading">
        <NText depth="3" style="font-size: 13px">{{ $t('graduation.common.noCampaign') }}</NText>
      </template>
    </NSpace>
  </div>
</template>
