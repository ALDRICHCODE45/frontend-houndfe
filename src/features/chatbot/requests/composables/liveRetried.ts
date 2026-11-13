import { ref, type Ref } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'

type RetriedSet = ReadonlySet<string>

/**
 * The messages the attendee already resent under a new id («Enviar como mensaje nuevo»), per
 * tenant + request. It lives next to the QueryClient (one per app, fresh per test), not in the
 * conversation block, so a remount of the block for the same request (the detail view swaps it while
 * the detail reloads) does not offer the resend again on a message that was already resent.
 */
const stores = new WeakMap<QueryClient, Map<string, Ref<RetriedSet>>>()

export function retriedStoreFor(client: QueryClient, tenantId: string, requestId: string): Ref<RetriedSet> {
  let byKey = stores.get(client)
  if (!byKey) {
    byKey = new Map()
    stores.set(client, byKey)
  }
  const key = `${tenantId}\u0000${requestId}`
  let store = byKey.get(key)
  if (!store) {
    store = ref<RetriedSet>(new Set())
    byKey.set(key, store)
  }
  return store
}
