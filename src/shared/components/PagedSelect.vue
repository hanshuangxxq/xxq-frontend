<script setup lang="ts" generic="T">
import { ref, shallowRef, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect, NButton } from 'naive-ui'
import type { PageResult, Result } from '@/shared/types'

const props = defineProps<{
  /** 当前选中值（单选）或选中值数组（多选） */
  modelValue: string | number | null | Array<string | number>
  /** 取一页数据：返回 Result<PageResult<T>> */
  fetchPage: (page: number, pageSize: number) => Promise<Result<PageResult<T>>>
  /** 由列表项生成显示文案 */
  labelOf: (item: T) => string
  /** 由列表项生成 option value */
  valueOf: (item: T) => string | number
  /** 每页条数（严格限量，默认 20） */
  pageSize?: number
  /** 预选值的显示文案（编辑回显用，当选中项不在已加载页时兜底显示） */
  initialLabel?: string
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  size?: 'small' | 'medium' | 'large'
  /** 是否可对当前页做本地过滤（端点不支持按名搜索，仅过滤当前页） */
  filterable?: boolean
  status?: 'success' | 'warning' | 'error'
  /** 多选模式 */
  multiple?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null | Array<string | number>]
}>()

const { t } = useI18n()

const page = ref(1)
const pages = ref(0)
const items = shallowRef<T[]>([])
const loading = ref(false)
/** value -> label 缓存，用于选中项不在当前页时的回显 */
const labelCache = ref<Record<string, string>>({})

async function loadPage(p: number): Promise<void> {
  loading.value = true
  try {
    const res = await props.fetchPage(p, props.pageSize ?? 20)
    const pr = res.data
    items.value = pr.records
    page.value = pr.page || p
    pages.value = pr.pages
    for (const it of pr.records) {
      labelCache.value[String(props.valueOf(it))] = props.labelOf(it)
    }
  } catch {
    items.value = []
    pages.value = 0
  } finally {
    loading.value = false
  }
}

function onShow(show: boolean): void {
  if (show) {
    // 每次展开回到第 1 页，保证数据新鲜
    void loadPage(1)
  }
}

function onSelect(val: string | number | null | Array<string | number>): void {
  emit('update:modelValue', val)
  const arr = Array.isArray(val) ? val : val == null ? [] : [val]
  for (const v of arr) {
    const hit = items.value.find((it) => props.valueOf(it) === v)
    if (hit) labelCache.value[String(v)] = props.labelOf(hit)
  }
}

function prevPage(): void {
  if (page.value > 1 && !loading.value) void loadPage(page.value - 1)
}

function nextPage(): void {
  if (page.value < pages.value && !loading.value) void loadPage(page.value + 1)
}

const options = computed(() => {
  const opts = items.value.map((it) => ({ label: props.labelOf(it), value: props.valueOf(it) }))
  if (props.multiple) {
    const selected = (props.modelValue as Array<string | number>) ?? []
    for (const v of selected) {
      if (!opts.some((o) => o.value === v)) {
        opts.push({ label: labelCache.value[String(v)] ?? String(v), value: v })
      }
    }
  } else {
    const val = props.modelValue as string | number | null
    if (val != null && !opts.some((o) => o.value === val)) {
      const label = labelCache.value[String(val)] ?? props.initialLabel ?? String(val)
      opts.unshift({ label, value: val })
    }
  }
  return opts
})

const pageInfo = computed(() =>
  pages.value > 0
    ? t('common.pagedSelect.pageInfo', { page: page.value, pages: pages.value })
    : t('common.pagedSelect.loading'),
)
</script>

<template>
  <NSelect
    :value="modelValue"
    :options="options"
    :loading="loading"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    :size="size"
    :filterable="filterable"
    :multiple="multiple"
    :status="status"
    @update:value="onSelect"
    @update:show="onShow"
  >
    <template #empty>{{ $t('common.pagedSelect.empty') }}</template>
    <template #action>
      <div class="paged-select-pager">
        <NButton size="tiny" quaternary :disabled="page <= 1 || loading" @click="prevPage">
          {{ $t('common.pagedSelect.prev') }}
        </NButton>
        <span class="paged-select-info">{{ pageInfo }}</span>
        <NButton size="tiny" quaternary :disabled="page >= pages || loading" @click="nextPage">
          {{ $t('common.pagedSelect.next') }}
        </NButton>
      </div>
    </template>
  </NSelect>
</template>

<style scoped src="./PagedSelect.css"></style>
