<script setup lang="ts">
import { ref, computed, h, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NButton,
  NSpace,
  NDataTable,
  NPopconfirm,
  NSpin,
  NTooltip,
  NTag,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  fetchAllGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  updateCampaign,
  fetchBindableCampaigns,
} from '../api'
import { useRemotePagination } from '@/shared/composables/useRemotePagination'
import type { Campaign, CampaignStatus, SelectionGroup, SelectionGroupForm } from '../types'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  changed: []
}>()

const { t } = useI18n()
const message = useMessage()

const loading = ref(false)
const groups = ref<SelectionGroup[]>([])
const { pagination } = useRemotePagination(loadGroups)

const statusTagType: Record<CampaignStatus, 'default' | 'info' | 'warning' | 'success'> = {
  DRAFT: 'default',
  OPEN: 'success',
  CLOSED: 'warning',
  FINALIZED: 'info',
}

function formatDateTime(s: string | null | undefined): string {
  return s ? s.replace('T', ' ') : ''
}

async function loadGroups() {
  loading.value = true
  try {
    const res = await fetchAllGroups(pagination.page, pagination.pageSize)
    groups.value = res.data.records
    pagination.itemCount = res.data.total
  } catch (e) {
    message.error((e as Error).message || t('selection.loadFail'))
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      loadGroups()
    }
  },
)

const groupColumns = computed<DataTableColumns<SelectionGroup>>(() => [
  { title: t('selection.groupName'), key: 'name', width: 220, ellipsis: { tooltip: true } },
  {
    title: t('selection.groupMaxCourses'),
    key: 'maxCourses',
    width: 160,
    align: 'center',
  },
  {
    title: t('selection.campaignCount'),
    key: 'campaignCount',
    width: 140,
    align: 'center',
    render: (row) => row.campaignCount ?? 0,
  },
  {
    title: t('selection.createTime'),
    key: 'createTime',
    width: 160,
    render: (row) => formatDateTime(row.createTime),
  },
  {
    title: t('selection.actions'),
    key: 'actions',
    width: 280,
    align: 'center',
    fixed: 'right',
    render(row) {
      const buttons: ReturnType<typeof h>[] = []
      buttons.push(
        h(NButton, { size: 'small', onClick: () => openEditGroup(row) }, () => t('selection.edit')),
      )
      buttons.push(
        h(
          NButton,
          {
            size: 'small',
            type: 'info',
            quaternary: true,
            onClick: () => openBindingModal(row),
          },
          () => t('selection.manageBindings'),
        ),
      )
      const boundCount = row.campaignCount ?? 0
      if (boundCount > 0) {
        buttons.push(
          h(
            NTooltip,
            {},
            {
              trigger: () =>
                h(NButton, { size: 'small', type: 'error', disabled: true }, () =>
                  t('selection.delete'),
                ),
              default: () => t('selection.groupHasBindings'),
            },
          ),
        )
      } else {
        buttons.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row) },
            {
              default: () => t('selection.deleteGroupConfirm'),
              trigger: () =>
                h(NButton, { size: 'small', type: 'error' }, () => t('selection.delete')),
            },
          ),
        )
      }
      return h(NSpace, { size: 4 }, () => buttons)
    },
  },
])

const showGroupForm = ref(false)
const groupFormMode = ref<'create' | 'edit'>('create')
const editingGroupId = ref<number | null>(null)
const savingGroup = ref(false)
const groupForm = ref<SelectionGroupForm>({
  name: '',
  maxCourses: 1,
})

function openCreateGroup() {
  groupFormMode.value = 'create'
  editingGroupId.value = null
  groupForm.value = { name: '', maxCourses: 1 }
  showGroupForm.value = true
}

function openEditGroup(row: SelectionGroup) {
  groupFormMode.value = 'edit'
  editingGroupId.value = row.id
  groupForm.value = {
    name: row.name,
    maxCourses: row.maxCourses,
  }
  showGroupForm.value = true
}

async function handleSaveGroup() {
  if (!groupForm.value.name) {
    message.warning(t('selection.groupNameRequired'))
    return
  }
  if (!groupForm.value.maxCourses || groupForm.value.maxCourses <= 0) {
    message.warning(t('selection.groupMaxCoursesRequired'))
    return
  }
  savingGroup.value = true
  try {
    const payload: SelectionGroupForm = {
      name: groupForm.value.name,
      maxCourses: groupForm.value.maxCourses,
    }
    if (groupFormMode.value === 'create') {
      await createGroup(payload)
    } else {
      await updateGroup(editingGroupId.value!, payload)
    }
    message.success(t('selection.saveSuccess'))
    showGroupForm.value = false
    await loadGroups()
    emit('changed')
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  } finally {
    savingGroup.value = false
  }
}

async function handleDelete(row: SelectionGroup) {
  try {
    await deleteGroup(row.id)
    message.success(t('selection.deleteSuccess'))
    await loadGroups()
    emit('changed')
  } catch (e) {
    message.error((e as Error).message || t('selection.deleteFail'))
  }
}

const showBindingModal = ref(false)
const bindingGroup = ref<SelectionGroup | null>(null)
const bindingLoading = ref(false)
const bindableCampaigns = ref<Campaign[]>([])

async function openBindingModal(row: SelectionGroup) {
  bindingGroup.value = row
  showBindingModal.value = true
  bindableCampaigns.value = []
  await loadBindableCampaigns(row.id)
}

