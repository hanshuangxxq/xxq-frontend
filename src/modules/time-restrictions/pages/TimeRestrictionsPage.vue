<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NDataTable,
  NButton,
  NModal,
  NForm,
  NFormItem,
  NSelect,
  NInput,
  NPopconfirm,
  NSpin,
  NEmpty,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  fetchTimeRestrictions,
  createTimeRestriction,
  updateTimeRestriction,
  deleteTimeRestriction,
} from '../api'
import { fetchAllTimes } from '@/modules/curriculum/api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { TimeRestriction, RestrictionType, TimeRestrictionForm } from '../types'
import type { TimeSlot } from '@/modules/curriculum/types'

const { t } = useI18n()
const message = useMessage()
const { isAcademicAdmin } = useRoleCheck()

const loading = ref(false)
const restrictions = ref<TimeRestriction[]>([])
const timeSlots = ref<TimeSlot[]>([])

const DAY_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
]

const TYPE_OPTIONS = computed(() => [
  { label: t('time-restrictions.blocked'), value: 'BLOCKED' as RestrictionType },
  { label: t('time-restrictions.reserved'), value: 'RESERVED' as RestrictionType },
])

const timeOptions = computed(() =>
  timeSlots.value.map((s) => ({
    label: `${s.startPeriod.substring(0, 5)}-${s.endPeriod.substring(0, 5)}`,
    value: s.id,
  })),
)

function getDayLabel(day: number): string {
  return DAY_OPTIONS.find((d) => d.value === day)?.label ?? String(day)
}

function getTimeLabel(timeId: number): string {
  return timeOptions.value.find((t) => t.value === timeId)?.label ?? String(timeId)
}

const columns: DataTableColumns<TimeRestriction> = [
  {
    title: t('time-restrictions.timeSlot'),
    key: 'timeId',
    width: 130,
    render(row) {
      return getTimeLabel(row.timeId)
    },
  },
  {
    title: t('time-restrictions.dayOfWeek'),
    key: 'dayOfWeek',
    width: 70,
    render(row) {
      return getDayLabel(row.dayOfWeek)
    },
  },
  {
    title: t('time-restrictions.restrictionType'),
    key: 'restrictionType',
    width: 100,
    render(row) {
      return row.restrictionType === 'BLOCKED'
        ? h(NTag, { type: 'error', size: 'small' }, () => t('time-restrictions.blocked'))
        : h(NTag, { type: 'warning', size: 'small' }, () => t('time-restrictions.reserved'))
    },
  },
  { title: t('time-restrictions.courseId'), key: 'courseId', width: 90 },
  {
    title: t('time-restrictions.reason'),
    key: 'reason',
    width: 200,
    ellipsis: { tooltip: true },
  },
]

const adminColumns = computed<DataTableColumns<TimeRestriction>>(() => [
  ...columns,
  {
    title: t('time-restrictions.actions'),
    key: 'actions',
    width: 140,
    render(row) {
      return h(NSpace, null, () => [
        h(
          NButton,
          { size: 'small', onClick: () => startEdit(row) },
          () => t('time-restrictions.edit'),
        ),
        h(NPopconfirm, { onPositiveClick: () => handleDelete(row.id) }, {
          default: () => t('time-restrictions.deleteConfirm'),
          trigger: () =>
            h(NButton, { size: 'small', type: 'error' }, () => t('time-restrictions.delete')),
        }),
      ])
    },
  },
])

async function loadData() {
  loading.value = true
  try {
    const [restRes, timeRes] = await Promise.all([fetchTimeRestrictions(), fetchAllTimes()])
    restrictions.value = restRes.data
    timeSlots.value = timeRes.data
  } catch (e) {
    message.error((e as Error).message || t('time-restrictions.loadFail'))
  } finally {
    loading.value = false
  }
}

// ---- Form ----
const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)

const emptyForm = (): TimeRestrictionForm => ({
  timeId: null,
  dayOfWeek: null,
  restrictionType: 'BLOCKED',
  courseId: null,
  reason: '',
})

const form = ref<TimeRestrictionForm>(emptyForm())

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(row: TimeRestriction) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = {
    timeId: row.timeId,
    dayOfWeek: row.dayOfWeek,
    restrictionType: row.restrictionType,
    courseId: row.courseId,
    reason: row.reason,
  }
  showForm.value = true
}

async function handleSave() {
  saving.value = true
  try {
    const body = { ...form.value }
    if (body.restrictionType === 'BLOCKED') {
      body.courseId = null
    }
    if (formMode.value === 'create') {
      await createTimeRestriction(body)
      message.success(t('time-restrictions.saveSuccess'))
    } else {
      await updateTimeRestriction(editingId.value!, body)
      message.success(t('time-restrictions.saveSuccess'))
    }
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('time-restrictions.saveFail'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deleteTimeRestriction(id)
    message.success(t('time-restrictions.deleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('time-restrictions.deleteFail'))
  }
}

function handleCloseForm() {
  showForm.value = false
}

onMounted(loadData)
</script>

<template>
  <div class="tr-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('time-restrictions.title')">
        <template v-if="isAcademicAdmin" #header-extra>
          <NButton type="primary" @click="startCreate">{{ $t('time-restrictions.add') }}</NButton>
        </template>
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && restrictions.length === 0"
            :description="$t('time-restrictions.empty')"
          />
          <NDataTable
            v-else
            :columns="isAcademicAdmin ? adminColumns : columns"
            :data="restrictions"
            :row-key="(r: TimeRestriction) => r.id"
            :single-line="false"
            :bordered="false"
          />
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showForm"
      preset="card"
      :title="
        formMode === 'create'
          ? $t('time-restrictions.createTitle')
          : $t('time-restrictions.editTitle')
      "
      class="tr-form-modal"
      @mask-click="handleCloseForm"
    >
      <NForm :model="form">
        <NFormItem :label="$t('time-restrictions.timeSlot')" required>
          <NSelect
            v-model:value="form.timeId"
            :options="timeOptions"
            :placeholder="$t('time-restrictions.timeSlot')"
          />
        </NFormItem>
        <NFormItem :label="$t('time-restrictions.dayOfWeek')" required>
          <NSelect
            v-model:value="form.dayOfWeek"
            :options="DAY_OPTIONS"
            :placeholder="$t('time-restrictions.dayOfWeek')"
          />
        </NFormItem>
        <NFormItem :label="$t('time-restrictions.restrictionType')" required>
          <NSelect
            v-model:value="form.restrictionType"
            :options="TYPE_OPTIONS"
          />
        </NFormItem>
        <NFormItem
          v-if="form.restrictionType === 'RESERVED'"
          :label="$t('time-restrictions.courseId')"
          required
        >
          <NInput
            :value="form.courseId !== null ? String(form.courseId) : ''"
            :placeholder="$t('time-restrictions.courseId')"
            @update:value="(v: string) => (form.courseId = v ? parseInt(v, 10) : null)"
          />
        </NFormItem>
        <NFormItem :label="$t('time-restrictions.reason')">
          <NInput
            v-model:value="form.reason"
            type="text"
            :placeholder="$t('time-restrictions.reason')"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="handleCloseForm">{{ $t('time-restrictions.cancel') }}</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            {{ $t('time-restrictions.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./TimeRestrictionsPage.css"></style>

<style>
.tr-form-modal {
  width: 420px;
  max-width: 85vw;
}
</style>
