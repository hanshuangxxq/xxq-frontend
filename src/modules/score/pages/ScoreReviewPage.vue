<script setup lang="ts">
import { ref, computed, h, reactive, onMounted, type VNode } from 'vue'
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
  NTag,
  NSpin,
  NEmpty,
  NPopconfirm,
  NRadioGroup,
  NRadio,
  NDrawer,
  NDrawerContent,
  NDescriptions,
  NDescriptionsItem,
  NTimeline,
  NTimelineItem,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import StatCard from '@/shared/components/StatCard.vue'
import { fetchAllPages } from '@/shared/pagination'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import {
  applyReview,
  fetchMyReviews,
  fetchMyScores,
  fetchReviewTodos,
  replyReview,
  escalateReview,
  resolveReview,
} from '../api'
import type { ReviewView, ReviewStatus, ReviewStatusCode } from '../types'
import { statusTagType, formatDateTime } from '../utils'

const { t } = useI18n()
const message = useMessage()
const { isStudent, isTeacher, isAcademicAdmin } = useRoleCheck()

const loading = ref(false)
const reviews = ref<ReviewView[]>([])
const statusFilter = ref<ReviewStatusCode | null>(null)
/** 列表本地分页（状态计数带需全集，故分块拉全量后客户端分页） */
const reviewPagination = reactive({
  pageSize: 20,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
})

const STATUS_CODE_MAP: Record<ReviewStatus, ReviewStatusCode> = {
  待教师处理: 'PENDING',
  教师已回复: 'TEACHER_REPLIED',
  已升级教务: 'ESCALATED',
  已解决: 'RESOLVED',
  已驳回: 'REJECTED',
}

function statusCode(s: ReviewStatus): ReviewStatusCode {
  return STATUS_CODE_MAP[s] ?? 'PENDING'
}

const statusOptions = computed(() => [
  { label: t('score.statusPending'), value: 'PENDING' as ReviewStatusCode },
  { label: t('score.statusTeacherReplied'), value: 'TEACHER_REPLIED' as ReviewStatusCode },
  { label: t('score.statusEscalated'), value: 'ESCALATED' as ReviewStatusCode },
  { label: t('score.statusResolved'), value: 'RESOLVED' as ReviewStatusCode },
  { label: t('score.statusRejected'), value: 'REJECTED' as ReviewStatusCode },
])

const statusCards = computed(() => [
  {
    code: 'PENDING' as ReviewStatusCode,
    label: t('score.statusPending'),
    tone: 'warning' as const,
  },
  {
    code: 'TEACHER_REPLIED' as ReviewStatusCode,
    label: t('score.statusTeacherReplied'),
    tone: 'primary' as const,
  },
  {
    code: 'ESCALATED' as ReviewStatusCode,
    label: t('score.statusEscalated'),
    tone: 'default' as const,
  },
  {
    code: 'RESOLVED' as ReviewStatusCode,
    label: t('score.statusResolved'),
    tone: 'success' as const,
  },
  {
    code: 'REJECTED' as ReviewStatusCode,
    label: t('score.statusRejected'),
    tone: 'error' as const,
  },
])

function countOf(code: ReviewStatusCode): number {
  return reviews.value.filter((r) => statusCode(r.status) === code).length
}

const filteredReviews = computed(() => {
  if (statusFilter.value == null) return reviews.value
  return reviews.value.filter((r) => statusCode(r.status) === statusFilter.value)
})

function toggleStatusFilter(code: ReviewStatusCode) {
  statusFilter.value = statusFilter.value === code ? null : code
}

async function loadData() {
  loading.value = true
  try {
    if (isStudent.value) {
      const res = await fetchMyReviews()
      reviews.value = res.data
    } else {
      // 统计带计数需全集，故分块拉全量后客户端分页
      reviews.value = await fetchAllPages((page, pageSize) =>
        fetchReviewTodos(undefined, page, pageSize),
      )
    }
  } catch (e) {
    message.error((e as Error).message || t('score.rvLoadFail'))
    reviews.value = []
  } finally {
    loading.value = false
  }
}

// ---- 详情抽屉 ----
const showDrawer = ref(false)
const selected = ref<ReviewView | null>(null)

function openDetail(row: ReviewView) {
  selected.value = row
  showDrawer.value = true
}

function syncSelected() {
  if (selected.value == null) return
  const fresh = reviews.value.find((r) => r.id === selected.value!.id)
  if (fresh) selected.value = fresh
}

// ---- 学生：申请复核 ----
const myScoreOptions = ref<Array<{ label: string; value: number }>>([])
const showApply = ref(false)
const applyScoreId = ref<number | null>(null)
const applyReason = ref('')
const applySaving = ref(false)

