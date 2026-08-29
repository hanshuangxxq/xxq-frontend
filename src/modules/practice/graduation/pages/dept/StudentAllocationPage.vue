<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpin,
  NEmpty,
  NButton,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NResult,
  NTag,
  NSpace,
  NAlert,
  useMessage,
} from 'naive-ui'
import CampaignContextSelector from '../../components/CampaignContextSelector.vue'
import {
  fetchUnassignedStudentIds,
  fetchDashboard,
  allocateStudent,
  reassignStudent,
} from '../../api'
import { fetchTeachers } from '@/modules/curriculum/api'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import { formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { DashboardRow, CampaignResponse } from '../../types'
import type { Teacher } from '@/modules/curriculum/types'

const { t } = useI18n()
const message = useMessage()
const { isDepartment } = useRoleCheck()

const campaignId = ref<number | null>(null)
const topicEndTs = ref<number | null>(null)
const rows = ref<DashboardRow[]>([])
const unassignedIds = ref<number[]>([])
const loading = ref(false)

/** F-R-28：指定分配/改派仅在选题截止后开放 */
const allocationOpen = computed(() => topicEndTs.value != null && Date.now() > topicEndTs.value)

const teacherCounts = computed(() => {
  const map = new Map<number, number>()
  for (const r of rows.value) {
    if (r.teacherId != null) map.set(r.teacherId, (map.get(r.teacherId) ?? 0) + 1)
  }
  return map
})

/** 本院系教师名额现状（姓名 + 已占/上限，F-R-29） */
const teacherChips = computed(() => {
  const chips = new Map<number, { name: string; count: number }>()
  for (const r of rows.value) {
    if (r.teacherId == null || !r.teacherName) continue
    const prev = chips.get(r.teacherId)
    chips.set(r.teacherId, {
      name: r.teacherName,
      count: (prev?.count ?? 0) + 1,
    })
  }
  return [...chips.entries()]
})

const unassignedStudents = computed(() =>
  rows.value.filter((r) => unassignedIds.value.includes(r.studentId)),
)

const assignedStudents = computed(() =>
  rows.value.filter((r) => r.teacherId != null && !unassignedIds.value.includes(r.studentId)),
)

const supervisorCapacity = ref<number | null>(null)

async function loadData(): Promise<void> {
  if (campaignId.value == null) return
  loading.value = true
  try {
    const [dRes, uRes] = await Promise.all([
      fetchDashboard(campaignId.value, { page: 1, pageSize: 100 }),
      fetchUnassignedStudentIds(campaignId.value),
    ])
    rows.value = dRes.data.records
    unassignedIds.value = uRes.data ?? []
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

function onCampaignChange(id: number | null): void {
  campaignId.value = id
  rows.value = []
  unassignedIds.value = []
  supervisorCapacity.value = null
  if (id != null) void loadData()
}

function onCampaign(c: CampaignResponse | null): void {
  topicEndTs.value = c ? new Date(c.topicEndTime).getTime() : null
  supervisorCapacity.value = c?.supervisorCapacity ?? null
}

/** 教师选择器标签：姓名（当前名下数/上限）F-R-29 */
function teacherLabelOf(teacher: Teacher): string {
  const count = teacherCounts.value.get(teacher.userId) ?? 0
  return `${teacher.name}（${count}/${supervisorCapacity.value ?? '-'}）`
}

const fetchTeachersPage = (page: number, pageSize: number) => fetchTeachers(page, pageSize)
const teacherValueOf = (tch: Teacher) => tch.userId

// ===== 指定分配弹窗 =====
const showAllocate = ref(false)
const allocating = ref<DashboardRow | null>(null)
const allocateTeacherId = ref<number | null>(null)
const allocateTeacherLabel = ref<string | undefined>(undefined)
const savingAllocate = ref(false)

function onAllocateTeacherChange(v: string | number | null | Array<string | number>): void {
  allocateTeacherId.value = v as number | null
}

function startAllocate(row: DashboardRow): void {
  allocating.value = row
  allocateTeacherId.value = null
  allocateTeacherLabel.value = undefined
  showAllocate.value = true
}

async function handleAllocate(): Promise<void> {
  if (!allocating.value || campaignId.value == null) return
  if (allocateTeacherId.value == null) {
    message.warning(t('graduation.dept.chooseTeacher'))
    return
  }
  savingAllocate.value = true
  try {
    await allocateStudent({
      campaignId: campaignId.value,
      studentId: allocating.value.studentId,
      teacherId: allocateTeacherId.value,
    })
    message.success(t('graduation.common.operationSuccess'))
    showAllocate.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
    // 409（名额满/已被选择）后刷新
    await loadData()
  } finally {
    savingAllocate.value = false
  }
}

// ===== 改派弹窗 =====
const showReassign = ref(false)
const reassigning = ref<DashboardRow | null>(null)
const newTeacherId = ref<number | null>(null)
const newTeacherLabel = ref<string | undefined>(undefined)
const reassignReason = ref('')
const savingReassign = ref(false)

function onNewTeacherChange(v: string | number | null | Array<string | number>): void {
  newTeacherId.value = v as number | null
}

function startReassign(row: DashboardRow): void {
  reassigning.value = row
  newTeacherId.value = null
  newTeacherLabel.value = undefined
  reassignReason.value = ''
  showReassign.value = true
}

/** 最近一次改派留痕（F-R-30：展示原教师、原因、时间） */
const lastReassign = ref<{
  studentName: string
  newTeacherName: string
  prevTeacherName: string | null
  reason: string | null
  time: string | null
} | null>(null)

async function handleReassign(): Promise<void> {
  if (!reassigning.value || campaignId.value == null) return
  if (newTeacherId.value == null) {
    message.warning(t('graduation.dept.chooseTeacher'))
    return
  }
  if (newTeacherId.value === reassigning.value.teacherId) {
    message.warning(t('graduation.dept.sameTeacherError'))
    return
  }
  if (!reassignReason.value.trim()) {
    message.warning(t('graduation.dept.reassignReasonRequired'))
    return
  }
  savingReassign.value = true
  try {
    const res = await reassignStudent({
      campaignId: campaignId.value,
      studentId: reassigning.value.studentId,
      newTeacherId: newTeacherId.value,
      reason: reassignReason.value.trim(),
    })
    const a = res.data
    lastReassign.value = {
      studentName: a?.studentName ?? reassigning.value.studentName,
      newTeacherName: a?.teacherName ?? '',
      prevTeacherName: a?.prevTeacherName ?? null,
      reason: a?.reassignReason ?? null,
      time: a?.reassignTime ?? null,
    }
    message.success(t('graduation.common.operationSuccess'))
    showReassign.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
    await loadData()
  } finally {
    savingReassign.value = false
  }
}
</script>

<template>
  <div class="graduation-page">
    <NResult
      v-if="!isDepartment"
      status="403"
      :title="$t('graduation.common.noPermission')"
      :description="$t('graduation.common.noPermissionDesc')"
    />
    <template v-else>
      <NCard class="context-card">
        <NSpace align="center" :size="16">
          <CampaignContextSelector
            v-model:campaign-id="campaignId"
            @update:campaign-id="onCampaignChange"
            @update:campaign="onCampaign"
          />
          <NTag v-if="!allocationOpen" type="warning" size="small" :bordered="false">
            {{ $t('graduation.dept.allocateHint') }}
          </NTag>
        </NSpace>
      </NCard>

      <!-- 最近改派留痕（F-R-30） -->
      <NAlert
        v-if="lastReassign"
        type="success"
        show-icon
        closable
        class="reassign-trace"
        :title="$t('graduation.dept.reassignTrace')"
        @close="lastReassign = null"
      >
        {{ lastReassign.studentName }} → {{ lastReassign.newTeacherName }}
        <span v-if="lastReassign.prevTeacherName">
          · {{ $t('graduation.common.prevTeacher') }}：{{ lastReassign.prevTeacherName }}
        </span>
        <span v-if="lastReassign.reason">
          · {{ $t('graduation.common.reassignReason') }}：{{ lastReassign.reason }}
        </span>
        <span v-if="lastReassign.time">
          · {{ $t('graduation.common.reassignTime') }}：{{ formatDateTime(lastReassign.time) }}
        </span>
      </NAlert>

      <NCard :title="$t('graduation.dept.unassignedList')" class="content-card">
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && !unassignedStudents.length"
            :description="$t('graduation.common.empty')"
          />
          <div v-else class="student-row-list">
            <div v-for="r in unassignedStudents" :key="r.studentId" class="student-row">
              <NSpace align="center" :size="12" style="flex: 1; min-width: 0">
                <span class="row-main">{{ r.studentNo }} {{ r.studentName }}</span>
                <span class="row-sub">{{ r.className }}</span>
                <span class="row-sub ellipsis">{{ r.proposalTitle ?? '-' }}</span>
              </NSpace>
              <NButton
                size="small"
                type="primary"
                :disabled="!allocationOpen"
                @click="startAllocate(r)"
              >
                {{ $t('graduation.dept.allocate') }}
              </NButton>
            </div>
          </div>
        </NSpin>
      </NCard>

      <NCard
        :title="$t('graduation.dept.deptTeachers')"
        class="content-card"
        style="margin-top: 16px"
      >
        <NSpin :show="loading">
          <div class="teacher-strip">
            <template v-if="teacherChips.length">
              <span v-for="[tid, info] in teacherChips" :key="tid" class="teacher-chip">
                {{ info.name }}：{{ info.count }}/{{ supervisorCapacity ?? '-' }}
              </span>
            </template>
            <span v-else class="row-sub">{{ $t('graduation.common.noData') }}</span>
          </div>
          <NEmpty
            v-if="!loading && !assignedStudents.length"
            :description="$t('graduation.common.empty')"
          />
          <div v-else class="student-row-list" style="margin-top: 12px">
            <div v-for="r in assignedStudents" :key="r.studentId" class="student-row">
              <NSpace align="center" :size="12" style="flex: 1; min-width: 0">
                <span class="row-main">{{ r.studentNo }} {{ r.studentName }}</span>
                <span class="row-sub"
                  >{{ $t('graduation.common.teacher') }}：{{ r.teacherName }}</span
                >
                <NTag v-if="r.assignmentSource" size="small" :bordered="false">
                  {{ r.assignmentSource }}
                </NTag>
              </NSpace>
              <NButton size="small" :disabled="!allocationOpen" @click="startReassign(r)">
                {{ $t('graduation.dept.reassign') }}
              </NButton>
            </div>
          </div>
        </NSpin>
      </NCard>

      <!-- 指定分配弹窗 -->
      <NModal
        v-model:show="showAllocate"
        preset="card"
        :title="`${$t('graduation.dept.allocate')} - ${allocating?.studentName ?? ''}`"
        class="graduation-form-modal"
      >
        <NForm label-placement="top">
          <NFormItem :label="$t('graduation.common.teacher')" required>
            <PagedSelect
              :model-value="allocateTeacherId"
              :fetch-page="fetchTeachersPage"
              :label-of="teacherLabelOf"
              :value-of="teacherValueOf"
              :initial-label="allocateTeacherLabel"
              filterable
              @update:model-value="onAllocateTeacherChange"
            />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showAllocate = false">{{ $t('graduation.common.cancel') }}</NButton>
            <NButton type="primary" :loading="savingAllocate" @click="handleAllocate">
              {{ $t('graduation.common.confirm') }}
            </NButton>
          </NSpace>
        </template>
      </NModal>

      <!-- 改派弹窗 -->
      <NModal
        v-model:show="showReassign"
        preset="card"
        :title="`${$t('graduation.dept.reassign')} - ${reassigning?.studentName ?? ''}`"
        class="graduation-form-modal"
      >
        <NForm label-placement="top">
          <NFormItem :label="$t('graduation.dept.reassignNewTeacher')" required>
            <PagedSelect
              :model-value="newTeacherId"
              :fetch-page="fetchTeachersPage"
              :label-of="teacherLabelOf"
              :value-of="teacherValueOf"
              :initial-label="newTeacherLabel"
              filterable
              @update:model-value="onNewTeacherChange"
            />
          </NFormItem>
          <NFormItem :label="$t('graduation.dept.reassignReasonField')" required>
            <NInput
              v-model:value="reassignReason"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showReassign = false">{{ $t('graduation.common.cancel') }}</NButton>
            <NButton type="primary" :loading="savingReassign" @click="handleReassign">
              {{ $t('graduation.common.confirm') }}
            </NButton>
          </NSpace>
        </template>
      </NModal>
    </template>
  </div>
</template>

<style scoped src="./StudentAllocationPage.css"></style>

<style>
.graduation-form-modal {
  width: 560px;
  max-width: 92vw;
}
</style>
