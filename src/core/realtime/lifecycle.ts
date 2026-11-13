import { watch } from 'vue'
import { getRealtimeService } from './useRealtime'
import type { RealtimeService } from './realtime-service'

/** The slice of the auth store the lifecycle reads (kept structural: core must not own the store). */
export interface RealtimeAuthState {
  isAuthenticated: boolean
  user: { id: string } | null
  currentTenantId: string
}

/**
 * Start the stream while a user with a tenant is signed in, stop it on logout,
 * and restart it on a tenant (or user) switch. Reads state only; never writes.
 * With the flag off `service.start` is a no-op, so nothing connects.
 *
 * Returns a function that stops watching and stops the stream.
 */
export function startRealtimeLifecycle(
  auth: RealtimeAuthState,
  service: RealtimeService = getRealtimeService(),
): () => void {
  const stopWatching = watch(
    () => [auth.isAuthenticated, auth.user?.id ?? '', auth.currentTenantId] as const,
    ([authenticated, userId, tenantId]) => {
      if (authenticated && userId && tenantId) service.start({ userId, tenantId })
      else service.stop()
    },
    { immediate: true, flush: 'sync' },
  )
  return () => {
    stopWatching()
    service.stop()
  }
}
