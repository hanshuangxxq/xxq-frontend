<script setup lang="ts">
/**
 * 选课活动详情页（教务）：活动基础信息与按状态流转的操作（关闭/结束选课），
 * 活动结束后展示选课结果班级名单，并可逐个班级分配/更换/取消授课教师。
 */
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NButton,
  NPopconfirm,
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
import { fetchAllTimes, fetchTeachers } from '@/modules/curriculum/api'
import { fetchGrades } from '@/modules/grades/api'
import { fetchMajors } from '@/modules/majors/api'
import { fetchTimeRestrictions } from '@/modules/time-restrictions/api'
import { useLoading } from '@/shared/composables/useLoading'
import { isReportedError } from '@/shared/api'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import { restrictionLabel, timeSlotLabels, weekdayLabels } from '../utils'
import type { Teacher, TimeSlot } from '@/modules/curriculum/types'
import type { Grade } from '@/modules/grades/types'
import type { Major } from '@/modules/majors/types'
import type { TimeRestriction } from '@/modules/time-restrictions/types'
import type { Campaign, CampaignStatus, SelectionClass, StudentSelectionMember } from '../types'

const { t } = useI18n()
const message = useMessage()
const route = useRoute()
const router = useRouter()

const campaignId = computed(() => Number(route.params.id))

const { loading, withLoading } = useLoading()
const campaign = ref<Campaign | null>(null)
const classes = ref<SelectionClass[]>([])

/**
 * 选课范围的字典：详情里只展示 id，须翻译成名称。
 * 失败时保持空表，`*Names` 会退化成 #id，不影响其余信息展示。
 */
const grades = ref<Grade[]>([])
const majors = ref<Major[]>([])
const timeSlots = ref<TimeSlot[]>([])
const restrictions = ref<TimeRestriction[]>([])

const statusTagType: Record<CampaignStatus, 'default' | 'info' | 'warning' | 'success'> = {
  DRAFT: 'default',
  OPEN: 'success',
  CLOSED: 'warning',
  FINALIZED: 'info',
}

function formatDateTime(s: string | null | undefined): string {
  return s ? s.replace('T', ' ') : ''
}

/** 活动结束时间已过：开放中的活动视为可直接「结束」 */
const isExpired = computed(() => {
  if (!campaign.value?.endTime) return false
  return new Date(campaign.value.endTime) < new Date()
})

async function loadCampaign() {
  try {
    const res = await fetchCampaign(campaignId.value)
    campaign.value = res.data
  } catch (e) {
    if (!isReportedError(e)) message.error((e as Error).message || t('selection.loadFail'))
  }
}

async function loadClasses() {
  try {
    const res = await fetchCampaignClasses(campaignId.value)
    classes.value = res.data
  } catch (e) {
    if (!isReportedError(e)) message.error((e as Error).message || t('selection.loadFail'))
  }
}

/** 拉一次选课范围字典（年级/专业/节次/时段限制），翻译上面三组 id 用 */
async function loadScopeDicts() {
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
    if (!isReportedError(e)) message.error((e as Error).message || t('selection.loadFail'))
  }
}

function loadAll() {
  return withLoading(async () => {
    await Promise.all([loadCampaign(), loadScopeDicts()])
    // 班级名单仅活动结束后生成，非结束态不发请求
    if (campaign.value?.status === 'FINALIZED') {
      await loadClasses()
    }
  })
}

/** id -> 显示名；字典缺失（如字典里已删、拉取失败）时退化成 #id */
function namesOf(ids: number[] | undefined, labels: Map<number, string>): string {
  if (!ids?.length) return ''
  return ids.map((id) => labels.get(id) ?? `#${id}`).join('、')
}

const gradeLabels = computed(() => new Map(grades.value.map((g) => [g.id, g.name])))
const majorLabels = computed(() => new Map(majors.value.map((m) => [m.id, m.majorName])))
const weekdays = computed(() => weekdayLabels(t))
const slotLabels = computed(() => timeSlotLabels(timeSlots.value))

/**
 * 范围/时段为空表示不限，展示成「-」；此处**不做** bindableRestrictions 过滤
 * ——活动已绑定的时段即便后来被别人占用也要照原样显示出来。
 */
const allowedGradeNames = computed(() =>
  namesOf(campaign.value?.allowedGradeIds, gradeLabels.value),
)
const allowedMajorNames = computed(() => namesOf(campaign.value?.allowedMajors, majorLabels.value))
const restrictionNames = computed(() => {
  const ids = campaign.value?.timeRestrictionIds
  if (!ids?.length) return ''
  const byId = new Map(restrictions.value.map((r) => [r.id, r]))
  return ids
    .map((id) => {
      const r = byId.get(id)
      return r ? restrictionLabel(r, weekdays.value, slotLabels.value) : `#${id}`
    })
    .join('、')
})

