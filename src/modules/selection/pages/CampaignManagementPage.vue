<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NDataTable,
  NButton,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NDatePicker,
  NPopconfirm,
  NSpin,
  NEmpty,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  fetchCampaigns,
  updateCampaign,
  deleteCampaign,
  openCampaign,
  closeCampaign,
  finalizeCampaign,
} from '../api'
import { fetchAllSemesters } from '@/modules/curriculum/api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import { useLocaleStore } from '@/stores/useLocaleStore'
import type { Campaign, CampaignForm, CampaignStatus } from '../types'
import type { Semester } from '@/modules/curriculum/types'
import CampaignCreateModal from '../components/CampaignCreateModal.vue'
import GroupManagementModal from '../components/GroupManagementModal.vue'

const { t } = useI18n()
const message = useMessage()
const router = useRouter()
const { isAcademicAdmin } = useRoleCheck()
const localeStore = useLocaleStore()
const dateLocale = computed(() => localeStore.naiveConfig().dateLocale)

const loading = ref(false)
const data = ref<Campaign[]>([])
const semesters = ref<Semester[]>([])

const semesterOptions = computed(() =>
  semesters.value.map((s) => ({ label: s.name, value: s.id })),
)

const statusTagType: Record<CampaignStatus, 'default' | 'info' | 'warning' | 'success'> = {
  DRAFT: 'default',
  OPEN: 'success',
  CLOSED: 'warning',
  FINALIZED: 'info',
}

function formatDateTime(s: string | null | undefined): string {
  return s ? s.replace('T', ' ') : ''
}

async function loadData() {
  loading.value = true
  try {
    const [campaignRes, semesterRes] = await Promise.all([fetchCampaigns(), fetchAllSemesters()])
    data.value = campaignRes.data
    semesters.value = semesterRes.data
  } catch (e) {
    message.error((e as Error).message || t('selection.loadFail'))
  } finally {
    loading.value = false
  }
}

function goDetail(id: number) {
  router.push(`/selection/${id}`)
}

const columns = computed<DataTableColumns<Campaign>>(() => [
  { title: t('selection.name'), key: 'name', width: 180, ellipsis: { tooltip: true } },
  { title: t('selection.semester'), key: 'semesterName', width: 160, ellipsis: { tooltip: true } },
  {
    title: t('selection.weekRange'),
    key: 'weekRange',
    width: 140,
    align: 'center',
    render: (row) => t('selection.weekRangeValue', { start: row.startWeek, end: row.endWeek }),
  },
  {
    title: t('selection.startTime'),
    key: 'startTime',
    width: 150,
    render: (row) => formatDateTime(row.startTime),
  },
  {
    title: t('selection.endTime'),
    key: 'endTime',
    width: 150,
    render: (row) => formatDateTime(row.endTime),
  },
  {
    title: t('selection.selectedCourseCount'),
    key: 'selectedCourseCount',
    width: 110,
    align: 'center',
  },
  {
    title: t('selection.status'),
    key: 'status',
    width: 100,
    align: 'center',
    render(row) {
      return h(
        NTag,
        { type: statusTagType[row.status], bordered: false },
        () => t(`selection.${row.status}`),
      )
    },
  },
  {
    title: t('selection.actions'),
    key: 'actions',
    width: 280,
    fixed: 'right',
    render(row) {
      const buttons: ReturnType<typeof h>[] = []
      buttons.push(
        h(
          NButton,
          { size: 'small', quaternary: true, type: 'info', onClick: () => goDetail(row.id) },
          () => t('selection.viewDetail'),
        ),
      )
      if (row.status === 'DRAFT') {
        buttons.push(
          h(NButton, { size: 'small', onClick: () => startEdit(row) }, () => t('selection.edit')),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row.id) },
            {
              default: () => t('selection.deleteConfirm'),
              trigger: () =>
                h(NButton, { size: 'small', type: 'error' }, () => t('selection.delete')),
            },
          ),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleOpen(row.id) },
            {
              default: () => t('selection.openConfirm'),
              trigger: () =>
                h(NButton, { size: 'small', type: 'primary' }, () => t('selection.open')),
            },
          ),
        )
      }
      if (row.status === 'OPEN') {
        buttons.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleClose(row.id) },
            {
              default: () => t('selection.closeConfirm'),
              trigger: () =>
                h(NButton, { size: 'small', type: 'warning' }, () => t('selection.close')),
            },
          ),
        )
      }
      if (row.status === 'CLOSED') {
        buttons.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleFinalize(row.id) },
            {
              default: () => t('selection.finalizeConfirm'),
              trigger: () =>
                h(NButton, { size: 'small', type: 'primary' }, () => t('selection.finalize')),
            },
          ),
        )
      }
      if (row.status === 'FINALIZED') {
        buttons.push(
          h(
            NButton,
            { size: 'small', quaternary: true, onClick: () => goDetail(row.id) },
            () => t('selection.viewClasses'),
          ),
        )
      }
      return h(NSpace, { size: 4 }, () => buttons)
    },
  },
])

const showForm = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const showCreateModal = ref(false)
const showGroupModal = ref(false)

