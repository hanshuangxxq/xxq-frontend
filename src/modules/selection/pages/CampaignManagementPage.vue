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
  NGrid,
  NFormItemGi,
  NInput,
  NInputNumber,
  NSelect,
  NDatePicker,
  NPopconfirm,
  NSpin,
  NEmpty,
  NTag,
  NDivider,
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
  fetchAllGroups,
} from '../api'
import { fetchAllSemesters } from '@/modules/curriculum/api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import { useLocaleStore } from '@/stores/useLocaleStore'
import type {
  Campaign,
  CampaignForm,
  CampaignStatus,
  SelectionGroup,
} from '../types'
import type { Semester } from '@/modules/curriculum/types'
import CampaignCreateModal from '../components/CampaignCreateModal.vue'
import GroupManagementModal from '../components/GroupManagementModal.vue'

/**
 * 教务管理员创建/修改的选课活动固定为「公选」类型。
 */
const PUBLIC_ELECTIVE_COURSE_TYPE = '公选'

const { t } = useI18n()
const message = useMessage()
const router = useRouter()
const { isAcademicAdmin } = useRoleCheck()
const localeStore = useLocaleStore()
const dateLocale = computed(() => localeStore.naiveConfig().dateLocale)

const loading = ref(false)
const data = ref<Campaign[]>([])
const semesters = ref<Semester[]>([])
const groups = ref<SelectionGroup[]>([])

const semesterOptions = computed(() =>
  semesters.value.map((s) => ({ label: s.name, value: s.id })),
)

