<script setup lang="ts">
/**
 * 教师上传/编辑课程资料弹窗。
 *
 * 资料的**文件本体不可替换**（换文件 = 删除重传），所以编辑模式只改标题/描述，
 * 不提供选文件的入口，并在编辑态显式提示这一点，避免用户以为能换文件。
 *
 * 「所在文件夹」是 NTreeSelect 逐层懒加载（展开才拉子层）：新建预选当前层，
 * 编辑预选资料现所在文件夹；编辑时只有用户改选过才发移动请求。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NTreeSelect,
  NUpload,
  NButton,
  NSpace,
  NText,
  useMessage,
  type TreeSelectOption,
  type UploadFileInfo,
} from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { useLoading } from '@/shared/composables/useLoading'
import { prepareSubmitFile } from '@/modules/file/submit'
import { bizAccept, validateFileForBiz } from '@/modules/file/validate'
import { fetchMaterialFolderLevel, moveMaterial, updateMaterial, uploadMaterial } from '../api'
import { MATERIAL_BIZ } from '../constants'
import type { MaterialFolderView, MaterialView } from '../types'

const props = defineProps<{
  show: boolean
  courseId: number
  /** null = 上传新资料;非 null = 编辑该资料的标题/描述/所在文件夹 */
  material: MaterialView | null
  /** 上传目标/编辑起点所在文件夹(null = 根目录) */
  currentFolderId?: number | null
  /** 根 → currentFolderId 的链,打开时预展开并选中 */
  folderPath?: MaterialFolderView[]
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const { t } = useI18n()
const message = useMessage()

const isEdit = computed(() => props.material !== null)

const form = ref({ title: '', description: '' })
const fileList = ref<UploadFileInfo[]>([])
const { loading: saving, withLoading: withSaving } = useLoading()

// ---- 「所在文件夹」树选择(逐层懒加载,不整树全拉) ----

/** 合成「根目录」节点的 key(数据库 id 从 1 起,0 不会撞) */
const ROOT_KEY = 0

const folderValue = ref<number>(ROOT_KEY)
/** 用户是否动过文件夹选择:编辑时没动就不发移动请求 */
const folderTouched = ref(false)
const folderOptions = ref<TreeSelectOption[]>([])
const folderExpandedKeys = ref<number[]>([])

function toFolderOption(f: MaterialFolderView): TreeSelectOption {
  // children 缺省 = 未加载,NTreeSelect 展开时走 onLoad(懒加载)
  return { key: f.id, label: f.title, isLeaf: false }
}

async function loadFolderLevel(parentId: number | null): Promise<TreeSelectOption[]> {
  const res = await fetchMaterialFolderLevel(props.courseId, parentId)
  return res.data.map(toFolderOption)
}

/** NTreeSelect 懒加载回调:展开节点才拉其子文件夹 */
async function handleFolderLoad(node: TreeSelectOption): Promise<void> {
  const parentId = typeof node.key === 'number' ? node.key : null
  node.children = await loadFolderLevel(parentId)
}

/** 打开时:拉根层,并沿 folderPath 逐层加载展开到当前文件夹 */
async function initFolderOptions(): Promise<void> {
  const rootChildren = await loadFolderLevel(null)
  folderOptions.value = [
    { key: ROOT_KEY, label: t('coursework.material.rootFolder'), isLeaf: true },
    ...rootChildren,
  ]
  const chain = props.folderPath ?? []
  let siblings = rootChildren
  const expanded: number[] = []
  for (const folder of chain) {
    const opt = siblings.find((o) => o.key === folder.id)
    if (!opt) break
    const children = await loadFolderLevel(folder.id)
    opt.children = children
    expanded.push(folder.id)
    siblings = children
  }
  folderExpandedKeys.value = expanded
  folderValue.value = props.material?.folderId ?? props.currentFolderId ?? ROOT_KEY
  folderTouched.value = false
}

