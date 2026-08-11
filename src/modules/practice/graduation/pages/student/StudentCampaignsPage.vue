<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
  NSpace,
  NTag,
  NResult,
  useMessage,
} from 'naive-ui'
import {
  fetchAvailableCampaigns,
  fetchMyProposals,
  submitProposal,
  fetchMyAssignments,
} from '../../api'
import {
  campaignStatusTagType,
  assignmentSourceTagType,
  formatDateTime,
} from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { CampaignResponse, ProposalResponse, AssignmentResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isStudent } = useRoleCheck()

const campaigns = ref<CampaignResponse[]>([])
const loading = ref(false)
const myProposals = ref<ProposalResponse[]>([])
const myAssignment = ref<AssignmentResponse | null>(null)
const assignmentLoading = ref(false)

/** 选题窗口内才允许进入申报 */
function inTopicWindow(c: CampaignResponse): boolean {
  const now = Date.now()
  return now >= new Date(c.topicStartTime).getTime() && now <= new Date(c.topicEndTime).getTime()
}

function windowState(c: CampaignResponse): string {
  const now = Date.now()
  if (now < new Date(c.topicStartTime).getTime()) return t('graduation.common.topicNotStarted')
  if (now > new Date(c.topicEndTime).getTime()) return t('graduation.common.topicEnded')
  return t('graduation.common.topicOpen')
}

function proposalOf(campaignId: number): ProposalResponse | null {
  return myProposals.value.find((p) => p.campaignId === campaignId) ?? null
}

/** F-R-16：存在进行中申请（待初审/待终审/审批完毕）时隐藏新建入口 */
function hasActiveProposal(campaignId: number): boolean {
  const p = proposalOf(campaignId)
  return !!p && p.status !== '已驳回'
}

async function loadCampaigns(): Promise<void> {
  loading.value = true
  try {
    const res = await fetchAvailableCampaigns()
    campaigns.value = res.data ?? []
    const pRes = await fetchMyProposals()
    myProposals.value = pRes.data ?? []
  } catch {
    /* 已展示错误 */
  } finally {
    loading.value = false
  }
}

// 我的指导关系（对全部可见活动展示，无活动时为空）
async function loadAssignments(): Promise<void> {
  assignmentLoading.value = true
  try {
    const res = await fetchMyAssignments()
    myAssignment.value = res.data?.[0] ?? null
  } catch {
    myAssignment.value = null
  } finally {
    assignmentLoading.value = false
  }
}

// ===== 选题申报弹窗 =====
const showDeclare = ref(false)
const declareCampaign = ref<CampaignResponse | null>(null)
const declareForm = ref({ title: '', content: '' })
const saving = ref(false)

function startDeclare(c: CampaignResponse): void {
  declareCampaign.value = c
  declareForm.value = { title: '', content: '' }
  showDeclare.value = true
}

function startResubmit(c: CampaignResponse): void {
  const p = proposalOf(c.id)
  declareCampaign.value = c
  declareForm.value = { title: p?.title ?? '', content: p?.content ?? '' }
  showDeclare.value = true
}

async function handleSubmitProposal(): Promise<void> {
  if (!declareCampaign.value) return
  const f = declareForm.value
  if (!f.title.trim()) {
    message.warning(t('graduation.student.titleRequired'))
    return
  }
  if (f.content.trim().length < 100) {
    message.warning(t('graduation.common.contentMin100'))
    return
  }
  saving.value = true
  try {
    await submitProposal({
      campaignId: declareCampaign.value.id,
      title: f.title.trim(),
      content: f.content.trim(),
    })
    message.success(t('graduation.common.operationSuccess'))
    showDeclare.value = false
    await loadCampaigns()
    await loadAssignments()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (!isStudent.value) return
  void loadCampaigns()
  void loadAssignments()
})
</script>