const groupOptions = computed(() =>
  groups.value.map((g) => ({ label: g.name, value: g.id })),
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

function isExpired(endTime: string): boolean {
  return new Date(endTime) < new Date()
}

async function loadData() {
  loading.value = true
  try {
    const [campaignRes, semesterRes, groupRes] = await Promise.all([
      fetchCampaigns(),
      fetchAllSemesters(),
      fetchAllGroups(),
    ])
    data.value = campaignRes.data
    semesters.value = semesterRes.data
    groups.value = groupRes.data
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
  { title: t('selection.name'), key: 'name', width: 220, ellipsis: { tooltip: true } },
  { title: t('selection.courseCode'), key: 'courseCode', width: 120 },
  { title: t('selection.credit'), key: 'credit', width: 70, align: 'center' },
  { title: t('selection.capacity'), key: 'capacity', width: 90, align: 'center' },
  { title: t('selection.semester'), key: 'semesterName', width: 150, ellipsis: { tooltip: true } },
  {
    title: t('selection.weekRange'),
    key: 'weekRange',
    width: 130,
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
      if (row.status === 'OPEN' && !isExpired(row.endTime)) {
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
      if (row.status === 'CLOSED' || (row.status === 'OPEN' && isExpired(row.endTime))) {
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
  groupId: null,
  courseCode: '',
  credit: 0,
  courseHour: null,
  description: '',
  courseType: PUBLIC_ELECTIVE_COURSE_TYPE,
  capacity: 30,
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
    // 详情接口不返回 boundGroupId，编辑表单中默认不修改绑定；
    // 用户选择新组后才会触发换绑。
    groupId: null,
    courseCode: row.courseCode,
    credit: row.credit,
    courseHour: row.courseHour,
    description: row.description,
    courseType: PUBLIC_ELECTIVE_COURSE_TYPE,
    capacity: row.capacity,
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
  if (!form.value.courseCode) {
    message.warning(t('selection.courseCodeRequired'))
    return
  }
  if (form.value.credit == null || form.value.credit < 0) {
    message.warning(t('selection.creditMin'))
    return
  }
  if (form.value.capacity == null || form.value.capacity <= 0) {
    message.warning(t('selection.capacityMin'))
    return
  }
  saving.value = true
  try {
    const payload: Partial<CampaignForm> = {
      name: form.value.name,
      semesterId: form.value.semesterId ?? undefined,
      startTime: form.value.startTime,
      endTime: form.value.endTime,
      startWeek: form.value.startWeek,
      endWeek: form.value.endWeek,
      courseCode: form.value.courseCode,
      credit: form.value.credit,
      courseHour: form.value.courseHour,
      description: form.value.description,
      courseType: PUBLIC_ELECTIVE_COURSE_TYPE,
      capacity: form.value.capacity,
    }
    // groupId 为 null 时不传，避免误触发换绑；
    // 用户选择了具体组才带上，由后端处理"已绑定同组幂等 / 换绑"逻辑。
    if (form.value.groupId != null) {
      payload.groupId = form.value.groupId
    }
    await updateCampaign(editingId.value!, payload)
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
    const item = data.value.find((c) => c.id === id)
    if (item) item.status = 'OPEN'
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  }
}

async function handleClose(id: number) {
  try {
    await closeCampaign(id)
    message.success(t('selection.close'))
    const item = data.value.find((c) => c.id === id)
    if (item) item.status = 'CLOSED'
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  }
}

async function handleFinalize(id: number) {
  try {
    const item = data.value.find((c) => c.id === id)
    if (item?.status === 'OPEN') {
      await closeCampaign(id)
    }
    await finalizeCampaign(id)
    message.success(t('selection.finalize'))
    if (item) item.status = 'FINALIZED'
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
            :scroll-x="1500"
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
        <NDivider title-placement="left">{{ $t('selection.section.basicInfo') }}</NDivider>
        <NGrid :cols="2" :x-gap="16" :y-gap="0">
          <NFormItemGi :span="2" :label="$t('selection.name')" required>
            <NInput
              v-model:value="form.name"
              :placeholder="$t('selection.namePlaceholder')"
            />
          </NFormItemGi>
          <NFormItemGi :label="$t('selection.semester')" required>
            <NSelect
              v-model:value="form.semesterId"
              :options="semesterOptions"
              :placeholder="$t('selection.semesterPlaceholder')"
            />
          </NFormItemGi>
          <NFormItemGi :label="$t('selection.startTime')" required>
            <NDatePicker
              v-model:formatted-value="form.startTime"
              type="datetime"
              value-format="yyyy-MM-dd'T'HH:mm:ss"
              :locale="dateLocale"
              :placeholder="$t('selection.startTime')"
              style="width: 100%"
            />
          </NFormItemGi>
          <NFormItemGi :label="$t('selection.endTime')" required>
            <NDatePicker
              v-model:formatted-value="form.endTime"
              type="datetime"
              value-format="yyyy-MM-dd'T'HH:mm:ss"
              :locale="dateLocale"
              :placeholder="$t('selection.endTime')"
              style="width: 100%"
            />
          </NFormItemGi>
          <NFormItemGi :label="$t('selection.weekRange')" required>
            <NSpace align="center" :wrap="false">
              <NInputNumber
                v-model:value="form.startWeek"
                :min="1"
                :placeholder="$t('selection.startWeek')"
                style="width: 100%"
              />
              <span style="color: #999">~</span>
              <NInputNumber
                v-model:value="form.endWeek"
                :min="1"
                :placeholder="$t('selection.endWeek')"
                style="width: 100%"
              />
            </NSpace>
          </NFormItemGi>
        </NGrid>

        <NDivider title-placement="left">{{ $t('selection.section.courseInfo') }}</NDivider>
        <NGrid :cols="2" :x-gap="16" :y-gap="0">
          <NFormItemGi :label="$t('selection.courseCode')" required>
            <NInput
              v-model:value="form.courseCode"
              :placeholder="$t('selection.courseCodePlaceholder')"
            />
          </NFormItemGi>
          <NFormItemGi :label="$t('selection.credit')" required>
            <NInputNumber
              v-model:value="form.credit"
              :min="0"
              :placeholder="$t('selection.credit')"
              style="width: 100%"
            />
          </NFormItemGi>
          <NFormItemGi :label="$t('selection.capacity')" required>
            <NInputNumber
              v-model:value="form.capacity"
              :min="1"
              :placeholder="$t('selection.capacity')"
              style="width: 100%"
            />
          </NFormItemGi>
          <NFormItemGi :label="$t('selection.courseHour')">
            <NInputNumber
              v-model:value="form.courseHour"
              :min="0"
              :placeholder="$t('selection.courseHour')"
              style="width: 100%"
            />
          </NFormItemGi>
          <NFormItemGi :span="2" :label="$t('selection.description')">
            <NInput
              v-model:value="form.description"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              :placeholder="$t('selection.descriptionPlaceholder')"
            />
          </NFormItemGi>
        </NGrid>

        <NDivider title-placement="left">{{ $t('selection.section.binding') }}</NDivider>
        <NGrid :cols="2" :x-gap="16" :y-gap="0">
          <NFormItemGi :span="2" :label="$t('selection.group')">
            <NSelect
              v-model:value="form.groupId"
              :options="groupOptions"
              :placeholder="$t('selection.groupKeepBindingPlaceholder')"
              clearable
            />
          </NFormItemGi>
        </NGrid>
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
      :groups="groups"
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
  width: 640px;
  max-width: 90vw;
}
</style>
