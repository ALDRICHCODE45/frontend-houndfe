import { ref, type Ref } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'
import { createRequestStores } from './liveStoreScope'

type RetriedSet = ReadonlySet<string>

/**
 * The messages the attendee already resent under a new id («Enviar como mensaje nuevo»), per
 * tenant + request. It lives next to the QueryClient (one per app, fresh per test), not in the
 * conversation block, so a remount of the block for the same request (the detail view swaps it while
 * the detail reloads) does not offer the resend again on a message that was already resent.
 */
const stores = createRequestStores<Ref<RetriedSet>>(
  () => ref<RetriedSet>(new Set()),
  (store) => store.value.size === 0,
)

/** Per signed-in user as well (see liveStoreScope); an empty set is pruned. */
export function retriedStoreFor(client: QueryClient, userId: string, tenantId: string, requestId: string): Ref<RetriedSet> {
  return stores.get(client, userId, tenantId, requestId)
}
