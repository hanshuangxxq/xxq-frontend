import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { api } from '@/shared/api'
import { accessToken } from '@/shared/tokenManager'
import { avatarUrl } from '@/shared/utils/avatar'

/**
 * 头像加载 composable:把头像文件名(或外部 URL)解析为可展示的 blob URL。
 * - 后端头像走统一 api 管线(带认证),外部直链直接 fetch
 * - 失败静默:保留上一次已加载的头像,不弹错误、不触发全局加载条
 * - 自动跟随 filenameRef 与 accessToken 变化重载,卸载时释放 blob URL
 *
 * @param filenameRef 头像文件名(后端返回的 filename)或外部 URL 的响应式引用
 * @returns 可直接绑定到 img/NAvatar src 的 blob URL(未加载完成时为 undefined)
 */
export function useAvatar(
  filenameRef: Ref<string | null | undefined>,
): ComputedRef<string | undefined> {
  const blobUrl = ref<string>()

  async function load() {
    const url = avatarUrl(filenameRef.value)
    if (!url) {
      const old = blobUrl.value
      if (old) URL.revokeObjectURL(old)
      blobUrl.value = undefined
      return
    }

    try {
      let blob: Blob
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
        // 外部直链(非后端接口),直接拉取
        const res = await fetch(url)
        if (!res.ok) return
        blob = await res.blob()
      } else {
        // 后端头像接口(/api/avatar/...):去掉 /api 前缀后走统一 api 管线(认证、401 刷新)。
        // 头像加载失败不弹错误提示、不触发全局加载条
        blob = await api.getBlob(url.replace(/^\/api/, ''), { silent: true, loading: false })
      }
      const old = blobUrl.value
      blobUrl.value = URL.createObjectURL(blob)
      if (old) URL.revokeObjectURL(old)
    } catch {
      // leave existing blobUrl so previously loaded avatar stays visible
    }
  }

  watch(filenameRef, load, { immediate: true })
  watch(accessToken, load)

  onUnmounted(() => {
    if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
  })

  return computed(() => blobUrl.value)
}