async function loadBindableCampaigns(groupId: number) {
  bindingLoading.value = true
  try {
    const res = await fetchBindableCampaigns(groupId)
    bindableCampaigns.value = res.data
  } catch (e) {
    message.error((e as Error).message || t('selection.loadFail'))
  } finally {
    bindingLoading.value = false
  }
}

const bindingColumns = computed<DataTableColumns<Campaign>>(() => [
  { title: t('selection.name'), key: 'name', width: 200, ellipsis: { tooltip: true } },
  { title: t('selection.semester'), key: 'semesterName', width: 160, ellipsis: { tooltip: true } },
  {
    title: t('selection.status'),
    key: 'status',
    width: 100,
    align: 'center',
    render(row) {
      return h(NTag, { type: statusTagType[row.status], bordered: false }, () =>
        t(`selection.${row.status}`),
      )
    },
  },
  {
    title: t('selection.bindingStatus'),
    key: 'bound',
    width: 100,
    align: 'center',
    render(row) {
      const isBound = row.boundGroupId != null
      return isBound
        ? h(NTag, { size: 'small', type: 'success', bordered: false }, () => t('selection.bound'))
        : h(NTag, { size: 'small', type: 'default', bordered: false }, () =>
            t('selection.notBound'),
          )
    },
  },
  {
    title: t('selection.actions'),
    key: 'actions',
    width: 140,
    align: 'center',
    render(row) {
      const isBound = row.boundGroupId != null
      const canOperate = row.status === 'DRAFT'
      if (isBound) {
        if (canOperate) {
          return h(
            NPopconfirm,
            { onPositiveClick: () => handleUnbind(row.id) },
            {
              default: () => t('selection.unbindConfirm'),
              trigger: () =>
                h(NButton, { size: 'small', type: 'warning' }, () => t('selection.unbind')),
            },
          )
        }
        return h(
          NTooltip,
          {},
          {
            trigger: () =>
              h(NButton, { size: 'small', disabled: true }, () => t('selection.bound')),
            default: () => t('selection.unbindOnlyDraft'),
          },
        )
      }
      if (canOperate) {
        return h(
          NButton,
          { size: 'small', type: 'primary', onClick: () => handleBind(row.id) },
          () => t('selection.bind'),
        )
      }
      return h('span', '-')
    },
  },
])

async function handleBind(campaignId: number) {
  if (!bindingGroup.value) return
  try {
    await updateCampaign(campaignId, { groupId: bindingGroup.value.id })
    message.success(t('selection.bindSuccess'))
    await loadBindableCampaigns(bindingGroup.value.id)
    await loadGroups()
    emit('changed')
  } catch (e) {
    message.error((e as Error).message || t('selection.saveFail'))
  }
}

async function handleUnbind(campaignId: number) {
  if (!bindingGroup.value) return
  try {
    await updateCampaign(campaignId, { unbindGroup: true })
    message.success(t('selection.unbindSuccess'))
    await loadBindableCampaigns(bindingGroup.value.id)
    await loadGroups()
    emit('changed')
  } catch (e) {
    message.error((e as Error).message || t('selection.deleteFail'))
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="$t('selection.configGroups')"
    class="group-management-modal"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="group-management-toolbar">
      <NButton type="primary" @click="openCreateGroup">
        {{ $t('selection.addGroup') }}
      </NButton>
    </div>
    <NSpin :show="loading">
      <NDataTable
        :columns="groupColumns"
        :data="groups"
        :row-key="(r: SelectionGroup) => r.id"
        :single-line="false"
        :bordered="false"
        :max-height="400"
        :scroll-x="1100"
        remote
        :pagination="pagination"
      >
        <template #empty>{{ $t('selection.groupEmpty') }}</template>
      </NDataTable>
    </NSpin>

    <NModal
      v-model:show="showGroupForm"
      preset="card"
      :title="
        groupFormMode === 'create' ? $t('selection.addGroupTitle') : $t('selection.editGroupTitle')
      "
      class="group-form-modal"
    >
      <NForm :model="groupForm">
        <NFormItem :label="$t('selection.groupName')" required>
          <NInput
            v-model:value="groupForm.name"
            :placeholder="$t('selection.groupNamePlaceholder')"
          />
        </NFormItem>
        <NFormItem :label="$t('selection.groupMaxCourses')" required>
          <NInputNumber
            v-model:value="groupForm.maxCourses"
            :min="1"
            :placeholder="$t('selection.groupMaxCoursesPlaceholder')"
            style="width: 100%"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showGroupForm = false">{{ $t('selection.cancel') }}</NButton>
          <NButton type="primary" :loading="savingGroup" @click="handleSaveGroup">
            {{ $t('selection.save') }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      v-model:show="showBindingModal"
      preset="card"
      :title="
        bindingGroup
          ? `${$t('selection.manageBindings')} - ${bindingGroup.name}`
          : $t('selection.manageBindings')
      "
      class="binding-management-modal"
    >
      <NSpin :show="bindingLoading">
        <NEmpty
          v-if="!bindingLoading && bindableCampaigns.length === 0"
          :description="$t('selection.empty')"
        />
        <NDataTable
          v-else
          :columns="bindingColumns"
          :data="bindableCampaigns"
          :row-key="(r: Campaign) => r.id"
          :single-line="false"
          :bordered="false"
          :max-height="420"
          :scroll-x="700"
        />
      </NSpin>
    </NModal>
  </NModal>
</template>

<style scoped src="./GroupManagementModal.css"></style>

<style>
.group-management-modal {
  width: 960px;
  max-width: 92vw;
}

.group-form-modal {
  width: 480px;
  max-width: 85vw;
}

.binding-management-modal {
  width: 760px;
  max-width: 92vw;
}
</style>
