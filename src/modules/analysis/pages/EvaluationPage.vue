<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NTabs,
  NTabPane,
  NSelect,
  NDataTable,
  NSpin,
  NEmpty,
  NButton,
  NInput,
  NRate,
  NInputNumber,
  NForm,
  NFormItem,
  NTag,
  NSpace,
  NDescriptions,
  NDescriptionsItem,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  submitEvaluation,
  fetchMyEvaluations,
  fetchEvaluationPeriod,
  openEvaluationPeriod,
  closeEvaluationPeriod,
  fetchEvaluationForm,
} from '../api'
import { fetchTeachInfoList } from '@/modules/curriculum/api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import type { TeachInfo } from '@/modules/curriculum/types'
import type { TeachingEvaluationView, EvaluationStatusDto, EvaluationFormItem } from '../types'
import { formatDateTime } from '../utils'
import EvaluationItemsManager from './EvaluationItemsManager.vue'
import EvaluationTemplatesManager from './EvaluationTemplatesManager.vue'
import EvaluationOverrideManager from './EvaluationOverrideManager.vue'

const { t } = useI18n()
const message = useMessage()
const { isStudent, isAcademicAdmin } = useRoleCheck()

const adminTab = ref<'items' | 'templates' | 'period' | 'override'>('items')
const studentTab = ref<'submit' | 'my'>('submit')

// ---- 评教周期 ----
const periodLoading = ref(false)
const period = ref<EvaluationStatusDto | null>(null)
const periodActionLoading = ref(false)

async function loadPeriod() {
  periodLoading.value = true
  try {
    const res = await fetchEvaluationPeriod()
    period.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('analysis.evLoadFail'))
    period.value = null
  } finally {
    periodLoading.value = false
  }
}

async function handleOpenPeriod() {
  periodActionLoading.value = true
  try {
    const res = await openEvaluationPeriod()
    period.value = res.data
    message.success(t('analysis.evOpenSuccess'))
  } catch (e) {
    message.error((e as Error).message || t('analysis.evOpenFail'))
  } finally {
    periodActionLoading.value = false
  }
}

async function handleClosePeriod() {
  periodActionLoading.value = true
  try {
    const res = await closeEvaluationPeriod()
    period.value = res.data
    message.success(t('analysis.evCloseSuccess'))
  } catch (e) {
    message.error((e as Error).message || t('analysis.evCloseFail'))
  } finally {
    periodActionLoading.value = false
  }
}

const periodOpen = computed(() => period.value?.open === true)

// ---- 学生：课程选项 ----
const courseOptions = ref<Array<{ label: string; value: number }>>([])
const selectedTeachInfoId = ref<number | null>(null)

async function loadCourses() {
  try {
    const res = await fetchTeachInfoList()
    courseOptions.value = res.data.courses
      .filter((c: TeachInfo) => c.id != null)
      .map((c: TeachInfo) => {
        // 解耦后各类课程 courseName 均由 course 表填充（公选课亦然）
        const name = c.courseName
        return {
          label: c.teacherName ? `${name} - ${c.teacherName}` : name,
          value: c.id as number,
        }
      })
  } catch {
    // 非阻塞
  }
}

// ---- 学生：动态评教表单 ----
interface FormRow extends EvaluationFormItem {
  score: number
}

const formLoading = ref(false)
const formRows = ref<FormRow[]>([])
const currentTemplateName = ref('')
const comment = ref('')
const submitting = ref(false)

async function loadForm(teachInfoId: number) {
  formLoading.value = true
  formRows.value = []
  currentTemplateName.value = ''
  try {
    const res = await fetchEvaluationForm(teachInfoId)
    currentTemplateName.value = res.data.templateName
    formRows.value = res.data.items
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((it) => ({ ...it, score: it.required === 1 ? it.maxScore : 0 }))
  } catch {
    // 错误提示由请求封装统一处理（如「暂未配置评教模板」）
    formRows.value = []
  } finally {
    formLoading.value = false
  }
}

function handleCourseChange(id: number | null) {
  selectedTeachInfoId.value = id
  if (id != null) {
    loadForm(id)
  } else {
    formRows.value = []
    currentTemplateName.value = ''
  }
}

