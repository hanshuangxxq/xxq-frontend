<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NButton,
  NPopconfirm,
  NSpin,
  NEmpty,
  NTag,
  NCollapse,
  NCollapseItem,
  NDescriptions,
  NDescriptionsItem,
  NDataTable,
  NAlert,
  NModal,
  NForm,
  NFormItem,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  fetchCampaign,
  fetchCampaignClasses,
  closeCampaign,
  finalizeCampaign,
  assignClassTeacher,
} from '../api'
import { fetchTeachers } from '@/modules/curriculum/api'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import type { Teacher } from '@/modules/curriculum/types'
import type { Campaign, CampaignStatus, SelectionClass } from '../types'

const { t } = useI18n()
const message = useMessage()
const route = useRoute()
const router = useRouter()

const campaignId = computed(() => Number(route.params.id))

const loading = ref(false)
const campaign = ref<Campaign | null>(null)
const classes = ref<SelectionClass[]>([])

const statusTagType: Record<CampaignStatus, 'default' | 'info' | 'warning' | 'success'> = {
  DRAFT: 'default',
  OPEN: 'success',
  CLOSED: 'warning',
  FINALIZED: 'info',
}

function formatDateTime(s: string | null | undefined): string {
  return s ? s.replace('T', ' ') : ''
}

const isExpired = computed(() => {
  if (!campaign.value?.endTime) return false
  return new Date(campaign.value.endTime) < new Date()
})

async function loadCampaign() {
  try {
    const res = await fetchCampaign(campaignId.value)
    campaign.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('selection.loadFail'))
  }
}

async function loadClasses() {
  try {
    const res = await fetchCampaignClasses(campaignId.value)
    classes.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('selection.loadFail'))
  }
}

async function loadAll() {
  loading.value = true
  try {
    await loadCampaign()
    if (campaign.value?.status === 'FINALIZED') {
      await loadClasses()
    }
  } finally {
    loading.value = false
  }
}

const memberColumns: DataTableColumns<{
  studentId: number
  studentName: string
  studentNo: string
  className: string
}> = [
  { title: t('selection.studentNo'), key: 'studentNo', width: 120 },
  { title: t('selection.studentName'), key: 'studentName', width: 120 },
  { title: t('selection.className'), key: 'className', width: 160 },
]

async function handleClose() {
  try {
    await closeCampaign(campaignId.value)
    message.success(t('selection.close'))
    if (campaign.value) campaign.value.status = 'CLOSED'
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  }
}

async function handleFinalize() {
  try {
    if (campaign.value?.status === 'OPEN') {
      await closeCampaign(campaignId.value)
    }
    await finalizeCampaign(campaignId.value)
    message.success(t('selection.finalize'))
    if (campaign.value) campaign.value.status = 'FINALIZED'
    await loadClasses()
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  }
}

function goBack() {
  router.push('/selection')
}

// ---- Teacher assignment ----
const showTeacherModal = ref(false)
const savingTeacher = ref(false)
const editingClassId = ref<number | null>(null)
const selectedTeacherId = ref<number | null>(null)
/** 分配教师弹窗回显用（选中教师不在已加载页时兜底显示） */
const assignInitialLabel = ref<string | undefined>(undefined)

async function openAssignTeacher(cls: SelectionClass) {
  editingClassId.value = cls.classId
  selectedTeacherId.value = cls.teacherId
  assignInitialLabel.value = cls.teacherName ?? undefined
  showTeacherModal.value = true
}

async function handleSaveTeacher() {
  if (editingClassId.value == null) return
  const classId = editingClassId.value
  const target = classes.value.find((c) => c.classId === classId)
  if (target && selectedTeacherId.value === target.teacherId) {
    showTeacherModal.value = false
    return
  }
  savingTeacher.value = true
  try {
    const res = await assignClassTeacher(campaignId.value, classId, selectedTeacherId.value)
    const idx = classes.value.findIndex((c) => c.classId === classId)
    if (idx >= 0) {
      classes.value[idx] = res.data
    }
    message.success(t('selection.assignTeacherSuccess'))
    showTeacherModal.value = false
  } catch (e) {
    message.error((e as Error).message || t('selection.assignTeacherFail'))
  } finally {
    savingTeacher.value = false
  }
}

