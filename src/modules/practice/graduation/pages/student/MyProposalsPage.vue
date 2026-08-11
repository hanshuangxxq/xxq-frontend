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
  NDivider,
  NTimeline,
  NTimelineItem,
  NResult,
  useMessage,
} from 'naive-ui'
import { fetchMyProposals, submitProposal } from '../../api'
import { proposalStatusTagType, formatDateTime } from '@/modules/practice/utils'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { ProposalResponse } from '../../types'

const { t } = useI18n()
const message = useMessage()
const { isStudent } = useRoleCheck()

const proposals = ref<ProposalResponse[]>([])
const loading = ref(false)

async function loadProposals(): Promise<void> {
  loading.value = true
  try {
    const res = await fetchMyProposals()
    proposals.value = res.data ?? []
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.loadFail'))
  } finally {
    loading.value = false
  }
}

// ===== 修改重提弹窗（F-R-15）=====
const showResubmit = ref(false)
const editingProposal = ref<ProposalResponse | null>(null)
const resubmitForm = ref({ title: '', content: '' })
const saving = ref(false)

function startResubmit(p: ProposalResponse): void {
  editingProposal.value = p
  resubmitForm.value = { title: p.title, content: p.content }
  showResubmit.value = true
}

async function handleResubmit(): Promise<void> {
  if (!editingProposal.value) return
  const f = resubmitForm.value
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
      campaignId: editingProposal.value.campaignId,
      title: f.title.trim(),
      content: f.content.trim(),
    })
    message.success(t('graduation.common.operationSuccess'))
    showResubmit.value = false
    await loadProposals()
  } catch (e) {
    message.error((e as Error).message || t('graduation.common.operationFail'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (isStudent.value) void loadProposals()
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
        <NEmpty v-if="!proposals.length" :description="$t('graduation.student.myProposalEmpty')" />
        <NSpace v-else vertical :size="16">
          <NCard v-for="p in proposals" :key="p.id" class="proposal-card">
            <template #header>
              <NSpace align="center" :size="12">
                <b>{{ p.title }}</b>
                <NTag :type="proposalStatusTagType(p.status)" size="small" :bordered="false">
                  {{ p.status }}
                </NTag>
              </NSpace>
            </template>
            <template #header-extra>
              <span class="proposal-meta"
                >{{ $t('graduation.common.submitTime') }}：{{ formatDateTime(p.submitTime) }}</span
              >
            </template>
            <div class="proposal-content">{{ p.content }}</div>
            <div v-if="p.status === '已驳回' && p.rejectReason" class="reject-reason">
              <b>{{ $t('graduation.common.rejectReasonHighlight') }}：</b>{{ p.rejectReason }}
            </div>
            <template v-if="p.reviews.length">
              <NDivider style="margin: 12px 0" />
              <span class="flow-title">{{ $t('graduation.common.approvalFlow') }}</span>
              <NTimeline style="margin-top: 8px">
                <NTimelineItem
                  v-for="(r, i) in p.reviews"
                  :key="i"
                  :type="r.action === '驳回' ? 'error' : 'success'"
                >
                  <template #header>
                    <NSpace align="center" :size="8">
                      <b>{{ r.stage }}</b>
                      <NTag
                        size="tiny"
                        :type="r.action === '驳回' ? 'error' : 'success'"
                        :bordered="false"
                      >
                        {{ r.action }}
                      </NTag>
                    </NSpace>
                  </template>
                  <span class="flow-line">
                    {{ $t('graduation.common.reviewer') }}：{{ r.reviewerName }} ·
                    {{ formatDateTime(r.reviewTime) }}
                  </span>
                  <div v-if="r.comment" class="flow-comment">{{ r.comment }}</div>
                </NTimelineItem>
              </NTimeline>
            </template>
            <template #footer>
              <NSpace justify="end">
                <NButton v-if="p.status === '已驳回'" type="primary" @click="startResubmit(p)">
                  {{ $t('graduation.student.resubmitProposal') }}
                </NButton>
              </NSpace>
            </template>
          </NCard>
        </NSpace>
      </NSpin>

      <!-- 修改重提弹窗 -->
      <NModal
        v-model:show="showResubmit"
        preset="card"
        :title="$t('graduation.student.resubmitProposal')"
        class="graduation-form-modal"
      >
        <NForm label-placement="top">
          <NFormItem :label="$t('graduation.student.proposalTitle')" required>
            <NInput v-model:value="resubmitForm.title" />
          </NFormItem>
          <NFormItem :label="$t('graduation.common.contentFull')" required>
            <NInput
              v-model:value="resubmitForm.content"
              type="textarea"
              :autosize="{ minRows: 6, maxRows: 12 }"
            />
          </NFormItem>
          <span class="char-count">
            {{ $t('graduation.student.contentLength', { count: resubmitForm.content.length }) }}
            <span v-if="resubmitForm.content.trim().length < 100" class="char-warn">
              {{ $t('graduation.common.contentMin100') }}
            </span>
          </span>
        </NForm>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="showResubmit = false">{{ $t('graduation.common.cancel') }}</NButton>
            <NButton type="primary" :loading="saving" @click="handleResubmit">
              {{ $t('graduation.common.submit') }}
            </NButton>
          </NSpace>
        </template>
      </NModal>
    </template>
  </div>
</template>

<style scoped src="./MyProposalsPage.css"></style>

<style>
.graduation-form-modal {
  width: 620px;
  max-width: 92vw;
}
</style>
