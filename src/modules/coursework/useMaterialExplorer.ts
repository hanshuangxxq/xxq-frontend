import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { BusinessError, isReportedError } from '@/shared/api'
import { useLoading } from '@/shared/composables/useLoading'
import { browseMaterials, fetchCommonVideos } from './api'
import { useCourseAnchor } from './useCourseAnchor'
import type { MaterialBrowseView, MaterialFolderView, VideoView } from './types'

/**
 * 资源管理器当前位置:
 * - root   根层(文件夹 + 资料 + 「教学视频」虚拟节点入口)
 * - folder 某个文件夹(id 定位;路径见 pathStack)
 * - videos 「教学视频」虚拟节点(未挂节视频;只是授课组内的分组,不是跨课程公共池)
 */
export type ExplorerLocation = { kind: 'root' } | { kind: 'folder'; id: number } | { kind: 'videos' }

/**
 * 课程资料资源管理器数据(教师/学生共用)。
 *
 * 懒加载:进入哪层拉哪层(browse 单层 folders+materials;「教学视频」层单独拉
 * /videos/common),不整树全拉;增删改后 reload() 当前层;换课重置回根层。
 *
 * 锚点约定:与 useChapterTree 不同,这里**用** useCourseAnchor —— browse 响应顶层
 * 回带归一后的 teachInfoId,采纳后建文件夹/上传等后续请求都用它(文档 §1.6)。
 */
export function useMaterialExplorer(courseId: () => number | null) {
  const { t } = useI18n()
  const message = useMessage()
  const { anchorId, adopt } = useCourseAnchor(courseId)

  const location = ref<ExplorerLocation>({ kind: 'root' })
  /** 根 → 当前文件夹的链(仅 folder 层有意义),面包屑与移动选择器预展开都用它 */
  const pathStack = ref<MaterialFolderView[]>([])
  /** 当前层的 browse 结果(仅 root/folder 层有值) */
  const browse = ref<MaterialBrowseView | null>(null)
  /** 「教学视频」层的视频列表(仅 videos 层有值) */
  const videos = ref<VideoView[] | null>(null)
  const { loading, withLoading } = useLoading()

  function load(): Promise<void> {
    const id = anchorId.value
    if (id == null) {
      browse.value = null
      videos.value = null
      return Promise.resolve()
    }
    return withLoading(async () => {
      try {
        const loc = location.value
        if (loc.kind === 'videos') {
          const res = await fetchCommonVideos(id)
          videos.value = res.data
          return
        }
        const res = await browseMaterials(id, loc.kind === 'folder' ? loc.id : null)
        browse.value = res.data
        adopt(res.data.teachInfoId)
        // 面包屑以服务端回带的 path 为准(改名后即时反映,也兜住并发变动)
        pathStack.value = res.data.path
      } catch (e) {
        // 当前文件夹被并发删除(404):不留在已消失的层,回根层重拉
        if (e instanceof BusinessError && e.code === 404 && location.value.kind === 'folder') {
          location.value = { kind: 'root' }
          pathStack.value = []
          await load()
          return
        }
        if (!isReportedError(e)) {
          message.error((e as Error).message || t('coursework.common.loadFail'))
        }
        browse.value = null
        videos.value = null
      }
    })
  }

  /** 进入某文件夹(把当前层内容换成它) */
  function enterFolder(folder: MaterialFolderView): void {
    location.value = { kind: 'folder', id: folder.id }
    void load()
  }

  /** 进入根层「教学视频」虚拟节点(入口只在根层渲染) */
  function enterVideos(): void {
    location.value = { kind: 'videos' }
    pathStack.value = []
    void load()
  }

  /** 面包屑跳转:-1 = 根层;否则跳到 pathStack 第 index 层 */
  function jumpTo(index: number): void {
    if (index < 0) {
      location.value = { kind: 'root' }
      pathStack.value = []
    } else {
      const target = pathStack.value[index]
      if (!target) return
      location.value = { kind: 'folder', id: target.id }
      pathStack.value = pathStack.value.slice(0, index + 1)
    }
    void load()
  }

  // 换课:回根层重拉;先清数据,避免旧课内容停在新课标题下
  watch(
    courseId,
    () => {
      location.value = { kind: 'root' }
      pathStack.value = []
      browse.value = null
      videos.value = null
      void load()
    },
    { immediate: true },
  )

  return {
    location,
    pathStack,
    browse,
    videos,
    loading,
    anchorId,
    enterFolder,
    enterVideos,
    jumpTo,
    reload: load,
  }
}