watch(
  () => [props.show, props.material] as const,
  ([show]) => {
    if (!show) return
    const m = props.material
    form.value = { title: m?.title ?? '', description: m?.description ?? '' }
    fileList.value = []
    // 文件夹树加载失败由 api 层 toast(静默类不重复弹),不阻塞弹窗其余部分
    void initFolderOptions().catch((e: unknown) => {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.loadFail'))
      }
    })
  },
  { immediate: true },
)

function handleSave() {
  const f = form.value
  // data 里的必填字段缺失只会得到笼统的 400「请求体格式错误」,本地必须先校验
  if (!f.title.trim()) {
    message.warning(t('coursework.material.titleRequired'))
    return
  }
  const existing = props.material
  const raw = fileList.value[0]?.file ?? null
  // 新建时文件必给其一（file 或 filePath），没有文件后端会 400
  if (!existing && !raw) {
    message.warning(t('coursework.material.fileRequired'))
    return
  }
  if (raw) {
    const err = validateFileForBiz(raw, MATERIAL_BIZ)
    if (err) {
      message.warning(t(`file.error.${err}`))
      return
    }
  }

  return withSaving(async () => {
    try {
      if (existing) {
        await updateMaterial(existing.id, {
          title: f.title.trim(),
          description: f.description,
        })
        // 所在文件夹被改选才发移动请求;「根目录」映射为 null
        const target = folderValue.value === ROOT_KEY ? null : folderValue.value
        const before = existing.folderId ?? null
        if (folderTouched.value && target !== before) {
          await moveMaterial(existing.id, target)
        }
      } else {
        // ≤20MB 走 multipart 整传；>20MB 自动分片上传，进度见右下角面板
        const prepared = await prepareSubmitFile(raw, MATERIAL_BIZ)
        await uploadMaterial(
          {
            teachInfoId: props.courseId,
            title: f.title.trim(),
            description: f.description,
            ...(folderValue.value !== ROOT_KEY ? { folderId: folderValue.value } : {}),
          },
          prepared,
        )
      }
      message.success(
        t(existing ? 'coursework.material.editSuccess' : 'coursework.material.uploadSuccess'),
      )
      emit('update:show', false)
      emit('saved')
    } catch (e) {
      if (!isReportedError(e)) {
        message.error((e as Error).message || t('coursework.common.operationFail'))
      }
    }
  })
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="coursework-modal"
    :title="isEdit ? t('coursework.material.editTitle') : t('coursework.material.addTitle')"
    @update:show="emit('update:show', $event)"
  >
    <NForm :model="form" label-placement="top">
      <NFormItem :label="t('coursework.material.title')" required>
        <NInput v-model:value="form.title" maxlength="100" show-count />
      </NFormItem>
      <NFormItem :label="t('coursework.material.description')">
        <NInput v-model:value="form.description" type="textarea" :rows="3" />
      </NFormItem>
      <NFormItem :label="t('coursework.material.location')">
        <NTreeSelect
          v-model:value="folderValue"
          v-model:expanded-keys="folderExpandedKeys"
          class="full-width"
          :options="folderOptions"
          :on-load="handleFolderLoad"
          key-field="key"
          label-field="label"
          @update:value="folderTouched = true"
        />
      </NFormItem>
      <NFormItem v-if="isEdit" :label="t('coursework.common.selectFile')">
        <NText depth="3" class="upload-hint">
          {{ t('coursework.material.noFileTip') }}
        </NText>
      </NFormItem>
      <NFormItem v-else :label="t('coursework.material.tab')" required>
        <div class="upload-block">
          <NUpload
            v-model:file-list="fileList"
            :accept="bizAccept(MATERIAL_BIZ)"
            :max="1"
            :default-upload="false"
          >
            <NButton>{{ t('coursework.common.selectFile') }}</NButton>
          </NUpload>
        </div>
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">{{ t('coursework.common.cancel') }}</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">
          {{ t('coursework.common.save') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped src="./MaterialFormModal.css"></style>

<style>
.coursework-modal {
  width: 640px;
  max-width: 92vw;
}
</style>
