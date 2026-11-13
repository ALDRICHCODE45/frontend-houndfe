/**
 * Default `RealtimeAuthPort`, built only from what the app already exports.
 *
 * - Token: `authStorage.getAccessToken()`, the same source `http.ts` reads.
 * - Refresh: `http.ts` keeps its refresh flight private (no exported
 *   `refreshSession`). To reuse that single flight (and its session-generation
 *   guards, rotation commit and `emitSessionExpired`) without editing it, a
 *   cheap authenticated GET goes through the exported `http` client: its 401
 *   interceptor refreshes once for everybody and replays the request, and the
 *   rotated token then sits in `authStorage`.
 */
import { http } from '@/core/shared/api/http'
import { authStorage } from '@/features/auth/services/auth-storage'
import type { RealtimeAuthPort } from './types'

/** Smallest authenticated read the API offers; any 401-guarded route would do. */
const REFRESH_PROBE_PATH = '/auth/me/permissions'

function isUnauthorized(error: unknown): boolean {
  return (error as { response?: { status?: number } } | null)?.response?.status === 401
}

export function createDefaultAuthPort(): RealtimeAuthPort {
  return {
    getAccessToken: () => authStorage.getAccessToken(),

    async refresh(staleToken) {
      const current = authStorage.getAccessToken()
      if (!current) return false
      // Another request already rotated the token since the stream used it.
      if (staleToken !== null && current !== staleToken) return true
      try {
        await http.get(REFRESH_PROBE_PATH)
      } catch (error) {
        // A refresh failure clears the session inside `http.ts`: stop.
        if (isUnauthorized(error) || !authStorage.getAccessToken()) return false
        // A network blip: the stream's own backoff will try again.
        return true
      }
      return authStorage.getAccessToken() !== null
    },
  }
}
