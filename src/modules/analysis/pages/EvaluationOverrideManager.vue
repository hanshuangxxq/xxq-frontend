<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NSelect,
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NTag,
  NSpin,
  NPopconfirm,
  NAlert,
  useMessage,
} from 'naive-ui'
import { fetchEvaluationTemplates, fetchEvaluationOverride, setEvaluationOverride } from '../api'
import { fetchTeachInfoList } from '@/modules/curriculum/api'
import type { TeachInfo } from '@/modules/curriculum/types'
import type { EvaluationTemplateDto } from '../types'

const { t } = useI18n()
const message = useMessage()

// ---- 授课安排选项 ----
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

// ---- 模板选项（仅启用） ----
const templates = ref<EvaluationTemplateDto[]>([])
const templateOptions = computed(() =>
  templates.value
    .filter((tp) => tp.status === '启用')
    .map((tp) => ({ label: tp.name, value: tp.id })),
)

async function loadTemplates() {
  try {
    const res = await fetchEvaluationTemplates()
    templates.value = res.data
  } catch {
    // 非阻塞
  }
}

// ---- 当前覆盖 ----
const currentLoading = ref(false)
const currentTemplate = ref<EvaluationTemplateDto | null>(null)
const selectedTemplateId = ref<number | null>(null)
const saving = ref(false)

async function loadCurrentOverride(teachInfoId: number) {
  currentLoading.value = true
  currentTemplate.value = null
  selectedTemplateId.value = null
  try {
    const res = await fetchEvaluationOverride(teachInfoId)
    currentTemplate.value = res.data
    selectedTemplateId.value = res.data?.id ?? null
  } catch (e) {
    message.error((e as Error).message || t('analysis.evOverrideSaveFail'))
  } finally {
    currentLoading.value = false
  }
}

function handleCourseChange(id: number | null) {
  selectedTeachInfoId.value = id
  if (id != null) loadCurrentOverride(id)
  else {
    currentTemplate.value = null
    selectedTemplateId.value = null
  }
}

async function handleSaveOverride() {
  if (selectedTeachInfoId.value == null || selectedTemplateId.value == null) return
  saving.value = true
  try {
    await setEvaluationOverride(selectedTeachInfoId.value, {
      templateId: selectedTemplateId.value,
    })
    message.success(t('analysis.evOverrideSaveSuccess'))
    await loadCurrentOverride(selectedTeachInfoId.value)
  } catch (e) {
    message.error((e as Error).message || t('analysis.evOverrideSaveFail'))
  } finally {
    saving.value = false
  }
}

async function handleClearOverride() {
  if (selectedTeachInfoId.value == null) return
  saving.value = true
  try {
    await setEvaluationOverride(selectedTeachInfoId.value, { templateId: null })
    message.success(t('analysis.evOverrideClearSuccess'))
    await loadCurrentOverride(selectedTeachInfoId.value)
  } catch (e) {
    message.error((e as Error).message || t('analysis.evOverrideClearFail'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadCourses()
  loadTemplates()
})
</script>

<template>
  <NCard :title="$t('analysis.evOverride')">
    <NAlert type="info" :show-icon="true" class="override-hint">
      {{ $t('analysis.evOverrideHint') }}
    </NAlert>
    <NSpace vertical :size="16">
      <div class="override-row">
        <span class="override-label">{{ $t('analysis.evOverrideCourse') }}</span>
        <NSelect
          :value="selectedTeachInfoId"
          :options="courseOptions"
          :placeholder="$t('analysis.evOverrideSelectCourse')"
          filterable
          style="width: 360px; max-width: 100%"
          @update:value="handleCourseChange"
        />
      </div>

      <NSpin :show="currentLoading">
        <template v-if="selectedTeachInfoId != null">
          <NDescriptions :column="1" label-placement="left" bordered>
            <NDescriptionsItem :label="$t('analysis.evOverrideCurrent')">
              <NTag v-if="currentTemplate" type="info" size="small" :bordered="false">
                {{ currentTemplate.name }}
              </NTag>
              <span v-else class="override-none">{{ $t('analysis.evOverrideNoOverride') }}</span>
            </NDescriptionsItem>
          </NDescriptions>

          <div class="override-row" style="margin-top: 16px">
            <span class="override-label">{{ $t('analysis.evOverrideTemplate') }}</span>
            <NSelect
              v-model:value="selectedTemplateId"
              :options="templateOptions"
              :placeholder="$t('analysis.evOverrideSelectTemplate')"
              style="width: 360px; max-width: 100%"
            />
          </div>

          <div class="override-actions">
            <NButton
              type="primary"
              :loading="saving"
              :disabled="selectedTemplateId == null"
              @click="handleSaveOverride"
            >
              {{ $t('analysis.evOverrideSetBtn') }}
            </NButton>
            <NPopconfirm @positive-click="handleClearOverride">
              <template #trigger>
                <NButton type="error" :loading="saving" :disabled="currentTemplate == null">
                  {{ $t('analysis.evOverrideClearBtn') }}
                </NButton>
              </template>
              {{ $t('analysis.evOverrideClearConfirm') }}
            </NPopconfirm>
          </div>
        </template>
      </NSpin>
    </NSpace>
  </NCard>
</template>

<style scoped src="./EvaluationOverrideManager.css"></style>
