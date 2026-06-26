import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { accessToken, refreshAccessToken } from '@/shared/tokenManager'
import { avatarUrl } from '@/shared/utils/avatar'

export function useAvatar(
  filenameRef: Ref<string | null | undefined>,
): ComputedRef<string | undefined> {
  const blobUrl = ref<string>()

  async function load() {
    const old = blobUrl.value
    if (old) URL.revokeObjectURL(old)
    blobUrl.value = undefined

    const url = avatarUrl(filenameRef.value)
    if (!url) return

    try {
      const headers: Record<string, string> = {}
      if (accessToken.value) {
        headers['Authorization'] = `Bearer ${accessToken.value}`
      }

      let res = await fetch(url, { headers })

      if (res.status === 401) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          headers['Authorization'] = `Bearer ${accessToken.value}`
          res = await fetch(url, { headers })
        }
      }

      if (res.ok) {
        const blob = await res.blob()
        blobUrl.value = URL.createObjectURL(blob)
      }
    } catch {
      // leave blobUrl undefined so fallback text shows
    }
  }

  watch(filenameRef, load, { immediate: true })
  watch(accessToken, load)

  onUnmounted(() => {
    if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
  })

  return computed(() => blobUrl.value)
}