async function loadMyScores() {
  try {
    const res = await fetchMyScores()
    myScoreOptions.value = res.data.map((s) => ({
      label: `${s.courseName} - ${t('score.myTotalScore')}${s.totalScore}（${s.scoreLevel}）`,
      value: s.id,
    }))
  } catch {
    // 非阻塞
  }
}

function openApply() {
  applyScoreId.value = null
  applyReason.value = ''
  showApply.value = true
}

async function handleApply() {
  if (applyScoreId.value == null) {
    message.warning(t('score.rvSelectScorePlaceholder'))
    return
  }
  if (!applyReason.value.trim()) {
    message.warning(t('score.rvReasonRequired'))
    return
  }
  applySaving.value = true
  try {
    await applyReview({ scoreId: applyScoreId.value, reason: applyReason.value.trim() })
    message.success(t('score.rvSaveSuccess'))
    showApply.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('score.rvSaveFail'))
  } finally {
    applySaving.value = false
  }
}

async function handleEscalate(row: ReviewView) {
  try {
    await escalateReview(row.id)
    message.success(t('score.rvEscalateSuccess'))
    await loadData()
    syncSelected()
  } catch (e) {
    message.error((e as Error).message || t('score.rvSaveFail'))
  }
}

// ---- 教师：回复 ----
const showReply = ref(false)
const replyTarget = ref<ReviewView | null>(null)
const replyText = ref('')
const replyNewScore = ref<number | null>(null)
const replySaving = ref(false)

function openReply(row: ReviewView) {
  replyTarget.value = row
  replyText.value = ''
  replyNewScore.value = null
  showReply.value = true
}

async function handleReply() {
  if (replyTarget.value == null) return
  if (!replyText.value.trim()) {
    message.warning(t('score.rvReplyRequired'))
    return
  }
  replySaving.value = true
  try {
    await replyReview(replyTarget.value.id, {
      reply: replyText.value.trim(),
      newTotalScore: replyNewScore.value,
    })
    message.success(t('score.rvSaveSuccess'))
    showReply.value = false
    await loadData()
    syncSelected()
  } catch (e) {
    message.error((e as Error).message || t('score.rvSaveFail'))
  } finally {
    replySaving.value = false
  }
}

// ---- 教务：终审 ----
const showResolve = ref(false)
const resolveTarget = ref<ReviewView | null>(null)
const resolveText = ref('')
const resolveNewScore = ref<number | null>(null)
const resolveResolved = ref<boolean>(true)
const resolveSaving = ref(false)

function openResolve(row: ReviewView) {
  resolveTarget.value = row
  resolveText.value = ''
  resolveNewScore.value = null
  resolveResolved.value = true
  showResolve.value = true
}

async function handleResolve() {
  if (resolveTarget.value == null) return
  if (!resolveText.value.trim()) {
    message.warning(t('score.rvReplyRequired'))
    return
  }
  resolveSaving.value = true
  try {
    await resolveReview(resolveTarget.value.id, {
      reply: resolveText.value.trim(),
      newTotalScore: resolveNewScore.value,
      resolved: resolveResolved.value,
    })
    message.success(t('score.rvSaveSuccess'))
    showResolve.value = false
    await loadData()
    syncSelected()
  } catch (e) {
    message.error((e as Error).message || t('score.rvSaveFail'))
  } finally {
    resolveSaving.value = false
  }
}

