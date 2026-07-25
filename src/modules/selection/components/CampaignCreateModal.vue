<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NForm,
  NFormItem,
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
import { createCampaign } from '../api'
import { useLocaleStore } from '@/stores/useLocaleStore'
import type { CampaignForm } from '../types'
import type { Semester } from '@/modules/curriculum/types'

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
  if (form.value.startWeek != null && form.value.endWeek != null && form.value.startWeek > form.value.endWeek) {
    return t('selection.endWeekAfterStartWeek')
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
      <NFormItem :label="$t('selection.name')" required>
        <NInput v-model:value="form.name" :placeholder="$t('selection.namePlaceholder')" />
      </NFormItem>
      <NFormItem :label="$t('selection.semester')" required>
        <NSelect
          v-model:value="form.semesterId"
          :options="semesterOptions"
          :placeholder="$t('selection.semesterPlaceholder')"
        />
      </NFormItem>
      <NFormItem :label="$t('selection.startTime')" required>
        <NDatePicker
          v-model:formatted-value="form.startTime"
          type="datetime"
          value-format="yyyy-MM-dd'T'HH:mm:ss"
          :locale="dateLocale"
          :placeholder="$t('selection.startTime')"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem :label="$t('selection.endTime')" required>
        <NDatePicker
          v-model:formatted-value="form.endTime"
          type="datetime"
          value-format="yyyy-MM-dd'T'HH:mm:ss"
          :locale="dateLocale"
          :placeholder="$t('selection.endTime')"
          style="width: 100%"
        />
      </NFormItem>
      <NDivider title-placement="left">{{ $t('selection.section.scheduling') }}</NDivider>
      <NFormItem :label="$t('selection.startWeek')" required>
        <NInputNumber v-model:value="form.startWeek" :min="1" style="width: 100%" />
      </NFormItem>
      <NFormItem :label="$t('selection.endWeek')" required>
        <NInputNumber v-model:value="form.endWeek" :min="1" style="width: 100%" />
      </NFormItem>
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
  width: 560px;
  max-width: 90vw;
}
</style>
