<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useRouter } from 'vue-router'
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
  NPopconfirm,
  NSpin,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchCourses, createCourse, updateCourse, deleteCourse } from '../api'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import { isPublicCourse } from '../utils'
import type { Course, CourseForm } from '../types'

const { t } = useI18n()
const message = useMessage()
const router = useRouter()
const { canManageCourses } = useRoleCheck()

const loading = ref(false)
const data = ref<Course[]>([])
const { pagination } = useRemotePagination(loadData)

const baseColumns: DataTableColumns<Course> = [
  {
    title: t('course-management.courseName'),
    key: 'courseName',
    width: 160,
    ellipsis: { tooltip: true },
  },
  { title: t('course-management.courseCode'), key: 'courseCode', width: 120 },
  { title: t('course-management.credit'), key: 'credit', width: 70, align: 'center' },
  { title: t('course-management.courseHour'), key: 'courseHour', width: 70, align: 'center' },
  { title: t('course-management.courseType'), key: 'courseType', width: 80 },
]

const columns = computed<DataTableColumns<Course>>(() => {
  if (!canManageCourses.value) return baseColumns
  return [
    ...baseColumns,
    {
      title: t('course-management.actions'),
      key: 'actions',
      width: 140,
      render(row) {
        // 公选课编辑跳转选课活动详情页（公选课 CRUD 走 /api/selection/campaigns/*，不可调 PUT /courses/{id}）
        const onEdit = () =>
          isPublicCourse(row) ? router.push(`/selection/${row.id}`) : startEdit(row)
        return h(NSpace, null, () => [
          h(NButton, { size: 'small', onClick: onEdit }, () => t('course-management.edit')),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row) },
            {
              default: () => t('course-management.deleteConfirm'),
              trigger: () =>
                h(NButton, { size: 'small', type: 'error' }, () => t('course-management.delete')),
            },
          ),
        ])
      },
    },
  ]
})

async function loadData() {
  loading.value = true
  try {
    const res = await fetchCourses(pagination.page, pagination.pageSize)
    data.value = res.data.records
    pagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('course-management.loadFail'))
  } finally {
    loading.value = false
  }
}

const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)

const emptyForm = (): CourseForm => ({
  courseName: '',
  courseCode: '',
  credit: null,
  courseHour: null,
  courseType: '',
})

const form = ref<CourseForm>(emptyForm())

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(row: Course) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = {
    courseName: row.courseName,
    courseCode: row.courseCode,
    credit: row.credit,
    courseHour: row.courseHour,
    courseType: row.courseType,
  }
  showForm.value = true
}

async function handleSave() {
  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createCourse(form.value)
    } else {
      await updateCourse(editingId.value!, form.value)
    }
    message.success(t('course-management.saveSuccess'))
    showForm.value = false
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('course-management.saveFail'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: Course) {
  try {
    // 公选课必须带 source=SELECTION_CAMPAIGN，否则可能误删同 id 的常规课
    await deleteCourse(row.id, row.source ?? undefined)
    message.success(t('course-management.deleteSuccess'))
    await loadData()
  } catch (e) {
    message.error((e as Error).message || t('course-management.deleteFail'))
  }
}

onMounted(loadData)
</script>

<template>
  <div class="cm-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('course-management.title')">
        <template v-if="canManageCourses" #header-extra>
          <NButton type="primary" @click="startCreate">{{ $t('course-management.add') }}</NButton>
        </template>
        <NSpin :show="loading">
          <NDataTable
            :columns="columns"
            :data="data"
            :row-key="(r: Course) => r.id"
            :single-line="false"
            :bordered="false"
            remote
            :pagination="pagination"
          >
            <template #empty>{{ $t('course-management.empty') }}</template>
          </NDataTable>
        </NSpin>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showForm"
      preset="card"
      :title="
        formMode === 'create'
          ? $t('course-management.createTitle')
          : $t('course-management.editTitle')
      "
      class="cm-form-modal"
    >
      <NForm :model="form">
        <NFormItem :label="$t('course-management.courseName')">
          <NInput v-model:value="form.courseName" />
        </NFormItem>
        <NFormItem :label="$t('course-management.courseCode')">
          <NInput v-model:value="form.courseCode" />
        </NFormItem>
        <NFormItem :label="$t('course-management.credit')">
          <NInput
            :value="form.credit !== null ? String(form.credit) : ''"
            @update:value="(v: string) => (form.credit = v ? parseInt(v, 10) : null)"
          />
        </NFormItem>
        <NFormItem :label="$t('course-management.courseHour')">
          <NInput
            :value="form.courseHour !== null ? String(form.courseHour) : ''"
            @update:value="(v: string) => (form.courseHour = v ? parseInt(v, 10) : null)"
          />
        </NFormItem>
        <NFormItem :label="$t('course-management.courseType')">
          <NInput v-model:value="form.courseType" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">{{ $t('course-management.cancel') }}</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            {{ $t('course-management.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.cm-page {
  padding: 24px;
}
</style>

<style>
.cm-form-modal {
  width: 420px;
  max-width: 85vw;
}
</style>
