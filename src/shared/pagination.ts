import type { PageResult, Result } from './types'

/**
 * 分页接口「拉全量」辅助：循环翻页直到取完所有记录。
 *
 * 仅供「必须拥有全量数据」的场景使用（如客户端聚合统计、对比图表、
 * 需按名做 id 反查等）。普通列表请直接用服务端分页（NDataTable remote）。
 *
 * 每次请求仍受后端单页上限（100）约束，仅是分块拉取，非单次大查询。
 *
 * @param fetchPage 取一页的函数，返回 Result<PageResult<T>>
 * @param pageSize 每页条数，默认 100（后端上限）
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<Result<PageResult<T>>>,
  pageSize = 100,
): Promise<T[]> {
  const all: T[] = []
  let page = 1
  // 后端保证 pages/total 准确；用 records.length < pageSize 兜底末页
  while (true) {
    const res = await fetchPage(page, pageSize)
    const pr: PageResult<T> = res.data
    all.push(...pr.records)
    if (pr.records.length < pageSize || all.length >= pr.total) break
    page += 1
  }
  return all
}