const emptyForm = (): CampaignForm => ({
  name: '',
  semesterId: null,
  startTime: undefined,
  endTime: undefined,
  startWeek: 1,
  endWeek: 16,
})

const form = ref<CampaignForm>(emptyForm())

function startCreate() {
  showCreateModal.value = true
}

function startEdit(row: Campaign) {
  editingId.value = row.id
  form.value = {
    name: row.name,
    semesterId: row.semesterId,
    startTime: row.startTime,
    endTime: row.endTime,
    startWeek: row.startWeek,
    endWeek: row.endWeek,
  }
  showForm.value = true
}

async function handleSave() {
  if (!form.value.name) {
    message.warning(t('selection.nameRequired'))
    return
  }
  if (!form.value.semesterId) {
    message.warning(t('selection.semesterRequired'))
    return
  }
  if (!form.value.startTime) {
    message.warning(t('selection.startTimeRequired'))
    return
  }
  if (!form.value.endTime) {
    message.warning(t('selection.endTimeRequired'))
    return
  }
  if (form.value.startTime && form.value.endTime && form.value.startTime >= form.value.endTime) {
    message.warning(t('selection.endTimeAfterStartTime'))
    return
  }
  if (form.value.startWeek == null || form.value.startWeek <= 0) {
    message.warning(t('selection.startWeekRequired'))
    return
  }
  if (form.value.endWeek == null || form.value.endWeek <= 0) {
    message.warning(t('selection.endWeekRequired'))
    return
  }
  if (form.value.startWeek > form.value.endWeek) {
    message.warning(t('selection.endWeekAfterStartWeek'))
    return
  }
  saving.value = true
  try {
    await updateCampaign(editingId.value!, {
      name: form.value.name,
      semesterId: form.value.semesterId ?? undefined,
      startTime: form.value.startTime,
      endTime: form.value.endTime,
      startWeek: form.value.startWeek,
      endWeek: form.value.endWeek,
    })
    message.success(t('selection.saveSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deleteCampaign(id)
    message.success(t('selection.deleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('selection.deleteFail'))
  }
}

async function handleOpen(id: number) {
  try {
    await openCampaign(id)
    message.success(t('selection.open'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  }
}

async function handleClose(id: number) {
  try {
    await closeCampaign(id)
    message.success(t('selection.close'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  }
}

async function handleFinalize(id: number) {
  try {
    await finalizeCampaign(id)
    message.success(t('selection.finalize'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  }
}

onMounted(loadData)
</script>

<template>
  <div class="campaign-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('selection.title')">
        <template v-if="isAcademicAdmin" #header-extra>
          <NSpace>
            <NButton @click="showGroupModal = true">
              {{ $t('selection.manageGroups') }}
            </NButton>
            <NButton type="primary" @click="startCreate">{{ $t('selection.add') }}</NButton>
          </NSpace>
        </template>
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && data.length === 0"
            :description="$t('selection.empty')"
          />
          <NDataTable
            v-else
            :columns="columns"
            :data="data"
            :row-key="(r: Campaign) => r.id"
            :single-line="false"
            :bordered="false"
            :scroll-x="1300"
          />
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showForm"
      preset="card"
      :title="$t('selection.editTitle')"
      class="campaign-edit-modal"
    >
      <NForm :model="form" label-placement="top">
        <NFormItem :label="$t('selection.name')" required>
          <NInput
            v-model:value="form.name"
            :placeholder="$t('selection.namePlaceholder')"
          />
        </NFormItem>
        <NFormItem :label="$t('selection.semester')" required>
          <NSelect
            v-model:value="form.semesterId"
            :options="semesterOptions"
            :placeholder="$t('selection.semesterPlaceholder')"
          />
        </NFormItem>
        <NFormItem :label="$t('selection.startTime')" required>
          <NDatePicker
            v-model:formatted-value="form.startTime"
            type="datetime"
            value-format="yyyy-MM-dd'T'HH:mm:ss"
            :locale="dateLocale"
            :placeholder="$t('selection.startTime')"
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem :label="$t('selection.endTime')" required>
          <NDatePicker
            v-model:formatted-value="form.endTime"
            type="datetime"
            value-format="yyyy-MM-dd'T'HH:mm:ss"
            :locale="dateLocale"
            :placeholder="$t('selection.endTime')"
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem :label="$t('selection.startWeek')" required>
          <NInputNumber v-model:value="form.startWeek" :min="1" style="width: 100%" />
        </NFormItem>
        <NFormItem :label="$t('selection.endWeek')" required>
          <NInputNumber v-model:value="form.endWeek" :min="1" style="width: 100%" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">{{ $t('selection.cancel') }}</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            {{ $t('selection.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <CampaignCreateModal
      v-model:show="showCreateModal"
      :semesters="semesters"
      @success="loadData"
    />

    <GroupManagementModal
      v-model:show="showGroupModal"
      @changed="loadData"
    />
  </div>
</template>

<style scoped src="./CampaignManagementPage.css"></style>

<style>
.campaign-edit-modal {
  width: 560px;
  max-width: 90vw;
}
</style>
