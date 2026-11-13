/**
 * Realtime configuration.
 *
 * `VITE_REALTIME_SSE` turns the SSE stream on. It is OFF by default: until the
 * production Traefik/Swarm check of handoff 17 passes, polling stays the source
 * of truth. Only the strings `true` / `1` (any case) enable it.
 */

type EnvLike = Record<string, unknown>

export function isRealtimeEnabled(env: EnvLike = import.meta.env as EnvLike): boolean {
  const raw = env.VITE_REALTIME_SSE
  if (typeof raw !== 'string') return false
  const value = raw.trim().toLowerCase()
  return value === 'true' || value === '1'
}

/** Same base URL the API client (`core/shared/api/http.ts`) is built with. */
export function getRealtimeBaseUrl(env: EnvLike = import.meta.env as EnvLike): string {
  return (env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000'
}
