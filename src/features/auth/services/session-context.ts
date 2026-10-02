import { computed, shallowRef, type ComputedRef } from 'vue'
import type { AuthTokens, TenantSummary } from '../interfaces/auth.types'
import { authStorage, type PreparedSessionWrite } from './auth-storage'

export interface SessionTenantContext {
  readonly tenant: Readonly<TenantSummary> | null
  readonly isSuperAdmin: boolean
}
export interface SessionSnapshot extends SessionTenantContext {
  readonly tokens: Readonly<AuthTokens> | null
  readonly generation: number
}
export interface PreparedSessionTransition {
  readonly generation: number
  isCurrent(): boolean
  commit(): boolean
}
export interface SessionContext {
  readonly state: ComputedRef<SessionSnapshot | null>
  prepareReplacement(
    tokens: AuthTokens,
    context: SessionTenantContext,
  ): PreparedSessionTransition | null
  prepareClear(): PreparedSessionTransition
}

/**
 * Unactivated foundation: one immutable publication, no hydration or rotation.
 * Callers must check the transition before EACH observable continuation; a check
 * around an aggregate callback cannot fence reentrant effects inside that callback.
 * External storage changes invalidate leases but do not auto-publish new state.
 */
export function createSessionContext(): SessionContext {
  const current = shallowRef<SessionSnapshot | null>(null)

  function transition(
    write: PreparedSessionWrite,
    value: Omit<SessionSnapshot, 'generation'>,
  ): PreparedSessionTransition {
    // Capture AFTER storage preparation; never adopt a generation after publication.
    const generation = write.generation
    const next = Object.freeze({ ...value, generation })
    let expected = current.value
    const isCurrent = () =>
      authStorage.getSessionGeneration() === generation && current.value === expected

    return Object.freeze({
      generation,
      isCurrent,
      commit(): boolean {
        if (!isCurrent() || !write.commit() || !isCurrent()) return false
        expected = next
        current.value = next
        // A synchronous watcher can replace, clear, or only invalidate storage.
        return isCurrent()
      },
    })
  }

  return {
    state: computed(() => current.value),
    prepareReplacement(tokens, context) {
      const credentials = Object.freeze({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      })
      const tenant =
        context.tenant === null
          ? null
          : Object.freeze({
              id: context.tenant.id,
              name: context.tenant.name,
              slug: context.tenant.slug,
              address: context.tenant.address,
              status: context.tenant.status,
              onShiftCount: context.tenant.onShiftCount,
            })
      const snapshot = { tenant, isSuperAdmin: context.isSuperAdmin }
      const write = authStorage.prepareContextReplacement(credentials, snapshot)
      return write ? transition(write, { ...snapshot, tokens: credentials }) : null
    },
    prepareClear() {
      return transition(authStorage.prepareClear(), {
        tokens: null,
        tenant: null,
        isSuperAdmin: false,
      })
    },
  }
}
