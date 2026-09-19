import { hashFileStreaming } from './hashLoop'

/**
 * 整文件 SHA-256 的 Worker 入口。
 *
 * 独立成 Worker 的原因:2GB 文件在主线程流式哈希会把界面冻住几十秒 ——
 * 恰好是用户最需要看到进度、最可能点取消的时候。
 *
 * 由 sha256.ts 以 `new Worker(new URL('./hashWorker.ts', import.meta.url))` 创建,
 * 必须产出真实文件而不能用 blob: URL —— 生产 CSP 的 default-src 'self' 会拦下 blob: worker。
 */

/** Worker 入参 */
interface HashRequest {
  file: File
}

/** Worker 出参 */
type HashResponse =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'done'; sha256: string }
  | { type: 'error'; message: string }

/**
 * 项目 tsconfig 用的是 DOM lib,没有 DedicatedWorkerGlobalScope,
 * 这里只声明实际用到的最小形态,避免为一个类型去改全局 lib 配置。
 */
const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<HashRequest>) => void) | null
  postMessage: (message: HashResponse) => void
}

workerScope.onmessage = async (event: MessageEvent<HashRequest>) => {
  const post = (message: HashResponse) => workerScope.postMessage(message)
  try {
    // 不传 signal:取消由主线程 terminate() 实现,worker 内无需感知
    const sha256 = await hashFileStreaming(event.data.file, (loaded, total) =>
      post({ type: 'progress', loaded, total }),
    )
    post({ type: 'done', sha256 })
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}
