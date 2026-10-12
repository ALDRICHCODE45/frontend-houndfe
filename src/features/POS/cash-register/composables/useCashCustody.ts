/**
 * Recipient custody discovery (`GET /cash-handovers/custody`).
 *
 * Scope is the JWT tenant + authenticated recipient; the route accepts only
 * `page`/`limit` and the client can never supply or widen the recipient. The
 * read needs `read:CashHandover` — which `read:CashSessionAudit` never
 * substitutes — so when the ability is absent the query does NOT run and the UI
 * shows an access state instead of a misleading empty page.
 *
 * SECURITY: the cache slot is scoped by tenant + user + permission generation,
 * so a same-tenant user switch can never read the previous recipient's custody.
 *
 * `eligibleFloat` is a HINT, never a reservation: the authoritative amount,
 * reuse and source-drawer checks run again when a session is opened.
 */
import { computed, ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { cashApi } from '../api/cash.api'
import type { CashCustody } from '../interfaces/cash.types'
import { cashQueryKeys } from './cashQueryKeys'
import { useCashAccess } from './useCashAccess'

export function useCashCustody() {
  const access = useCashAccess()
  const allowed = computed(() => access.canReadCustody.value)
  const page = ref(1)
  const limit = ref(25)

  const query = useQuery<CashCustody>({
    queryKey: computed(() => cashQueryKeys.custody(access.identity.value, page.value, limit.value)),
    queryFn: () => cashApi.getCustody({ page: page.value, limit: limit.value }),
    enabled: computed(
      () => allowed.value && access.identityReady.value && access.permissionsLoaded.value,
    ),
    refetchOnWindowFocus: false,
    staleTime: 10_000,
  })

  return {
    allowed,
    page,
    limit,
    custody: query.data,
    pendingHandovers: computed(() => query.data.value?.pendingHandovers.items ?? []),
    eligibleFloat: computed(() => query.data.value?.eligibleFloat.items ?? []),
    pendingTotal: computed(() => query.data.value?.pendingHandovers.total ?? 0),
    eligibleTotal: computed(() => query.data.value?.eligibleFloat.total ?? 0),
    isLoading: computed(() => allowed.value && query.isLoading.value),
    isFetching: computed(() => query.isFetching.value),
    isError: computed(() => query.isError.value),
    error: query.error,
    refetch: query.refetch,
  }
}
