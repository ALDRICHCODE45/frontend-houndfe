import { computed, reactive } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { notificationPreferencesApi } from '../api/notification-preferences.api'
import { profileKeys } from '../constants/queryKeys'
import type {
  NotificationPreferenceKey,
  NotificationPreferences,
} from '../interfaces/profile.types'

function perKey(): Record<NotificationPreferenceKey, boolean> {
  return { emailEnabled: false, soundEnabled: false }
}

/**
 * The signed-in person's notification preferences (handoff 13 §3) and the optimistic toggle of
 * each one.
 *
 * Every row is independent: a toggle flips its own flag in the cache at once, PATCHes only that
 * field, keeps the server's answer for that field only (the response carries the other flag's
 * value as the server saw it, which may be older than the other row's pending change) and, on
 * failure, puts back only its own previous value. `saving` and `failed` are per row. A toggle
 * on a row that is still saving is ignored.
 *
 * Plain async instead of `useMutation`: two rows can be in flight together, and a single
 * mutation observer reports only the latest call.
 */
export function useNotificationPreferences() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  const userId = computed(() => auth.user?.id ?? '')
  const enabled = computed(() => userId.value.length > 0)
  const queryKey = computed(() => profileKeys.notificationPreferences(userId.value))

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => notificationPreferencesApi.get({ signal }),
    enabled,
    staleTime: 30_000,
    retry: false,
  })

  const saving = reactive(perKey())
  const failed = reactive(perKey())

  function patchCache(
    key: readonly unknown[],
    flag: NotificationPreferenceKey,
    value: boolean,
  ): void {
    queryClient.setQueryData<NotificationPreferences>(key, (old) =>
      old ? { ...old, [flag]: value } : old,
    )
  }

  async function toggle(flag: NotificationPreferenceKey): Promise<void> {
    const current = query.data.value
    if (!current || saving[flag]) return

    const cacheKey = queryKey.value
    const previous = current[flag]
    const next = !previous

    failed[flag] = false
    saving[flag] = true
    // A refetch landing mid-save would overwrite the optimistic value with the old one.
    void queryClient.cancelQueries({ queryKey: cacheKey })
    patchCache(cacheKey, flag, next)

    try {
      const saved = await notificationPreferencesApi.patch({ [flag]: next })
      patchCache(cacheKey, flag, saved[flag])
    } catch {
      patchCache(cacheKey, flag, previous)
      failed[flag] = true
    } finally {
      saving[flag] = false
    }
  }

  return {
    preferences: computed(() => (enabled.value ? (query.data.value ?? null) : null)),
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isError: computed(() => enabled.value && query.isError.value),
    refetch: () => query.refetch(),
    saving,
    failed,
    toggle,
  }
}
