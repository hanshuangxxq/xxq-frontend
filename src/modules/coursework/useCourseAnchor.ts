import { computed, ref } from 'vue'

/**
 * 授课组锚点(对接文档 §1.6)。
 *
 * 同一门课由同一位教师、在同一学期、给同一个班级名,可能在 teach_info 里对应**多行**
 * (多个上课时段);课业内容只挂在**锚点行**(组内最小 id)上,但**请求时可以传任意一行**
 * —— 服务端会归一。不过**响应里回带的一律是锚点行 id**,文档要求后续请求改用返回的这个,
 * 否则可能与内容对不上。
 *
 * 这里把它落成一个「不触发重新加载」的本地 id:选择器给的 id 变了就自动回到它,
 * 请求拿到响应后再 `adopt()` 收敛到锚点。
 *
 * 刻意**不**回写进选择器的 `v-model` —— 那会让每个 Tab 的 courseId watcher 再跑一遍,
 * 白白多拉一轮全量数据;锚点与传入 id 在服务端等价,回写的意义是口径统一而非纠错。
 */
export function useCourseAnchor(courseId: () => number | null) {
  /**
   * 已采纳的锚点。**连同它所属的课程一起记** —— 换课后立刻失效,
   * 不需要靠 watcher 去重置(那会依赖「composable 的 watcher 比调用方的先跑」这种顺序假设)。
   */
  const adopted = ref<{ course: number; anchor: number } | null>(null)

  /** 当前应当用于请求的 id:本课程采纳过锚点就用锚点,否则用选择器原值 */
  const anchorId = computed<number | null>(() => {
    const current = courseId()
    if (current == null) return null
    const hit = adopted.value
    return hit && hit.course === current ? hit.anchor : current
  })

  /** 采纳响应里回带的 teachInfoId(锚点行 id),此后的请求一律用它 */
  function adopt(returned: number | null | undefined): void {
    const current = courseId()
    if (current == null || returned == null || returned === current) return
    adopted.value = { course: current, anchor: returned }
  }

  return { anchorId, adopt }
}