<template>
  <div class="graduation-page">
    <NResult
      v-if="!isStudent"
      status="403"
      :title="$t('graduation.common.noPermission')"
      :description="$t('graduation.common.noPermissionDesc')"
    />
    <template v-else>
      <NSpin :show="loading">
        <NEmpty
          v-if="!campaigns.length"
          :description="$t('graduation.student.noAvailableCampaign')"
        />
        <NSpace v-else vertical :size="16">
          <NCard v-for="c in campaigns" :key="c.id" :title="c.name" class="campaign-card">
            <template #header-extra>
              <NTag :type="campaignStatusTagType(c.status)" size="small" :bordered="false">
                {{ c.status }}
              </NTag>
            </template>
            <NSpace vertical :size="8">
              <span class="campaign-row">
                {{ $t('graduation.common.topicWindow') }}： {{ formatDateTime(c.topicStartTime) }} ~
                {{ formatDateTime(c.topicEndTime) }}
              </span>
              <span :class="['campaign-row', 'window-hint']">{{ windowState(c) }}</span>
            </NSpace>
            <template #footer>
              <NSpace justify="end">
                <template v-if="hasActiveProposal(c.id)">
                  <NTag type="info" size="small" :bordered="false">
                    {{ $t('graduation.student.hasActiveProposal') }}
                  </NTag>
                  <NTag
                    v-if="proposalOf(c.id)?.status === '审批完毕'"
                    type="success"
                    size="small"
                    :bordered="false"
                  >
                    {{ proposalOf(c.id)?.status }}
                  </NTag>
                </template>
                <template v-else>
                  <NButton
                    v-if="inTopicWindow(c)"
                    type="primary"
                    @click="proposalOf(c.id) ? startResubmit(c) : startDeclare(c)"
                  >
                    {{
                      proposalOf(c.id)
                        ? $t('graduation.student.resubmitProposal')
                        : $t('graduation.student.goTopic')
                    }}
                  </NButton>
                  <NButton v-else disabled>{{ $t('graduation.student.topicBtnOutside') }}</NButton>
                </template>
              </NSpace>
            </template>
          </NCard>
        </NSpace>
      </NSpin>

      <!-- 我的指导关系（§4.3） -->
      <NCard
        :title="$t('graduation.common.myAssignment')"
        class="assignment-card"
        style="margin-top: 16px"
      >
        <NSpin :show="assignmentLoading">
          <template v-if="myAssignment">
            <NSpace align="center" :size="12">
              <span class="assignment-row">
                {{ $t('graduation.common.teacher') }}：
                <b>{{ myAssignment.teacherName }}</b>
              </span>
              <NTag
                :type="assignmentSourceTagType(myAssignment.source)"
                size="small"
                :bordered="false"
              >
                {{ myAssignment.source }}
              </NTag>
              <span class="assignment-row"
                >{{ $t('graduation.common.assignTime') }}：{{
                  formatDateTime(myAssignment.assignTime)
                }}</span
              >
            </NSpace>
            <NSpace
              v-if="myAssignment.prevTeacherName"
              align="center"
              :size="12"
              style="margin-top: 8px"
            >
              <NTag type="warning" size="small" :bordered="false">
                {{ $t('graduation.common.prevTeacher') }}：{{ myAssignment.prevTeacherName }}
              </NTag>
              <span class="assignment-row">
                {{ $t('graduation.common.reassignReason') }}：{{
                  myAssignment.reassignReason ?? '-'
                }}
              </span>
              <span class="assignment-row">
                {{ $t('graduation.common.reassignTime') }}：{{
                  formatDateTime(myAssignment.reassignTime)
                }}
              </span>
            </NSpace>
          </template>
          <template v-else>
            <span class="assignment-row">{{ $t('graduation.common.notAssigned') }}</span>
          </template>
        </NSpin>
      </NCard>

      <!-- 选题申报弹窗 -->
      <NModal
        v-model:show="showDeclare"
        preset="card"
        :title="
          proposalOf(declareCampaign?.id ?? 0)
            ? $t('graduation.student.resubmitProposal')
            : $t('graduation.student.declareProposal')
        "
        class="graduation-form-modal"
      >
        <NForm label-placement="top">
          <NFormItem :label="$t('graduation.student.proposalTitle')" required>
            <NInput v-model:value="declareForm.title" />
          </NFormItem>
          <NFormItem :label="$t('graduation.common.contentFull')" required>
            <NInput
              v-model:value="declareForm.content"
              type="textarea"
              :autosize="{ minRows: 6, maxRows: 12 }"
            />
          </NFormItem>
          <span class="char-count">
            {{ $t('graduation.student.contentLength', { count: declareForm.content.length }) }}
            <span v-if="declareForm.content.trim().length < 100" class="char-warn">
              {{ $t('graduation.common.contentMin100') }}
            </span>
          </span>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showDeclare = false">{{ $t('graduation.common.cancel') }}</NButton>
            <NButton type="primary" :loading="saving" @click="handleSubmitProposal">
              {{ $t('graduation.common.submit') }}
            </NButton>
          </NSpace>
        </template>
      </NModal>
    </template>
  </div>
</template>

<style scoped src="./StudentCampaignsPage.css"></style>

<style>
.graduation-form-modal {
  width: 620px;
  max-width: 92vw;
}
</style>