const memberColumns: DataTableColumns<StudentSelectionMember> = [
  { title: t('selection.studentNo'), key: 'studentNo', width: 120 },
  { title: t('selection.studentName'), key: 'studentName', width: 120 },
  { title: t('selection.className'), key: 'className', width: 160 },
]

const memberRowKey = (row: StudentSelectionMember) => row.studentId

async function handleClose() {
  try {
    await closeCampaign(campaignId.value)
    message.success(t('selection.close'))
    if (campaign.value) campaign.value.status = 'CLOSED'
  } catch (e) {
    if (!isReportedError(e)) message.error((e as Error).message || t('selection.saveFail'))
  }
}

/** 结束选课：开放态先关闭再结束，完成后拉取班级名单 */
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
    if (!isReportedError(e)) message.error((e as Error).message || t('selection.saveFail'))
  }
}

function goBack() {
  router.push('/selection')
}

// ---- Teacher assignment ----
const showTeacherModal = ref(false)
const { loading: savingTeacher, withLoading: withSavingTeacher } = useLoading()
const editingClassId = ref<number | null>(null)
const selectedTeacherId = ref<number | null>(null)
/** 分配教师弹窗回显用（选中教师不在已加载页时兜底显示） */
const assignInitialLabel = ref<string | undefined>(undefined)

// PagedSelect 回调定义在 script 中：IDE 对模板内联 TS 注解支持不佳（报 TS1005/TS2693 等误报）
const fetchTeachersPage = (page: number, pageSize: number) => fetchTeachers(page, pageSize)

const teacherLabel = (tch: Teacher) =>
  `${tch.name}（${tch.teacherNo}）${tch.title ? ` · ${tch.title}` : ''}`

const teacherValue = (tch: Teacher) => tch.id

function onTeacherChange(value: string | number | null | Array<string | number>) {
  selectedTeacherId.value = value as number | null
}

async function openAssignTeacher(cls: SelectionClass) {
  editingClassId.value = cls.classId
  selectedTeacherId.value = cls.teacherId
  assignInitialLabel.value = cls.teacherName ?? undefined
  showTeacherModal.value = true
}

function handleSaveTeacher() {
  if (editingClassId.value == null) return
  const classId = editingClassId.value
  const target = classes.value.find((c) => c.classId === classId)
  if (target && selectedTeacherId.value === target.teacherId) {
    showTeacherModal.value = false
    return
  }
  return withSavingTeacher(async () => {
    try {
      const res = await assignClassTeacher(campaignId.value, classId, selectedTeacherId.value)
      const idx = classes.value.findIndex((c) => c.classId === classId)
      if (idx >= 0) {
        classes.value[idx] = res.data
      }
      message.success(t('selection.assignTeacherSuccess'))
      showTeacherModal.value = false
    } catch (e) {
      if (!isReportedError(e))
        message.error((e as Error).message || t('selection.assignTeacherFail'))
    }
  })
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
    if (!isReportedError(e)) message.error((e as Error).message || t('selection.assignTeacherFail'))
  }
}

// 首屏加载在 setup 内同步发起(而非等 onMounted):保证首帧渲染时 loading 已为 true,
// 空状态不会在「首帧闪现 → 加载开始消失 → 加载结束复现」之间抖动造成闪屏
void loadAll()
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
          <NDescriptionsItem :label="$t('selection.allowedGrades')">
            {{ allowedGradeNames || '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.allowedMajors')">
            {{ allowedMajorNames || '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('selection.timeRestrictions')">
            {{ restrictionNames || '-' }}
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
        <NAlert v-if="campaign && campaign.status !== 'FINALIZED'" type="info" :show-icon="false">
          {{ $t('selection.noClassResults') }}
        </NAlert>
        <NEmpty
          v-else-if="!loading && classes.length === 0"
          :description="$t('selection.noStudentsSelected')"
        />
        <NCollapse v-else-if="classes.length > 0" arrow-placement="left">
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
              :row-key="memberRowKey"
              :single-line="false"
              :bordered="false"
              size="small"
            />
          </NCollapseItem>
        </NCollapse>
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
            :fetch-page="fetchTeachersPage"
            :label-of="teacherLabel"
            :value-of="teacherValue"
            :initial-label="assignInitialLabel"
            :placeholder="$t('selection.teacherPlaceholder')"
            clearable
            @update:model-value="onTeacherChange"
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
