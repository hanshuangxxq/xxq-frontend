<script setup lang="ts">
/**
 * 选课活动的「选课范围 / 排课时段」字段组：可选年级、可选专业、预留时段。
 * 创建弹窗与编辑弹窗共用（两处表单的其余部分各自维护）。
 *
 * 三个字段都留空 = 不限；后端把空数组落成 null（不限），因此提交时**必须原样传数组**
 * ——只有传 `[]` 才能把已有限制清空，省略字段等于不改动。
 *
 * 字典在组件挂载时拉取。组件只在 NModal 内容区里用，而 NModal 默认
 * display-directive="if"（隐藏即卸载），所以「挂载」即「弹窗打开」，
 * 不会占用列表页首屏；每次打开都重新拉，与项目「前端不缓存字典」的取向一致。
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NDivider, NFormItemGi, NGrid, NSelect, useMessage } from 'naive-ui'
import { fetchGrades } from '@/modules/grades/api'
import { fetchMajors } from '@/modules/majors/api'
import { fetchAllTimes } from '@/modules/curriculum/api'
import { fetchTimeRestrictions } from '@/modules/time-restrictions/api'
import { isReportedError } from '@/shared/api'
import { bindableRestrictions, restrictionLabel, timeSlotLabels, weekdayLabels } from '../utils'
import type { Grade } from '@/modules/grades/types'
import type { Major } from '@/modules/majors/types'
import type { TimeSlot } from '@/modules/curriculum/types'
import type { TimeRestriction } from '@/modules/time-restrictions/types'

const props = defineProps<{
  /**
   * 已选年级 id；空数组或不传表示不限。
   * 三个值都按「可空」声明：CampaignForm 里它们本就是可选字段，
   * 未赋值与「不限」是同一语义，组件内部统一按空数组处理。
   */
  gradeIds?: number[]
  /** 已选专业 id；空数组或不传表示不限 */
  majorIds?: number[]
  /** 已绑定的预留时段 id；空数组或不传表示不预留 */
  timeRestrictionIds?: number[]
  /**
   * 编辑时为当前活动 id：它自己已认领的预留时段仍须出现在候选里，
   * 否则改绑时看不到原值。创建时传 null。
   */
  campaignId?: number | null
}>()

const emit = defineEmits<{
  'update:gradeIds': [value: number[]]
  'update:majorIds': [value: number[]]
  'update:timeRestrictionIds': [value: number[]]
}>()

const { t } = useI18n()
const message = useMessage()

const grades = ref<Grade[]>([])
const majors = ref<Major[]>([])
const timeSlots = ref<TimeSlot[]>([])
const restrictions = ref<TimeRestriction[]>([])

void (async () => {
  try {
    const [gradeRes, majorRes, slotRes, restrictionRes] = await Promise.all([
      fetchGrades(),
      fetchMajors(),
      fetchAllTimes(),
      fetchTimeRestrictions(),
    ])
    grades.value = gradeRes.data ?? []
    majors.value = majorRes.data ?? []
    timeSlots.value = slotRes.data ?? []
    restrictions.value = restrictionRes.data ?? []
  } catch (e) {
    // 字典拉取失败时下拉为空，api 层已提示，这里不再重复弹错
    if (!isReportedError(e)) message.error(t('selection.loadFail'))
  }
})()

const gradeOptions = computed(() => grades.value.map((g) => ({ label: g.name, value: g.id })))
const majorOptions = computed(() => majors.value.map((m) => ({ label: m.majorName, value: m.id })))

/** 星期几文案；放 computed 里以便语言切换时重算 */
const weekdays = computed(() => weekdayLabels(t))
const slotLabels = computed(() => timeSlotLabels(timeSlots.value))

const restrictionOptions = computed(() =>
  bindableRestrictions(restrictions.value, props.campaignId).map((r) => ({
    label: restrictionLabel(r, weekdays.value, slotLabels.value),
    value: r.id,
  })),
)

/** NSelect 多选值归一成 number[]；清空时可能是 null/undefined */
function toIds(v: string | number | null | Array<string | number>): number[] {
  const arr = Array.isArray(v) ? v : v == null ? [] : [v]
  return arr.map(Number)
}

function onGradesChange(v: string | number | null | Array<string | number>): void {
  emit('update:gradeIds', toIds(v))
}

function onMajorsChange(v: string | number | null | Array<string | number>): void {
  emit('update:majorIds', toIds(v))
}

function onRestrictionsChange(v: string | number | null | Array<string | number>): void {
  emit('update:timeRestrictionIds', toIds(v))
}
</script>

<template>
  <NDivider title-placement="left">{{ $t('selection.section.scope') }}</NDivider>
  <NGrid :cols="2" :x-gap="16" :y-gap="0">
    <NFormItemGi :label="$t('selection.allowedGrades')">
      <NSelect
        :value="gradeIds ?? []"
        :options="gradeOptions"
        :placeholder="$t('selection.allowedGradesPlaceholder')"
        multiple
        clearable
        filterable
        @update:value="onGradesChange"
      />
    </NFormItemGi>
    <NFormItemGi :label="$t('selection.allowedMajors')">
      <NSelect
        :value="majorIds ?? []"
        :options="majorOptions"
        :placeholder="$t('selection.allowedMajorsPlaceholder')"
        multiple
        clearable
        filterable
        @update:value="onMajorsChange"
      />
    </NFormItemGi>
  </NGrid>

  <NDivider title-placement="left">{{ $t('selection.section.scheduling') }}</NDivider>
  <NGrid :cols="1" :x-gap="16" :y-gap="0">
    <NFormItemGi
      :label="$t('selection.timeRestrictions')"
      :feedback="$t('selection.timeRestrictionsHint')"
    >
      <NSelect
        :value="timeRestrictionIds ?? []"
        :options="restrictionOptions"
        :placeholder="$t('selection.timeRestrictionsPlaceholder')"
        multiple
        clearable
        filterable
        @update:value="onRestrictionsChange"
      >
        <template #empty>{{ $t('selection.timeRestrictionsEmpty') }}</template>
      </NSelect>
    </NFormItemGi>
  </NGrid>
</template>
