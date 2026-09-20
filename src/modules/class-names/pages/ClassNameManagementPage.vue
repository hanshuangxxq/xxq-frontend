<script setup lang="ts">
/**
 * 班级管理页:行政班的分页列表查询与新建/编辑/删除。
 * 归属链为 院系 → 专业 → 班级：班级只挂专业,院系经所选专业反显(两跳推导),
 * 未指定专业的班级会预警提示 —— 该班学生将失去专业与院系,并在院系管理员视图中消失。
 * 新建按钮与操作列仅对教务管理员渲染,其余角色只读浏览。
 */
import { ref, computed, h, onMounted } from 'vue'
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
  NSelect,
  NTag,
  NPopconfirm,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { fetchClassNames, createClassName, updateClassName, deleteClassName } from '../api'
import { fetchColleges } from '@/modules/college/api'
import { fetchMajors } from '@/modules/majors/api'
import { indexMajors, indexColleges, majorNameOfClass, collegeNameOfClass } from '../chain'
import { useRoleCheck } from '@/shared/composables/useRoleCheck'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import { useLoading } from '@/shared/composables/useLoading'
import { isReportedError } from '@/shared/api'
import type { College } from '@/modules/college/types'
import type { Major } from '@/modules/majors/types'
import type { ClassName, ClassNameForm } from '../types'

const { t } = useI18n()
const message = useMessage()
const { canManageClassNames } = useRoleCheck()

const data = ref<ClassName[]>([])
const { pagination } = useRemotePagination(loadData)

const majors = ref<Major[]>([])
const colleges = ref<College[]>([])

// 归属链索引:班级实体只有 majorId,专业名/院系名都在本地映射,不逐行发请求
const majorById = computed(() => indexMajors(majors.value))
const collegeNameById = computed(() => indexColleges(colleges.value))

const majorOptions = computed(() =>
  majors.value.map((m) => ({ label: m.majorName, value: m.id })),
)

/** 班级 -> 院系名(两跳);链断掉时回退 '-' */
function collegeNameOf(row: ClassName): string {
  return collegeNameOfClass(row, majorById.value, collegeNameById.value) ?? '-'
}

// 下拉数据源:两个字典各自独立降级,任一失败只影响对应列,不牵连另一列
//(院系接口对学生角色会 403,不能让它把专业列一起带空)
async function loadReferenceData() {
  const [majorRes, collegeRes] = await Promise.allSettled([fetchMajors(), fetchColleges()])
  majors.value = majorRes.status === 'fulfilled' ? majorRes.value.data : []
  colleges.value = collegeRes.status === 'fulfilled' ? collegeRes.value.data : []
}

const classNameRowKey = (row: ClassName) => row.id

const baseColumns = computed<DataTableColumns<ClassName>>(() => [
  { title: t('class-names.className'), key: 'className', width: 180, ellipsis: { tooltip: true } },
  {
    title: t('class-names.major'),
    key: 'majorId',
    width: 220,
    ellipsis: { tooltip: true },
    // 未指定专业不是异常数据,但会让该班学生失去专业与院系,故就地预警
    render: (r) =>
      r.majorId == null
        ? h(NTag, { type: 'warning', size: 'small' }, () => t('class-names.noMajor'))
        : (majorNameOfClass(r, majorById.value) ?? '-'),
  },
  {
    title: t('class-names.college'),
    key: 'collegeName',
    width: 180,
    ellipsis: { tooltip: true },
    render: (r) => collegeNameOf(r),
  },
])

// 无管理权限时不渲染操作列,仅保留基础列只读浏览
const columns = computed<DataTableColumns<ClassName>>(() => {
  if (!canManageClassNames.value) return baseColumns.value
  return [
    ...baseColumns.value,
    {
      title: t('class-names.actions'),
      key: 'actions',
      width: 140,
      render(row) {
        return h(NSpace, null, () => [
          h(NButton, { size: 'small', onClick: () => startEdit(row) }, () => t('class-names.edit')),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row.id) },
            {
              default: () => t('class-names.deleteConfirm'),
              trigger: () =>
                h(NButton, { size: 'small', type: 'error' }, () => t('class-names.delete')),
            },
          ),
        ])
      },
    },
  ]
})

async function loadData() {
  try {
    const res = await fetchClassNames(pagination.page, pagination.pageSize)
    data.value = res.data.records
    pagination.itemCount = res.data.total
  } catch (e) {
    if (!isReportedError(e)) message.error((e as Error).message || t('class-names.loadFail'))
  }
}

const showForm = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const { loading: saving, withLoading: withSaving } = useLoading()

const emptyForm = (): ClassNameForm => ({ className: '', majorId: null })
const form = ref<ClassNameForm>(emptyForm())

function startCreate() {
  formMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(row: ClassName) {
  formMode.value = 'edit'
  editingId.value = row.id
  form.value = { className: row.className, majorId: row.majorId }
  showForm.value = true
}

// 新建/编辑共用弹窗,按 formMode 分发到创建或更新接口
function handleSave() {
  // 新建时专业必填(服务端 400 同款校验);编辑时留空表示不改专业
  if (formMode.value === 'create' && form.value.majorId == null) {
    message.warning(t('class-names.majorRequired'))
    return
  }
  if (!form.value.className.trim()) {
    message.warning(t('class-names.nameRequired'))
    return
  }
  return withSaving(async () => {
    try {
      if (formMode.value === 'create') {
        await createClassName(form.value)
      } else {
        await updateClassName(editingId.value!, form.value)
      }
      message.success(t('class-names.saveSuccess'))
      showForm.value = false
      await loadData()
    } catch (e) {
      if (!isReportedError(e)) message.error((e as Error).message || t('class-names.saveFail'))
    }
  })
}

// 该班仍有学生时服务端返回 409 并说明人数,由 api 层统一提示,此处不重复弹窗
async function handleDelete(id: number) {
  try {
    await deleteClassName(id)
    message.success(t('class-names.deleteSuccess'))
    await loadData()
  } catch (e) {
    if (!isReportedError(e)) message.error((e as Error).message || t('class-names.deleteFail'))
  }
}

onMounted(() => {
  loadData()
  loadReferenceData()
})
</script>

<template>
  <div class="cn-page">
    <NSpace vertical :size="16">
      <NCard :title="$t('class-names.title')">
        <template v-if="canManageClassNames" #header-extra>
          <NButton type="primary" @click="startCreate">{{ $t('class-names.add') }}</NButton>
        </template>
        <NDataTable
          :columns="columns"
          :data="data"
          :row-key="classNameRowKey"
          :single-line="false"
          :bordered="false"
          remote
          :pagination="pagination"
        >
          <template #empty>{{ $t('class-names.empty') }}</template>
        </NDataTable>
      </NCard>
    </NSpace>

    <NModal
      v-model:show="showForm"
      preset="card"
      :title="formMode === 'create' ? $t('class-names.createTitle') : $t('class-names.editTitle')"
      class="cn-form-modal"
    >
      <NForm :model="form">
        <NFormItem :label="$t('class-names.className')" required>
          <NInput v-model:value="form.className" />
        </NFormItem>
        <NFormItem :label="$t('class-names.major')" required>
          <NSelect
            v-model:value="form.majorId"
            :options="majorOptions"
            :placeholder="$t('class-names.major')"
            filterable
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">{{ $t('class-names.cancel') }}</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            {{ $t('class-names.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.cn-page {
  padding: 24px;
}
</style>

<style>
.cn-form-modal {
  width: 420px;
  max-width: 85vw;
}
</style>
