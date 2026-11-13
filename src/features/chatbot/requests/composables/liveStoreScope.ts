import { effectScope, shallowRef, watch } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'

/**
 * What the attendee's side of a live chat keeps per request (liveOutbox, liveRetried) lives next to the
 * QueryClient so a remount keeps it. That client is ONE per app: a tenant switch only calls
 * `queryClient.clear()` (which does not touch these stores) and a logout does not replace it at all.
 * A held «Texto no enviado» or an unconfirmed message of one person must never reach another one on the
 * same tab, so every store is scoped to the signed-in user and dropped when that user changes or signs out.
 */

/** Id of the signed-in user, `''` when nobody is (or the auth store is not available). */
export function signedInUserId(): string {
  try {
    return useAuthStore().user?.id ?? ''
  } catch {
    return ''
  }
}

/** Bumped every time the signed-in user changes or signs out: stores built before it are dropped. */
const sessionEpoch = shallowRef(0)
/** Bumped when empty entries were pruned, so whoever resolved a store re-resolves it. */
const pruneEpoch = shallowRef(0)
let watching = false

/** One module-level watcher (it must outlive any component): a logout drops the stores even with no chat mounted. */
function watchSession(): void {
  if (watching) return
  watching = true
  effectScope(true).run(() => {
    watch(
      signedInUserId,
      () => {
        sessionEpoch.value += 1
      },
      { flush: 'sync' },
    )
  })
}

interface Pruneable {
  /** Drops the empty entries of this client/user; reports whether any went. */
  prune(client: QueryClient, userId: string): boolean
}
const pruners = new Set<Pruneable>()

interface ClientRecord<T> {
  userId: string
  session: number
  byKey: Map<string, T>
}

/**
 * A per tenant + request store on a QueryClient, scoped to the signed-in user. Reading it from a
 * computed tracks the user session, so a user change makes the reader see a fresh, empty store.
 */
export function createRequestStores<T>(make: () => T, isEmpty: (value: T) => boolean) {
  const records = new WeakMap<QueryClient, ClientRecord<T>>()

  function recordFor(client: QueryClient, userId: string): ClientRecord<T> {
    watchSession()
    const session = sessionEpoch.value
    let record = records.get(client)
    if (!record || record.userId !== userId || record.session !== session) {
      record = { userId, session, byKey: new Map() }
      records.set(client, record)
    }
    return record
  }

  const stores: Pruneable = {
    prune(client, userId) {
      const record = records.get(client)
      if (!record || record.userId !== userId || record.session !== sessionEpoch.value) return false
      let removed = false
      for (const [key, value] of record.byKey) {
        if (!isEmpty(value)) continue
        record.byKey.delete(key)
        removed = true
      }
      return removed
    },
  }
  pruners.add(stores)

  return {
    get(client: QueryClient, userId: string, tenantId: string, requestId: string): T {
      // Read the prune counter too: after a prune a computed resolves again instead of keeping a dropped store.
      void pruneEpoch.value
      const record = recordFor(client, userId)
      const key = `${tenantId}\u0000${requestId}`
      let value = record.byKey.get(key)
      if (value === undefined) {
        value = make()
        record.byKey.set(key, value)
      }
      return value
    },
  }
}

/** Drops the entries that hold nothing (no unconfirmed message, held text, template in flight or resend mark). */
export function pruneLiveStores(client: QueryClient, userId: string): void {
  let removed = false
  for (const stores of pruners) removed = stores.prune(client, userId) || removed
  if (removed) pruneEpoch.value += 1
}
