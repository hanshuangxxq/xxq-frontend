import { computed, ref, type ComputedRef } from 'vue'

export interface UseLoadingReturn {
  /** 是否有任务正在执行(并发安全,内部按计数实现) */
  loading: ComputedRef<boolean>
  /**
   * 执行异步任务并自动维护 loading 状态(等价于
   * `loading = true; try { await task() } finally { loading = false }`)。
   * 错误会继续抛出,由调用方按需 catch(已通过 api 层弹出的错误可直接忽略)。
   *
   * 用法:
   * ```ts
   * const { loading, withLoading } = useLoading()
   * const loadData = () => withLoading(async () => {
   *   const res = await fetchGrades()
   *   data.value = res.data
   * })
   * ```
   * 模板中绑定 `:loading="loading"`(NDataTable/NButton)或 `<NSpin :show="loading">`。
   */
  withLoading: <T>(task: () => Promise<T>) => Promise<T>
}

/** 页面/区块级加载状态:配合 NSpin、NDataTable、NButton 的 loading 属性使用 */
export function useLoading(): UseLoadingReturn {
  const pending = ref(0)
  const loading = computed(() => pending.value > 0)

  async function withLoading<T>(task: () => Promise<T>): Promise<T> {
    pending.value++
    try {
      return await task()
    } finally {
      pending.value--
    }
  }

  return { loading, withLoading }
}
