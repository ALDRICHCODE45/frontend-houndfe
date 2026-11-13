import { watch } from 'vue'
import { getRealtimeService } from './useRealtime'
import type { RealtimeService } from './realtime-service'

/** The slice of the auth store the lifecycle reads (kept structural: core must not own the store). */
export interface RealtimeAuthState {
  isAuthenticated: boolean
  user: { id: string } | null
  currentTenantId: string
  /**
   * When present, the stream only runs for a user who can `read:ChatbotRequest` (the stream answers
   * `403` otherwise, and every event on it is about chatbot requests or the person's notices):
   * everyone else keeps polling. Absent: no permission gate. Method syntax on purpose, so a store
   * whose `userCan` takes narrower action / subject unions still fits.
   */
  userCan?(action: string, subject: string): boolean
}

/** What the stream needs to be allowed: the same permission as the inbox (handoff 17 §1). */
const STREAM_PERMISSION = ['read', 'ChatbotRequest'] as const

/**
 * Start the stream while a user with a tenant (and `read:ChatbotRequest`) is signed in, stop it on logout,
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
    () =>
      [
        auth.isAuthenticated,
        auth.user?.id ?? '',
        auth.currentTenantId,
        auth.userCan ? auth.userCan(...STREAM_PERMISSION) : true,
      ] as const,
    ([authenticated, userId, tenantId, allowed]) => {
      if (authenticated && userId && tenantId && allowed) service.start({ userId, tenantId })
      else service.stop()
    },
    { immediate: true, flush: 'sync' },
  )
  return () => {
    stopWatching()
    service.stop()
  }
}
