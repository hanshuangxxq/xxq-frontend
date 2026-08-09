<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NForm,
  NGrid,
  NFormItemGi,
  NInput,
  NInputNumber,
  NSelect,
  NDatePicker,
  NButton,
  NSpace,
  NDivider,
  useMessage,
  type SelectOption,
} from 'naive-ui'
import { createCampaign, fetchAllGroups } from '../api'
import { useLocaleStore } from '@/stores/useLocaleStore'
import PagedSelect from '@/shared/components/PagedSelect.vue'
import type { CampaignForm, SelectionGroup } from '../types'
import type { Semester } from '@/modules/curriculum/types'

/**
 * 教务管理员创建的选课活动固定为「公选」类型。
 * 该字段不开放给用户修改，提交时强制写入。
 */
const PUBLIC_ELECTIVE_COURSE_TYPE = '公选'

const props = defineProps<{
  show: boolean
  semesters: Semester[]
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  success: []
}>()

const { t } = useI18n()
const message = useMessage()
const localeStore = useLocaleStore()
const dateLocale = computed(() => localeStore.naiveConfig().dateLocale)

const saving = ref(false)

const semesterOptions = computed<SelectOption[]>(() =>
  props.semesters.map((s) => ({ label: s.name, value: s.id })),
)

function emptyForm(): CampaignForm {
  return {
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
  }
}

const form = ref<CampaignForm>(emptyForm())

watch(
  () => props.show,
  (show) => {
    if (show) {
      form.value = emptyForm()
    }
  },
)

function validate(): string | null {
  if (!form.value.name) return t('selection.nameRequired')
  if (!form.value.semesterId) return t('selection.semesterRequired')
  if (!form.value.startTime) return t('selection.startTimeRequired')
  if (!form.value.endTime) return t('selection.endTimeRequired')
  if (form.value.startTime && form.value.endTime && form.value.startTime >= form.value.endTime) {
    return t('selection.endTimeAfterStartTime')
  }
  if (form.value.startWeek == null || form.value.startWeek <= 0) {
    return t('selection.startWeekRequired')
  }
  if (form.value.endWeek == null || form.value.endWeek <= 0) {
    return t('selection.endWeekRequired')
  }
  if (
    form.value.startWeek != null &&
    form.value.endWeek != null &&
    form.value.startWeek > form.value.endWeek
  ) {
    return t('selection.endWeekAfterStartWeek')
  }
  if (!form.value.courseCode) return t('selection.courseCodeRequired')
  if (form.value.credit == null || form.value.credit < 0) {
    return t('selection.creditMin')
  }
  if (form.value.capacity == null || form.value.capacity <= 0) {
    return t('selection.capacityMin')
  }
  return null
}

async function handleSubmit() {
  const error = validate()
  if (error) {
    message.warning(error)
    return
  }

  saving.value = true
  try {
    await createCampaign({
      name: form.value.name,
      semesterId: form.value.semesterId!,
      startTime: form.value.startTime,
      endTime: form.value.endTime,
      startWeek: form.value.startWeek,
      endWeek: form.value.endWeek,
      groupId: form.value.groupId ?? undefined,
      courseCode: form.value.courseCode,
      credit: form.value.credit,
      courseHour: form.value.courseHour,
      description: form.value.description,
      courseType: PUBLIC_ELECTIVE_COURSE_TYPE,
      capacity: form.value.capacity,
    })
    message.success(t('selection.saveSuccess'))
    emit('update:show', false)
    emit('success')
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="$t('selection.addTitle')"
    class="campaign-create-modal"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <NForm :model="form" label-placement="top">
      <NDivider title-placement="left">{{ $t('selection.section.basicInfo') }}</NDivider>
      <NGrid :cols="2" :x-gap="16" :y-gap="0">
        <NFormItemGi :span="2" :label="$t('selection.name')" required>
          <NInput v-model:value="form.name" :placeholder="$t('selection.namePlaceholder')" />
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
          <PagedSelect
            :model-value="form.groupId ?? null"
            :fetch-page="(page: number, pageSize: number) => fetchAllGroups(page, pageSize)"
            :label-of="(g: SelectionGroup) => g.name"
            :value-of="(g: SelectionGroup) => g.id"
            :placeholder="$t('selection.groupNonePlaceholder')"
            clearable
            @update:model-value="
              (v: string | number | null | Array<string | number>) =>
                (form.groupId = v as number | null)
            "
          />
        </NFormItemGi>
      </NGrid>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">{{ $t('selection.cancel') }}</NButton>
        <NButton type="primary" :loading="saving" @click="handleSubmit">
          {{ $t('selection.save') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped src="./CampaignCreateModal.css"></style>

<style>
.campaign-create-modal {
  width: 640px;
  max-width: 90vw;
}
</style>
