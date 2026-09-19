import { RequestCancelledError } from '@/shared/api'

/** 哈希进度:已读取字节 / 总字节 */
export interface HashProgress {
  loaded: number
  total: number
}

/** ArrayBuffer -> 64 位小写十六进制 */
function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * 单片 SHA-256,用于 PUT 分片时的 X-Chunk-SHA256 头。
 *
 * 片大小 ≤ 8MB,一次性摘要即可,用原生 crypto.subtle:零额外依赖。
 * 两个约束:① crypto.subtle 需要安全上下文(HTTPS 或 localhost);
 * ② 必须在主线程算完再发 —— 传给 Worker 的 ArrayBuffer 会被 detach,
 * 那样就没法再作为请求体发送了。
 */
export function hashChunkSha256(buffer: ArrayBuffer): Promise<string> {
  return crypto.subtle.digest('SHA-256', buffer).then(toHex)
}

/** Worker 回传消息 */
type HashWorkerResponse =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'done'; sha256: string }
  | { type: 'error'; message: string }

/** Worker 脚本本身加载失败(而非哈希失败),此种情况降级到主线程 */
class WorkerUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkerUnavailableError'
  }
}

/**
 * 流式计算整文件 SHA-256,作为 init 的 sha256 参数(决定秒传与完整性校验)。
 *
 * 优先在 Web Worker 中计算;Worker 构造失败或脚本加载失败时降级到主线程
 * (逐片让出)。注意降级救不了「CSP 未放行 wasm-unsafe-eval」——
 * 那种情况两条路径都会失败,表现为明确的哈希失败而不是无声卡死。
 */
export async function hashFileSha256(
  file: File,
  onProgress?: (progress: HashProgress) => void,
  signal?: AbortSignal,
): Promise<string> {
  let worker: Worker | null = null
  try {
    // 必须保持这个字面量形态,Vite 靠静态分析打包 worker;且不能加 type: 'module'
    worker = new Worker(new URL('./hashWorker.ts', import.meta.url))
  } catch {
    worker = null
  }

  if (worker) {
    try {
      return await runInWorker(worker, file, onProgress, signal)
    } catch (e) {
      // 只在「Worker 起不来」时降级;哈希本身失败再跑一遍主线程也是白费
      if (!(e instanceof WorkerUnavailableError)) {
        worker.terminate()
        throw e
      }
      worker.terminate()
    }
  }

  return runOnMainThread(file, onProgress, signal)
}

/** 在 Worker 中计算;仅 Worker 自身不可用时抛 WorkerUnavailableError */
function runInWorker(
  worker: Worker,
  file: File,
  onProgress?: (progress: HashProgress) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false
    /** 是否已收到过 worker 的消息 —— 用于区分「脚本没加载起来」与「哈希真的失败」 */
    let alive = false

    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      action()
    }
    const onAbort = () => finish(() => reject(new RequestCancelledError()))

    if (signal?.aborted) {
      finish(() => reject(new RequestCancelledError()))
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    worker.onmessage = (event: MessageEvent<HashWorkerResponse>) => {
      alive = true
      const data = event.data
      if (data.type === 'progress') {
        onProgress?.({ loaded: data.loaded, total: data.total })
      } else if (data.type === 'done') {
        finish(() => resolve(data.sha256))
      } else {
        finish(() => reject(new Error(data.message)))
      }
    }

    worker.onerror = (event) => {
      const message = event.message || 'hash worker failed to load'
      finish(() => reject(alive ? new Error(message) : new WorkerUnavailableError(message)))
    }

    worker.postMessage({ file })
  })
}

/** 主线程降级实现:与 Worker 内同一套循环,逐片让出事件循环 */
async function runOnMainThread(
  file: File,
  onProgress?: (progress: HashProgress) => void,
  signal?: AbortSignal,
): Promise<string> {
  // 动态导入:hash-wasm 只在真正需要时才加载,不进主包
  const { hashFileStreaming } = await import('./hashLoop')
  try {
    return await hashFileStreaming(
      file,
      (loaded, total) => onProgress?.({ loaded, total }),
      signal,
      true,
    )
  } catch (e) {
    // 与 api 层对 fetch 中止的判定保持一致(hashLoop 抛的是 DOMException)
    if (e instanceof DOMException && e.name === 'AbortError') throw new RequestCancelledError()
    throw e
  }
}