const columns = computed<DataTableColumns<ReviewView>>(() => {
  const cols: DataTableColumns<ReviewView> = []
  if (!isStudent.value) {
    cols.push({
      title: t('score.rvStudent'),
      key: 'studentName',
      width: 120,
      render: (r) => `${r.studentName}（${r.studentNo}）`,
    })
  }
  cols.push({
    title: t('score.rvCourse'),
    key: 'courseName',
    width: 150,
    ellipsis: { tooltip: true },
  })
  if (!isStudent.value) {
    cols.push({ title: t('score.rvTeacher'), key: 'teacherName', width: 100 })
  }
  cols.push({
    title: t('score.rvCurrentScore'),
    key: 'currentTotalScore',
    width: 90,
    align: 'center',
  })
  cols.push({
    title: t('score.rvReason'),
    key: 'reason',
    minWidth: 160,
    ellipsis: { tooltip: true },
  })
  if (isAcademicAdmin.value) {
    cols.push({
      title: t('score.rvAdminReply'),
      key: 'adminReply',
      width: 150,
      ellipsis: { tooltip: true },
      render: (r) => r.adminReply || '-',
    })
  }
  cols.push({
    title: t('score.rvStatus'),
    key: 'status',
    width: 110,
    align: 'center',
    render: (r) =>
      h(NTag, { type: statusTagType(r.status), size: 'small', bordered: false }, () => r.status),
  })
  cols.push({
    title: t('score.rvApplyTime'),
    key: 'createTime',
    width: 150,
    render: (r) => formatDateTime(r.createTime),
  })
  cols.push({
    title: t('score.rvActions'),
    key: 'actions',
    width: 120,
    fixed: 'right',
    render: (row) => {
      const btns: VNode[] = []
      if (isStudent.value && row.status === '教师已回复') {
        btns.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleEscalate(row) },
            {
              default: () => t('score.rvEscalateConfirm'),
              trigger: () =>
                h(
                  NButton,
                  {
                    size: 'small',
                    type: 'warning',
                    onClick: (e: MouseEvent) => e.stopPropagation(),
                  },
                  () => t('score.rvEscalate'),
                ),
            },
          ),
        )
      }
      if (isTeacher.value && (row.status === '待教师处理' || row.status === '教师已回复')) {
        btns.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'primary',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                openReply(row)
              },
            },
            () => t('score.rvReply'),
          ),
        )
      }
      if (isAcademicAdmin.value && row.status === '已升级教务') {
        btns.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'primary',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                openResolve(row)
              },
            },
            () => t('score.rvResolve'),
          ),
        )
      }
      if (btns.length === 0) {
        return h(NButton, { size: 'small', tertiary: true, onClick: () => openDetail(row) }, () =>
          t('score.rvViewDetail'),
        )
      }
      return h(NSpace, { size: 8 }, () => btns)
    },
  })
  return cols
})

const rowProps = (row: ReviewView) => ({
  style: 'cursor: pointer;',
  onClick: () => openDetail(row),
})

onMounted(() => {
  if (isAcademicAdmin.value) statusFilter.value = 'ESCALATED'
  if (isStudent.value) loadMyScores()
  loadData()
})
</script>

