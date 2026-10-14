import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { isReportedError } from '@/shared/api'
import { useLoading } from '@/shared/composables/useLoading'
import { fetchChapterTree } from './api'
import type { ChapterTreeView } from './types'

/**
 * 章节树数据(教师/学生共用)。
 *
 * 视频子域**不再有平铺列表接口**,整棵树一次拉齐(章 → 节 → 视频),
 * 增删改后统一 `reload()` 重拉 —— 服务端的创建顺序(id 升序)即展示顺序,
 * 没有需要前端维护的本地排序。
 *
 * 关于授课组锚点:其它 Tab 用 `useCourseAnchor` 采纳响应回带的锚点行 id,这里是**刻意不用** ——
 * 树响应没有顶层 teachInfoId,而视频子域所有端点要么由服务端把组内任意一行 id 归一(建章、拉树),
 * 要么直接按节/视频 id 寻址(建节、改名、删除、登记),不存在「传错行导致内容对不上」的风险,
 * 故直接透传选择器给的 courseId。
 *
 * @param courseId 课程选择器给的授课组 id(getter;换课即重拉)
 */
export function useChapterTree(courseId: () => number | null) {
  const { t } = useI18n()
  const message = useMessage()

  const tree = ref<ChapterTreeView | null>(null)
  const { loading, withLoading } = useLoading()

  /**
   * 真正有内容的树。空树(null 或章为空)一律交给空状态 ——
   * 否则加载中/空数据这两段会先渲染出空壳的树再塌缩,来回闪屏。
   */
  const visibleTree = computed<ChapterTreeView | null>(() => {
    const data = tree.value
    if (!data) return null
    return data.chapters.length === 0 ? null : data
  })

  /** 拉整棵树 */
  function load(): Promise<void> {
    const id = courseId()
    if (id == null) {
      tree.value = null
      return Promise.resolve()
    }
    return withLoading(async () => {
      try {
        const res = await fetchChapterTree(id)
        tree.value = res.data
      } catch (e) {
        if (!isReportedError(e)) {
          message.error((e as Error).message || t('coursework.common.loadFail'))
        }
        tree.value = null
      }
    })
  }

  // 换课先清空再拉:否则旧课的树会停在新课的标题下,直到新数据回来
  watch(
    courseId,
    () => {
      tree.value = null
      void load()
    },
    { immediate: true },
  )

  return { tree, visibleTree, loading, reload: load }
}
