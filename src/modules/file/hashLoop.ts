import { createSHA256 } from 'hash-wasm'
import { HASH_SLICE_SIZE } from './constants'

/**
 * 整文件流式 SHA-256 的实现体。
 *
 * 刻意保持零业务依赖(不 import api / i18n):本模块会被打进 Web Worker,
 * 带上 i18n 与全局加载管理器会让 worker 包体无谓地膨胀。
 */

/**
 * 中止时抛出的异常。刻意用内置 DOMException 而不是自定义错误类:
 * 调用方(sha256.ts)必须能判断「是不是被中止了」,而任何静态 import 都会
 * 把 hash-wasm 拽进主包(动态 import 就失去按需加载的意义)。
 * 用 DOMException + name='AbortError' 与 api 层对 fetch 中止的判定完全一致。
 */
function abortError(): DOMException {
  return new DOMException('hash aborted', 'AbortError')
}

/**
 * 顺序读取整个文件并流式计算 SHA-256。
 *
 * 为什么必须流式:crypto.subtle.digest 没有增量 API,唯一用法是一次性传入完整
 * ArrayBuffer —— 2GB 文件那样做必然 OOM。hash-wasm 提供增量 hasher,配合按片
 * 读取,内存占用恒定为一个 HASH_SLICE_SIZE。
 *
 * @param yieldBetweenSlices 主线程降级路径传 true,每片让出一次事件循环避免卡死渲染;
 *                           Worker 里传 false(worker 阻塞不影响界面)。
 */
export async function hashFileStreaming(
  file: File,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
  yieldBetweenSlices = false,
): Promise<string> {
  const hasher = await createSHA256()
  hasher.init()

  const total = file.size
  let offset = 0
  while (offset < total) {
    if (signal?.aborted) throw abortError()

    const end = Math.min(offset + HASH_SLICE_SIZE, total)
    const buffer = await file.slice(offset, end).arrayBuffer()
    hasher.update(new Uint8Array(buffer))

    offset = end
    onProgress?.(offset, total)
    if (yieldBetweenSlices) await new Promise((resolve) => setTimeout(resolve, 0))
  }

  if (signal?.aborted) throw abortError()
  return hasher.digest('hex')
}