<template>
  <div class="score-rv-page">
    <NSpace vertical :size="16">
      <!-- 状态统计带（可点击筛选） -->
      <div class="stat-band">
        <div
          v-for="card in statusCards"
          :key="card.code"
          class="stat-clickable"
          :class="{ active: statusFilter === card.code }"
          @click="toggleStatusFilter(card.code)"
        >
          <StatCard :label="card.label" :value="countOf(card.code)" :tone="card.tone" />
        </div>
      </div>

      <NCard :title="$t('score.rvTitle')">
        <template #header-extra>
          <NSpace align="center" :size="12">
            <NSelect
              v-model:value="statusFilter"
              :options="statusOptions"
              :placeholder="$t('score.rvStatusAll')"
              clearable
              style="width: 180px"
            />
            <NButton type="primary" @click="loadData">{{ $t('score.statQuery') }}</NButton>
            <NButton v-if="isStudent" type="primary" @click="openApply">
              {{ $t('score.rvApply') }}
            </NButton>
          </NSpace>
        </template>
        <div class="filter-hint">{{ $t('score.rvClickFilter') }}</div>
        <NSpin :show="loading">
          <NEmpty
            v-if="!loading && filteredReviews.length === 0"
            :description="$t('score.rvEmpty')"
          />
          <NDataTable
            v-else
            :columns="columns"
            :data="filteredReviews"
            :row-key="(r: ReviewView) => r.id"
            :row-props="rowProps"
            :single-line="false"
            :bordered="false"
            :scroll-x="1100"
            :pagination="reviewPagination"
          />
        </NSpin>
      </NCard>
    </NSpace>

    <!-- 详情抽屉 -->
    <NDrawer v-model:show="showDrawer" :width="480" placement="right">
      <NDrawerContent v-if="selected" :title="$t('score.rvDetailTitle')" closable>
        <NDescriptions label-placement="left" bordered :column="1" size="small" class="rv-desc">
          <NDescriptionsItem v-if="!isStudent" :label="$t('score.rvStudent')">
            {{ selected.studentName }}（{{ selected.studentNo }}）
          </NDescriptionsItem>
          <NDescriptionsItem :label="$t('score.rvCourse')">{{
            selected.courseName
          }}</NDescriptionsItem>
          <NDescriptionsItem :label="$t('score.rvTeacher')">{{
            selected.teacherName
          }}</NDescriptionsItem>
          <NDescriptionsItem :label="$t('score.rvCurrentScore')">{{
            selected.currentTotalScore
          }}</NDescriptionsItem>
          <NDescriptionsItem :label="$t('score.rvStatus')">
            <NTag :type="statusTagType(selected.status)" size="small" :bordered="false">
              {{ selected.status }}
            </NTag>
          </NDescriptionsItem>
        </NDescriptions>

        <div class="rv-timeline">
          <NTimeline>
            <NTimelineItem
              type="default"
              :title="$t('score.rvTimelineApply')"
              :time="formatDateTime(selected.createTime)"
            >
              {{ selected.reason }}
            </NTimelineItem>
            <NTimelineItem
              v-if="selected.teacherReply"
              type="success"
              :title="$t('score.rvTimelineTeacher')"
            >
              {{ selected.teacherReply }}
            </NTimelineItem>
            <NTimelineItem
              v-if="selected.escalateTime"
              type="warning"
              :title="$t('score.rvTimelineEscalate')"
              :time="formatDateTime(selected.escalateTime)"
            />
            <NTimelineItem
              v-if="selected.resolvedTime"
              :type="selected.status === '已解决' ? 'success' : 'error'"
              :title="$t('score.rvTimelineResolve')"
              :time="formatDateTime(selected.resolvedTime)"
            >
              {{ selected.adminReply || $t('score.rvNoContent') }}
            </NTimelineItem>
          </NTimeline>
        </div>

        <template #footer>
          <NSpace :size="12">
            <NPopconfirm
              v-if="isStudent && selected.status === '教师已回复'"
              @positive-click="handleEscalate(selected)"
            >
              <template #trigger>
                <NButton type="warning">{{ $t('score.rvEscalate') }}</NButton>
              </template>
              {{ $t('score.rvEscalateConfirm') }}
            </NPopconfirm>
            <NButton
              v-if="
                isTeacher && (selected.status === '待教师处理' || selected.status === '教师已回复')
              "
              type="primary"
              @click="openReply(selected)"
            >
              {{ $t('score.rvReply') }}
            </NButton>
            <NButton
              v-if="isAcademicAdmin && selected.status === '已升级教务'"
              type="primary"
              @click="openResolve(selected)"
            >
              {{ $t('score.rvResolve') }}
            </NButton>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>

    <!-- 申请复核 -->
    <NModal
      v-model:show="showApply"
      preset="card"
      :title="$t('score.rvApplyTitle')"
      class="rv-modal"
    >
      <NForm>
        <NFormItem :label="$t('score.rvSelectScore')" required>
          <NSelect
            v-model:value="applyScoreId"
            :options="myScoreOptions"
            :placeholder="$t('score.rvSelectScorePlaceholder')"
            filterable
          />
        </NFormItem>
        <NFormItem :label="$t('score.rvReason')" required>
          <NInput
            v-model:value="applyReason"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            :placeholder="$t('score.rvReasonPlaceholder')"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showApply = false">{{ $t('score.rvCancel') }}</NButton>
          <NButton type="primary" :loading="applySaving" @click="handleApply">
            {{ $t('score.rvSubmit') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 教师回复 -->
    <NModal
      v-model:show="showReply"
      preset="card"
      :title="$t('score.rvReplyTitle')"
      class="rv-modal"
    >
      <NForm>
        <NFormItem :label="$t('score.rvReply')" required>
          <NInput
            v-model:value="replyText"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            :placeholder="$t('score.rvReplyPlaceholder')"
          />
        </NFormItem>
        <NFormItem :label="$t('score.rvNewTotalScore')">
          <NInputNumber v-model:value="replyNewScore" :min="0" :max="100" style="width: 100%" />
          <template #feedback>{{ $t('score.rvNewTotalScoreHint') }}</template>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showReply = false">{{ $t('score.rvCancel') }}</NButton>
          <NButton type="primary" :loading="replySaving" @click="handleReply">
            {{ $t('score.rvSave') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 教务终审 -->
    <NModal
      v-model:show="showResolve"
      preset="card"
      :title="$t('score.rvResolveTitle')"
      class="rv-modal"
    >
      <NForm>
        <NFormItem :label="$t('score.rvReply')" required>
          <NInput
            v-model:value="resolveText"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            :placeholder="$t('score.rvReplyPlaceholder')"
          />
        </NFormItem>
        <NFormItem :label="$t('score.rvNewTotalScore')">
          <NInputNumber v-model:value="resolveNewScore" :min="0" :max="100" style="width: 100%" />
          <template #feedback>{{ $t('score.rvNewTotalScoreHint') }}</template>
        </NFormItem>
        <NFormItem :label="$t('score.rvResolvedFlag')" required>
          <NRadioGroup v-model:value="resolveResolved">
            <NSpace>
              <NRadio :value="true">{{ $t('score.rvResolvedYes') }}</NRadio>
              <NRadio :value="false">{{ $t('score.rvResolvedNo') }}</NRadio>
            </NSpace>
          </NRadioGroup>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showResolve = false">{{ $t('score.rvCancel') }}</NButton>
          <NButton type="primary" :loading="resolveSaving" @click="handleResolve">
            {{ $t('score.rvSave') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped src="./ScoreReviewPage.css"></style>

<style>
.rv-modal {
  width: 480px;
  max-width: 90vw;
}
</style>
