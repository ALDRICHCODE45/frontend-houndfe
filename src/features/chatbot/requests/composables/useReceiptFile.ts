import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { chatbotReceiptApi, receiptFilePath } from '../api/chatbot-receipt.api'
import { chatbotMediaKeys } from '../constants/queryKeys'
import { mediaErrorMessage } from '../utils/conversation-copy'
import { MEDIA_STALE_MS } from './useChatbotMedia'
import { useRequestAccess } from './useRequestAccess'

/** How long an opened original keeps its object URL alive, so the new tab can finish loading it. */
const ORIGINAL_URL_TTL_MS = 60_000

/** The new tab starts empty; it is only ever pointed at a `blob:` URL this page created. */
const EMPTY_TAB_URL = 'about:blank'

function isOwnObjectUrl(url: string): boolean {
  return url.startsWith(`blob:${window.location.origin}/`)
}

/**
 * The transfer receipt of a request (preview + original). The API streams both behind the Bearer
 * token and `read:ReceiptEvidence`, so neither can be a plain <img src> / <a href>: the preview is
 * fetched as a Blob and shown through an object URL (revoked on change or unmount), and the
 * original is fetched on click and opened in a new tab.
 */
export function useReceiptFile(
  previewUrl: MaybeRefOrGetter<string | null | undefined>,
  originalUrl: MaybeRefOrGetter<string | null | undefined>,
) {
  const auth = useAuthStore()
  const queryClient = useQueryClient()
  const { tenantId, enabled: canReadRequest } = useRequestAccess()
  const canRead = computed(() => canReadRequest.value && auth.userCan('read', 'ReceiptEvidence'))
  const previewPath = computed(() => receiptFilePath(toValue(previewUrl)))
  const originalPath = computed(() => receiptFilePath(toValue(originalUrl)))
  const previewEnabled = computed(() => canRead.value && previewPath.value !== null)

  const preview = useQuery({
    queryKey: computed(() => chatbotMediaKeys.receipt(tenantId.value, previewPath.value ?? '')),
    queryFn: ({ signal }) => {
      const path = previewPath.value
      if (!path) throw new Error('No receipt preview path')
      return chatbotReceiptApi.getFile(path, { signal })
    },
    enabled: previewEnabled,
    staleTime: MEDIA_STALE_MS,
    gcTime: MEDIA_STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const previewObjectUrl = ref<string | null>(null)
  watch(
    () => (previewEnabled.value ? preview.data.value : undefined),
    (blob, _previous, onCleanup) => {
      if (!(blob instanceof Blob)) {
        previewObjectUrl.value = null
        return
      }
      const objectUrl = URL.createObjectURL(blob)
      previewObjectUrl.value = objectUrl
      onCleanup(() => URL.revokeObjectURL(objectUrl))
    },
    { immediate: true },
  )

  const previewError = computed(() =>
    previewEnabled.value && preview.isError.value ? mediaErrorMessage(preview.error.value) : null,
  )

  const opening = ref(false)
  const originalError = ref<string | null>(null)

  /**
   * Opens the tab inside the click (popup blockers allow only that), then points it at the
   * downloaded blob. With the popup blocked, a temporary link opens it instead.
   */
  async function openOriginal(): Promise<void> {
    const path = originalPath.value
    if (!canRead.value || !path || opening.value) return
    opening.value = true
    originalError.value = null
    const tab = window.open(EMPTY_TAB_URL, '_blank')
    try {
      const blob = await queryClient.fetchQuery({
        queryKey: chatbotMediaKeys.receipt(tenantId.value, path),
        queryFn: () => chatbotReceiptApi.getFile(path, { signal: undefined }),
        staleTime: MEDIA_STALE_MS,
        gcTime: MEDIA_STALE_MS,
        retry: false,
      })
      const objectUrl = URL.createObjectURL(blob)
      if (!isOwnObjectUrl(objectUrl)) throw new Error('Unexpected object URL')
      if (tab) {
        tab.opener = null
        tab.location.href = objectUrl
      } else {
        const link = document.createElement('a')
        link.href = objectUrl
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.click()
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), ORIGINAL_URL_TTL_MS)
    } catch (error) {
      tab?.close()
      originalError.value = mediaErrorMessage(error)
    } finally {
      opening.value = false
    }
  }

  return {
    canRead,
    hasPreview: computed(() => previewPath.value !== null),
    hasOriginal: computed(() => originalPath.value !== null),
    previewUrl: previewObjectUrl,
    previewLoading: computed(() => previewEnabled.value && preview.isLoading.value),
    previewError,
    opening,
    originalError,
    openOriginal,
  }
}
