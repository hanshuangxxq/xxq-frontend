import { ref } from 'vue'

/**
 * 全局加载状态管理器:所有后端请求(经 @/shared/api)自动注册到这里,
 * 页面不再需要为「等待后端数据」手写任何加载状态。
 *
 * 显示策略:
 * - 请求在 SHOW_DELAY 内完成 -> 不显示任何提示(快加载用户无感知)
 * - 超过 SHOW_DELAY -> 显示全局加载指示(含取消按钮)
 * - 一旦显示,至少停留 MIN_VISIBLE,避免一闪而过
 *
 * 取消:cancelAllRequests() 中止全部在途请求,并立即隐藏指示。
 */

const SHOW_DELAY = 300
const MIN_VISIBLE = 500

/** 全局加载指示是否可见(供 GlobalLoading 组件绑定) */
export const loadingVisible = ref(false)
/** 当前在途请求数(仅观测用,如调试) */
export const pendingRequests = ref(0)

let showTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
let shownAt = 0
const controllers = new Set<AbortController>()

/** 请求开始时注册(仅 @/shared/api 调用) */
export function beginManagedRequest(controller: AbortController): void {
  controllers.add(controller)
  pendingRequests.value++
  if (hideTimer !== undefined) {
    clearTimeout(hideTimer)
    hideTimer = undefined
  }
  if (loadingVisible.value || showTimer !== undefined) return
  showTimer = setTimeout(() => {
    showTimer = undefined
    if (pendingRequests.value > 0) {
      loadingVisible.value = true
      shownAt = Date.now()
    }
  }, SHOW_DELAY)
}

/** 请求结束时注销(仅 @/shared/api 调用,成功/失败/取消都会走到) */
export function endManagedRequest(controller: AbortController): void {
  controllers.delete(controller)
  pendingRequests.value = Math.max(0, pendingRequests.value - 1)
  if (pendingRequests.value > 0) return
  if (showTimer !== undefined) {
    clearTimeout(showTimer)
    showTimer = undefined
  }
  if (!loadingVisible.value) return
  const elapsed = Date.now() - shownAt
  if (elapsed >= MIN_VISIBLE) {
    loadingVisible.value = false
  } else {
    hideTimer = setTimeout(() => {
      loadingVisible.value = false
      hideTimer = undefined
    }, MIN_VISIBLE - elapsed)
  }
}

/** 取消全部在途请求:中止 fetch 并立即收起加载指示 */
export function cancelAllRequests(): void {
  for (const controller of controllers) controller.abort()
  if (showTimer !== undefined) {
    clearTimeout(showTimer)
    showTimer = undefined
  }
  if (hideTimer !== undefined) {
    clearTimeout(hideTimer)
    hideTimer = undefined
  }
  loadingVisible.value = false
}