async function handleSubmit() {
  if (selectedTeachInfoId.value == null) {
    message.warning(t('analysis.evSelectCourseFirst'))
    return
  }
  for (const it of formRows.value) {
    if (it.required === 1 && (it.score < 1 || it.score > it.maxScore)) {
      message.warning(t('analysis.evScoreRequired'))
      return
    }
  }
  submitting.value = true
  try {
    const scores: { itemId: number; score: number }[] = []
    for (const it of formRows.value) {
      if (it.score >= 1) {
        scores.push({ itemId: it.itemId, score: it.score })
      }
    }
    await submitEvaluation({
      teachInfoId: selectedTeachInfoId.value,
      scores,
      comment: comment.value.trim() || undefined,
    })
    message.success(t('analysis.evSubmitSuccess'))
    selectedTeachInfoId.value = null
    formRows.value = []
    currentTemplateName.value = ''
    comment.value = ''
    await loadMyEvaluations()
    studentTab.value = 'my'
  } catch (e) {
    message.error((e as Error).message || t('analysis.evSubmitFail'))
  } finally {
    submitting.value = false
  }
}

// ---- 学生：我的评教 ----
const myLoading = ref(false)
const myEvaluations = ref<TeachingEvaluationView[]>([])

async function loadMyEvaluations() {
  myLoading.value = true
  try {
    const res = await fetchMyEvaluations()
    myEvaluations.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('analysis.evLoadFail'))
    myEvaluations.value = []
  } finally {
    myLoading.value = false
  }
}

const myEvaluationRowKey = (row: TeachingEvaluationView) => row.id

const myColumns = computed<DataTableColumns<TeachingEvaluationView>>(() => [
  {
    title: t('analysis.evCourseName'),
    key: 'courseName',
    minWidth: 150,
    ellipsis: { tooltip: true },
  },
  { title: t('analysis.evTeacherName'), key: 'teacherName', width: 90 },
  { title: t('analysis.evSemester'), key: 'semesterName', width: 130, ellipsis: { tooltip: true } },
  {
    title: t('analysis.evTemplate'),
    key: 'templateName',
    width: 140,
    ellipsis: { tooltip: true },
  },
  {
    title: t('analysis.evItemsDetail'),
    key: 'items',
    minWidth: 240,
    render: (r) =>
      h(
        NSpace,
        { size: 4, wrap: true },
        {
          default: () =>
            r.items.map((it) =>
              h(
                NTag,
                { size: 'small', bordered: false, type: 'info' },
                () => `${it.itemName} ${it.score}/${it.maxScore}`,
              ),
            ),
        },
      ),
  },
  {
    title: t('analysis.evAvgScore'),
    key: 'avgScore',
    width: 80,
    align: 'center',
    render: (r) => h(NTag, { type: 'success', size: 'small', bordered: false }, () => r.avgScore),
  },
  {
    title: t('analysis.evComment'),
    key: 'comment',
    minWidth: 160,
    ellipsis: { tooltip: true },
    render: (r) => r.comment || '-',
  },
  {
    title: t('analysis.evCreateTime'),
    key: 'createTime',
    width: 150,
    align: 'center',
    render: (r) => formatDateTime(r.createTime),
  },
])

onMounted(() => {
  loadPeriod()
  if (isStudent.value) {
    loadCourses()
    loadMyEvaluations()
  }
})
</script>

