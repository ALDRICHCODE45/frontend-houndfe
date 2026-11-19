/**
 * Who the cashier can hand cash to (S6, handoff 25 §1).
 *
 * `GET /cash-handovers/recipients?kind=WITHDRAWAL|FLOAT` lists the active
 * members of the sucursal whose role grants the receipt, with `displayName` and
 * `roleName` — no email and no `read:User`. It is gated by the sender's own
 * `create:CashHandover` (`canListRecipients`). WITHDRAWAL already excludes the
 * caller; FLOAT includes them when they may receive. The list is a hint: the
 * declaration and the receipt still run the authoritative checks.
 *
 * Each kind has its own principal-scoped slot
 * (`cashQueryKeys.recipients(identity, kind)`), so a user or permission switch
 * never reuses another principal's list. `active` lets the view read only while
 * the handover task is open.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { cashApi } from '../api/cash.api'
import type { CashHandoverKind, CashHandoverRecipient } from '../interfaces/cash.types'
import { cashQueryKeys } from './cashQueryKeys'
import { useCashAccess } from './useCashAccess'

export interface CashRecipientsState {
  items: CashHandoverRecipient[]
  loading: boolean
  error: boolean
}

export function useCashHandoverRecipients(
  options: { active?: MaybeRefOrGetter<boolean> } = {},
) {
  const access = useCashAccess()
  const allowed = computed(() => access.canListRecipients.value)
  const enabled = computed(
    () =>
      allowed.value &&
      access.identityReady.value &&
      access.permissionsLoaded.value &&
      (options.active === undefined ? true : toValue(options.active)),
  )

  function recipientsQuery(kind: CashHandoverKind) {
    return useQuery<CashHandoverRecipient[]>({
      queryKey: computed(() => cashQueryKeys.recipients(access.identity.value, kind)),
      queryFn: () => cashApi.listHandoverRecipients(kind),
      enabled,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    })
  }

  const queries = { FLOAT: recipientsQuery('FLOAT'), WITHDRAWAL: recipientsQuery('WITHDRAWAL') }

  function stateOf(kind: CashHandoverKind): CashRecipientsState {
    const query = queries[kind]
    return {
      items: query.data.value ?? [],
      loading: enabled.value && query.isLoading.value,
      error: query.isError.value,
    }
  }

  const state = computed<Record<CashHandoverKind, CashRecipientsState>>(() => ({
    FLOAT: stateOf('FLOAT'),
    WITHDRAWAL: stateOf('WITHDRAWAL'),
  }))

  return {
    allowed,
    state,
    refetch: (kind: CashHandoverKind) => queries[kind].refetch(),
  }
}
