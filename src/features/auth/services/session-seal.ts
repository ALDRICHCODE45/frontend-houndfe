import { authStorage } from './auth-storage'

/** Generation sealed by `sealSession`; any later advance (clear, new login) makes it stale. */
let sealedGeneration: number | null = null

/**
 * Fence the session at the start of a logout without touching storage: advance the
 * generation (retiring every request and refresh of the old session) and mark the new one
 * sealed, so the HTTP layer neither sends nor refreshes anything for it. Returns the
 * sealed generation; the unused prepared clear is dropped.
 */
export function sealSession(): number {
  sealedGeneration = authStorage.prepareClear().generation
  return sealedGeneration
}

export function isSessionSealed(): boolean {
  return sealedGeneration !== null && sealedGeneration === authStorage.getSessionGeneration()
}

/** End the seal of `generation`; a seal of a newer generation is left alone. */
export function releaseSeal(generation: number): void {
  if (sealedGeneration === generation) sealedGeneration = null
}