<template>
  <div class="analysis-evaluation-page">
    <!-- 教务：指标库 / 模板 / 周期 / 课程覆盖 -->
    <NTabs v-if="isAcademicAdmin" v-model:value="adminTab" type="line" animated>
      <NTabPane name="items" :tab="$t('analysis.evItems')">
        <EvaluationItemsManager />
      </NTabPane>
      <NTabPane name="templates" :tab="$t('analysis.evTemplates')">
        <EvaluationTemplatesManager />
      </NTabPane>
      <NTabPane name="period" :tab="$t('analysis.evPeriodTitle')">
        <NCard>
          <NSpin :show="periodLoading">
            <template v-if="period">
              <NDescriptions :column="2" label-placement="left" bordered>
                <NDescriptionsItem :label="$t('analysis.evPeriodStatus')">
                  <NTag :type="periodOpen ? 'success' : 'warning'" size="small" :bordered="false">
                    {{ periodOpen ? $t('analysis.evPeriodOpen') : $t('analysis.evPeriodClosed') }}
                  </NTag>
                </NDescriptionsItem>
                <NDescriptionsItem :label="$t('analysis.evSemester')">
                  {{ period.semesterName || '-' }}
                </NDescriptionsItem>
                <NDescriptionsItem :label="$t('analysis.evPeriodOpenTime')">
                  {{ formatDateTime(period.openTime) }}
                </NDescriptionsItem>
                <NDescriptionsItem :label="$t('analysis.evPeriodCloseTime')">
                  {{ formatDateTime(period.closeTime) }}
                </NDescriptionsItem>
              </NDescriptions>
              <div class="period-actions">
                <NButton
                  type="primary"
                  :disabled="periodOpen"
                  :loading="periodActionLoading"
                  @click="handleOpenPeriod"
                >
                  {{ $t('analysis.evOpenBtn') }}
                </NButton>
                <NButton
                  type="error"
                  :disabled="!periodOpen"
                  :loading="periodActionLoading"
                  @click="handleClosePeriod"
                >
                  {{ $t('analysis.evCloseBtn') }}
                </NButton>
              </div>
            </template>
            <NEmpty v-else-if="!periodLoading" :description="$t('analysis.evEmpty')" />
          </NSpin>
        </NCard>
      </NTabPane>
      <NTabPane name="override" :tab="$t('analysis.evOverride')">
        <EvaluationOverrideManager />
      </NTabPane>
    </NTabs>

    <!-- 学生：提交评教 + 我的评教 -->
    <NTabs v-else-if="isStudent" v-model:value="studentTab" type="line" animated>
      <NTabPane name="submit" :tab="$t('analysis.evSubmit')">
        <NCard>
          <NSpin :show="periodLoading || formLoading">
            <template v-if="!periodLoading">
              <NEmpty
                v-if="!periodOpen"
                :description="period?.message || $t('analysis.evNoPeriod')"
              />
              <template v-else>
                <NEmpty
                  v-if="courseOptions.length === 0"
                  :description="$t('analysis.evNoCourses')"
                />
                <NForm v-else label-placement="top" class="eval-form">
                  <NFormItem :label="$t('analysis.evSelectCourse')" required>
                    <NSelect
                      :value="selectedTeachInfoId"
                      :options="courseOptions"
                      :placeholder="$t('analysis.evSelectCoursePlaceholder')"
                      filterable
                      style="max-width: 420px"
                      @update:value="handleCourseChange"
                    />
                  </NFormItem>

                  <template v-if="selectedTeachInfoId != null && formRows.length > 0">
                    <div v-if="currentTemplateName" class="eval-template-name">
                      {{ $t('analysis.evTemplate') }}：{{ currentTemplateName }}
                    </div>

                    <div class="eval-rates">
                      <NFormItem v-for="it in formRows" :key="it.itemId" :label="it.itemName">
                        <div class="eval-score-row">
                          <NRate
                            v-if="it.maxScore <= 10"
                            v-model:value="it.score"
                            :count="it.maxScore"
                            :allow-clear="it.required === 0"
                          />
                          <NInputNumber
                            v-else
                            v-model:value="it.score"
                            :min="it.required === 1 ? 1 : 0"
                            :max="it.maxScore"
                            :step="1"
                          />
                          <NTag
                            v-if="it.required === 1"
                            type="error"
                            size="small"
                            :bordered="false"
                          >
                            {{ $t('analysis.evRequired') }}
                          </NTag>
                          <NTag v-else size="small" :bordered="false">
                            {{ $t('analysis.evOptional') }}
                          </NTag>
                          <span class="eval-score-meta">
                            {{ $t('analysis.evMaxScore') }} {{ it.maxScore }}
                          </span>
                        </div>
                      </NFormItem>
                    </div>

                    <div class="eval-hint">{{ $t('analysis.evScoreHint') }}</div>

                    <NFormItem :label="$t('analysis.evComment')">
                      <NInput
                        v-model:value="comment"
                        type="textarea"
                        :autosize="{ minRows: 3, maxRows: 6 }"
                        :placeholder="$t('analysis.evCommentPlaceholder')"
                        maxlength="512"
                        show-count
                        style="max-width: 600px"
                      />
                    </NFormItem>

                    <div class="eval-hint eval-hint-update">{{ $t('analysis.evUpdateHint') }}</div>

                    <div class="eval-actions">
                      <NButton type="primary" :loading="submitting" @click="handleSubmit">
                        {{ $t('analysis.evSubmitBtn') }}
                      </NButton>
                    </div>
                  </template>
                  <NEmpty
                    v-else-if="selectedTeachInfoId != null && !formLoading"
                    :description="$t('analysis.evFormNoTemplate')"
                  />
                </NForm>
              </template>
            </template>
          </NSpin>
        </NCard>
      </NTabPane>

      <NTabPane name="my" :tab="$t('analysis.evMyEvaluations')">
        <NCard>
          <NSpin :show="myLoading">
            <NEmpty
              v-if="!myLoading && myEvaluations.length === 0"
              :description="$t('analysis.evEmpty')"
            />
            <NDataTable
              v-else
              :columns="myColumns"
              :data="myEvaluations"
              :row-key="myEvaluationRowKey"
              :single-line="false"
              :bordered="false"
              :scroll-x="1200"
            />
          </NSpin>
        </NCard>
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped src="./EvaluationPage.css"></style>
