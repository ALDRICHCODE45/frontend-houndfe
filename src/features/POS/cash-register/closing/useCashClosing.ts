/**
 * Close + corte queries (T4, S5), TanStack Query like the other cash composables.
 *
 * Close command discipline (same as `useCashSessionCommands`):
 *   - one stable `Idempotency-Key` per ATTEMPT (actor + session + route + body),
 *     replayed on a retry after a failure and reset only after a confirmed
 *     success, so a lost response never creates a second close;
 *   - the full identity is captured before the request and re-checked after it:
 *     a result that belongs to a previous principal is discarded;
 *   - a second close while one is in flight is refused before any key or request.
 *
 * After a close, the session list/detail slots are invalidated (the session is
 * CLOSED now), the closings list too, and the corte detail is seeded from the
 * response (it is immutable).
 *
 * Reads are principal-scoped (tenant + user + permissions + session generation)
 * like every cash slot, and only run with `read:CashClosing`.
 */
import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useQueries, useQuery, useQueryClient } from '@tanstack/vue-query'
import { cashApi } from '../api/cash.api'
import type {
  CashClosing,
  CashClosingListParams,
  CashClosingListResponse,
} from '../interfaces/cash.types'
import { cashQueryKeys } from '../composables/cashQueryKeys'
import { useCashAccess } from '../composables/useCashAccess'
import { CashCommandBusyError, CashIdentityError } from '../composables/cashErrorCopy'
import { commandAttempt } from '../utils/cash-input'

export function useCashClose() {
  const access = useCashAccess()
  const queryClient = useQueryClient()
  const attempt = commandAttempt()
  const isClosing = ref(false)

  async function close(sessionId: string, notes?: string): Promise<CashClosing> {
    if (isClosing.value) throw new CashCommandBusyError()
    const captured = access.captureIdentity()
    if (!captured.tenantId || !captured.userId) throw new CashIdentityError('inactive')

    const trimmed = notes?.trim() ?? ''
    const body = trimmed ? { notes: trimmed } : {}
    const route = `POST:/cash-sessions/${sessionId}/close`
    const key = attempt.key(
      [captured.tenantId, captured.userId, captured.permissionFingerprint, sessionId, route].join('|'),
      body,
    )

    isClosing.value = true
    try {
      const closing = await cashApi.closeSession(sessionId, body, key)
      if (!access.isCurrentIdentity(captured)) throw new CashIdentityError('changed')
      attempt.reset()
      queryClient.setQueryData(cashQueryKeys.closingDetail(captured, closing.id), closing)
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: cashQueryKeys.sessionsListPrefix(captured) }),
          queryClient.invalidateQueries({
            queryKey: cashQueryKeys.sessionDetail(captured, sessionId),
          }),
          queryClient.invalidateQueries({ queryKey: cashQueryKeys.closingsListPrefix(captured) }),
        ])
      } catch {
        // Best effort: the close already succeeded; a refresh failure is not a close failure.
      }
      if (!access.isCurrentIdentity(captured)) throw new CashIdentityError('changed')
      return closing
    } finally {
      isClosing.value = false
    }
  }

  return { close, isClosing }
}

export function useCashClosingsList(params: MaybeRefOrGetter<CashClosingListParams>) {
  const access = useCashAccess()
  const current = computed<CashClosingListParams>(() => ({ ...toValue(params) }))

  const query = useQuery<CashClosingListResponse>({
    queryKey: computed(() => cashQueryKeys.closingsList(access.identity.value, current.value)),
    queryFn: () => cashApi.listClosings(current.value),
    enabled: computed(
      () =>
        access.canReadClosings.value &&
        access.identityReady.value &&
        access.permissionsLoaded.value,
    ),
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  })

  return {
    items: computed(() => query.data.value?.items ?? []),
    total: computed(() => query.data.value?.total ?? 0),
    isLoading: computed(() => query.isLoading.value),
    isFetching: computed(() => query.isFetching.value),
    isError: computed(() => query.isError.value),
    error: query.error,
    refetch: query.refetch,
  }
}

function closingDetailQuery(access: ReturnType<typeof useCashAccess>, id: string) {
  return {
    queryKey: cashQueryKeys.closingDetail(access.identity.value, id),
    queryFn: () => cashApi.getClosing(id),
    enabled:
      Boolean(id) &&
      access.canReadClosings.value &&
      access.identityReady.value &&
      access.permissionsLoaded.value,
    // A corte is frozen at close: it never changes.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  }
}

export function useCashClosingDetail(closingId: MaybeRefOrGetter<string | null>) {
  const access = useCashAccess()
  const query = useQuery<CashClosing>(computed(() => closingDetailQuery(access, toValue(closingId) ?? '')))

  return {
    closing: query.data,
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * The list items carry only `{ id, sessionId, folio, createdAt }`; the row's
 * register, cashier and difference come from each corte (cached and shared with
 * the detail, immutable). One read per visible row.
 */
export function useCashClosingSummaries(closingIds: MaybeRefOrGetter<string[]>) {
  const access = useCashAccess()
  const ids = computed(() => toValue(closingIds))
  const queries = useQueries({
    queries: computed(() => ids.value.map((id) => closingDetailQuery(access, id))),
  })

  const byId = computed(() => {
    const map = new Map<string, CashClosing>()
    for (const result of queries.value) {
      const closing = result.data as CashClosing | undefined
      if (closing) map.set(closing.id, closing)
    }
    return map
  })

  return { byId }
}