async function handleUnassignTeacher(cls: SelectionClass) {
  try {
    const res = await assignClassTeacher(campaignId.value, cls.classId, null)
    const idx = classes.value.findIndex((c) => c.classId === cls.classId)
    if (idx >= 0) {
      classes.value[idx] = res.data
    }
    message.success(t('selection.unassignTeacherSuccess'))
  } catch (e) {
    message.error((e as Error).message || t('selection.assignTeacherFail'))
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="campaign-detail-page">
    <NSpace vertical :size="16">
      <NCard>
        <div class="detail-header">
          <div class="detail-header-left">
            <NButton quaternary @click="goBack">{{ $t('selection.back') }}</NButton>
            <span class="detail-title">{{ campaign?.name }}</span>
            <NTag v-if="campaign" :type="statusTagType[campaign.status]" :bordered="false">
              {{ $t(`selection.${campaign.status}`) }}
            </NTag>
            <NTag v-if="campaign" type="info" :bordered="false">
              {{ $t('selection.publicElectiveTag') }}
            </NTag>
          </div>
          <NSpace>
            <NPopconfirm
              v-if="campaign?.status === 'OPEN' && !isExpired"
              :on-positive-click="handleClose"
            >
              <template #trigger>
                <NButton type="warning">{{ $t('selection.close') }}</NButton>
              </template>
              {{ $t('selection.closeConfirm') }}
            </NPopconfirm>
            <NPopconfirm
              v-if="campaign?.status === 'CLOSED' || (campaign?.status === 'OPEN' && isExpired)"
              :on-positive-click="handleFinalize"
            >
              <template #trigger>
                <NButton type="primary">{{ $t('selection.finalize') }}</NButton>
              </template>
              {{ $t('selection.finalizeConfirm') }}
            </NPopconfirm>
          </NSpace>
        </div>
      </NCard>

      <NCard v-if="campaign">
        <NDescriptions :column="3" label-placement="left" bordered>
          <NDescriptionsItem :label="$t('selection.semester')">
            {{ campaign.semesterName }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.startTime')">
            {{ formatDateTime(campaign.startTime) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.endTime')">
            {{ formatDateTime(campaign.endTime) }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.weekRange')">
            {{
              $t('selection.weekRangeValue', { start: campaign.startWeek, end: campaign.endWeek })
            }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.courseName')">
            {{ campaign.name }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.courseCode')">
            {{ campaign.courseCode }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.credit')">
            {{ campaign.credit }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.courseHour')">
            {{ campaign.courseHour ?? '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.capacity')">
            {{ campaign.capacity }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.group')">
            {{ campaign.groupName ?? '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.createTime')">
            {{ formatDateTime(campaign.createTime) }}
          </NDescriptionsItem>
          <NDescriptionsItem
            v-if="campaign.description"
            :label="$t('selection.description')"
            :span="3"
          >
            {{ campaign.description }}
          </NDescriptionsItem>
        </NDescriptions>
      </NCard>

      <NCard :title="$t('selection.classResults')">
        <NSpin :show="loading">
          <NAlert v-if="campaign && campaign.status !== 'FINALIZED'" type="info" :show-icon="false">
            {{ $t('selection.noClassResults') }}
          </NAlert>
          <NEmpty
            v-else-if="!loading && classes.length === 0"
            :description="$t('selection.noStudentsSelected')"
          />
          <NCollapse v-else arrow-placement="left">
            <NCollapseItem
              v-for="cls in classes"
              :key="cls.classId"
              :name="String(cls.classId)"
              :title="`${cls.courseName} - ${$t('selection.classNo')} ${cls.classNo} (${cls.studentCount} ${$t('selection.studentCount')})`"
            >
              <template #header-extra>
                <NSpace :size="8" align="center" @click.stop>
                  <NTag v-if="cls.teacherName" size="small" type="info" :bordered="false">
                    {{ $t('selection.teacher') }}: {{ cls.teacherName }}
                  </NTag>
                  <NTag v-else size="small" type="warning" :bordered="false">
                    {{ $t('selection.unassignedTeacher') }}
                  </NTag>
                  <NButton size="small" @click="openAssignTeacher(cls)">
                    {{
                      cls.teacherId ? $t('selection.changeTeacher') : $t('selection.assignTeacher')
                    }}
                  </NButton>
                  <NPopconfirm
                    v-if="cls.teacherId"
                    :on-positive-click="() => handleUnassignTeacher(cls)"
                  >
                    <template #trigger>
                      <NButton size="small" type="warning" quaternary>
                        {{ $t('selection.unassignTeacher') }}
                      </NButton>
                    </template>
                    {{ $t('selection.unassignTeacherConfirm') }}
                  </NPopconfirm>
                </NSpace>
              </template>
              <NDataTable
                :columns="memberColumns"
                :data="cls.members"
                :row-key="(r: { studentId: number }) => r.studentId"
                :single-line="false"
                :bordered="false"
                size="small"
              />
            </NCollapseItem>
          </NCollapse>
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showTeacherModal"
      preset="card"
      :title="$t('selection.assignTeacherTitle')"
      class="teacher-assign-modal"
      style="width: 480px; max-width: 90vw"
    >
      <NForm label-placement="top">
        <NFormItem :label="$t('selection.teacher')">
          <PagedSelect
            :model-value="selectedTeacherId"
            :fetch-page="(page: number, pageSize: number) => fetchTeachers(page, pageSize)"
            :label-of="
              (tch: Teacher) =>
                `${tch.name}（${tch.teacherNo}）${tch.title ? ` · ${tch.title}` : ''}`
            "
            :value-of="(tch: Teacher) => tch.id"
            :initial-label="assignInitialLabel"
            :placeholder="$t('selection.teacherPlaceholder')"
            clearable
            @update:model-value="
              (v: string | number | null | Array<string | number>) =>
                (selectedTeacherId = v as number | null)
            "
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showTeacherModal = false">
            {{ $t('selection.cancel') }}
          </NButton>
          <NButton type="primary" :loading="savingTeacher" @click="handleSaveTeacher">
            {{ $t('selection.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./CampaignDetailPage.css"></style>
