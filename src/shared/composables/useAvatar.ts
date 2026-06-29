import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { accessToken, refreshAccessToken } from '@/shared/tokenManager'
import { avatarUrl } from '@/shared/utils/avatar'

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
        const old = blobUrl.value
        blobUrl.value = URL.createObjectURL(blob)
        if (old) URL.revokeObjectURL(old)
      }
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
