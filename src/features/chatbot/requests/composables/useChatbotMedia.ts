import { computed, inject, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import { chatbotConversationApi } from '../api/chatbot-conversation.api'
import { chatbotMediaKeys } from '../constants/queryKeys'
import { MEDIA_PURGED_COPY, mediaErrorMessage } from '../utils/conversation-copy'
import { ATTENDEE_MEDIA_KEY } from './liveChatContext'
import { useRequestAccess } from './useRequestAccess'

/** A media file never changes: keep the blob for a long time and never refetch it on its own. */
export const MEDIA_STALE_MS = 60 * 60_000

export interface UseChatbotMediaOptions {
  /** Fetch only when true (a PDF opens on click, a voice note on press); default true. */
  enabled?: MaybeRefOrGetter<boolean>
  /** The message already says the 12-month retention deleted it: do not ask. */
  purged?: MaybeRefOrGetter<boolean>
  /**
   * The viewer is the attendee of the live session: the proxy serves them the files of their session
   * without `read:ChatbotConversation` (handoff 20 §3b). Defaults to what the conversation block provides.
   */
  asAttendee?: MaybeRefOrGetter<boolean>
}

/**
 * One authenticated media file (handoff 18 §3). The route needs the Bearer token, so the file is
 * fetched as a Blob through the shared `http` (cached per tenant and media id) and each consumer
 * gets its own `blob:` object URL, revoked when the media id changes or the component unmounts.
 */
export function useChatbotMedia(
  mediaId: MaybeRefOrGetter<string | null | undefined>,
  options: UseChatbotMediaOptions = {},
) {
  const auth = useAuthStore()
  const { tenantId, enabled: canReadRequest } = useRequestAccess()
  const provided = inject(ATTENDEE_MEDIA_KEY, null)
  const attendee = computed(() => (options.asAttendee ? toValue(options.asAttendee) : (provided?.value ?? false)))
  const id = computed(() => toValue(mediaId)?.trim() ?? '')
  const knownPurged = computed(() => (options.purged ? toValue(options.purged) : false))
  const enabled = computed(
    () =>
      canReadRequest.value &&
      (auth.userCan('read', 'ChatbotConversation') || attendee.value) &&
      id.value.length > 0 &&
      !knownPurged.value &&
      (options.enabled ? toValue(options.enabled) : true),
  )

  const query = useQuery({
    queryKey: computed(() => chatbotMediaKeys.file(tenantId.value, id.value)),
    queryFn: ({ signal }) => chatbotConversationApi.getMedia(id.value, { signal }),
    enabled,
    staleTime: MEDIA_STALE_MS,
    gcTime: MEDIA_STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const url = ref<string | null>(null)
  watch(
    () => (enabled.value ? query.data.value : undefined),
    (blob, _previous, onCleanup) => {
      if (!(blob instanceof Blob)) {
        url.value = null
        return
      }
      const objectUrl = URL.createObjectURL(blob)
      url.value = objectUrl
      onCleanup(() => URL.revokeObjectURL(objectUrl))
    },
    { immediate: true },
  )

  const failure = computed(() => (enabled.value && query.isError.value ? query.error.value : null))
  const isPurged = computed(
    () => knownPurged.value || (failure.value !== null && readApiErrorEnvelope(failure.value).status === 410),
  )
  const errorMessage = computed<string | null>(() => {
    if (knownPurged.value) return MEDIA_PURGED_COPY
    return failure.value ? mediaErrorMessage(failure.value) : null
  })

  return {
    url,
    blob: computed(() => (enabled.value ? (query.data.value ?? null) : null)),
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isError: computed(() => knownPurged.value || failure.value !== null),
    isPurged,
    errorMessage,
    refetch: () => query.refetch(),
  }
}
