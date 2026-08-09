import { reactive } from 'vue'

/**
 * 服务端分页表格的通用分页状态。
 *
 * 用法：
 * ```ts
 * const { pagination, reset } = useRemotePagination(loadData)
 * // loadData 内读取 pagination.page / pagination.pageSize 发请求，
 * // 并回写 pagination.itemCount = res.data.total
 * // 过滤条件变化时：reset(); loadData()
 * ```
 *
 * NDataTable 直接 `:remote` + `:pagination="pagination"`。
 */
export function useRemotePagination(
  onChange: () => void,
  opts: { pageSize?: number; pageSizes?: number[] } = {},
) {
  const pagination = reactive({
    page: 1,
    pageSize: opts.pageSize ?? 20,
    itemCount: 0,
    showSizePicker: true,
    pageSizes: opts.pageSizes ?? [10, 20, 50],
    prefix: ({ itemCount }: { itemCount: number | undefined }) => `共 ${itemCount ?? 0} 条`,
    onUpdatePage: (page: number) => {
      pagination.page = page
      onChange()
    },
    onUpdatePageSize: (pageSize: number) => {
      pagination.pageSize = pageSize
      pagination.page = 1
      onChange()
    },
  })

  /** 回到第 1 页（不触发 onChange，调用方需自行 loadData） */
  function reset(): void {
    pagination.page = 1
  }

  return { pagination, reset }
}
