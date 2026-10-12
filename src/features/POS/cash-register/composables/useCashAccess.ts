/**
 * Ability-derived gates AND the session-identity snapshot for the Caja subset.
 *
 * Permission rows are granular CASL abilities (`read|create|update` on the Cash
 * subjects), never named roles. The UI hides what the identity cannot do and
 * still handles the server-side `422 CASH_PERMISSION_DENIED` / `403`.
 *
 * Identity: cash visibility is principal-dependent (the same session detail is
 * a blind owner projection for the cashier and a wider audit projection for an
 * audit reader) and permission-dependent. So the feature scopes caches and
 * in-flight guards by `{ tenantId, userId, permissionFingerprint }`. The
 * fingerprint is derived from the store's existing `permissionCodes` — no auth
 * edit and no storage hack.
 *
 * Deliberate boundaries:
 *   - `read:CashHandover` is the dedicated recipient-custody read. It is NOT
 *     implied by `read:CashSessionAudit`, so custody discovery checks it alone.
 *   - `update:CashHandover` (receipt) is separate from `create:CashHandover`
 *     (outgoing custody + drawer release).
 *   - `read:CashSessionAudit` only WIDENS session list/detail scope. The UI never
 *     grants it; it reads the ability as-is to decide whether a `cashierUserId`
 *     filter or the other users' sessions may be shown.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { authStorage } from '@/features/auth/services/auth-storage'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'
import { cashPermissionFingerprint, isSameCashIdentity, type CashIdentity } from './cashRules'

export function useCashAccess() {
  const authStore = useAuthStore()

  function can(action: AppAction, subject: AppSubject): boolean {
    return authStore.userCan(action, subject)
  }

  /**
   * The real auth session lifecycle generation. `authStorage` is not reactive, so
   * it is re-read on every store transition that can accompany a session write
   * (login, logout, tenant switch, rotation). Same-session REFRESH keeps the
   * generation (see `commitRotation`), so a rotation does not churn caches.
   */
  const sessionGeneration = ref(authStorage.getSessionGeneration())
  watch(
    () => [
      authStore.accessToken,
      authStore.user?.id ?? null,
      authStore.currentTenantId,
      authStore.isSuperAdmin,
      authStore.permissionCodes,
    ],
    () => {
      sessionGeneration.value = authStorage.getSessionGeneration()
      // The auth store publishes its reactive refs BEFORE it writes storage, so a
      // synchronous read can observe the previous generation. Re-read once the
      // synchronous transition has settled (cheap, bounded, not a poll).
      queueMicrotask(() => {
        sessionGeneration.value = authStorage.getSessionGeneration()
      })
      void nextTick(() => {
        sessionGeneration.value = authStorage.getSessionGeneration()
      })
    },
    { immediate: true, flush: 'sync' },
  )

  /** Complete principal + permission + session-lifecycle snapshot for cache/async scoping. */
  const identity = computed<CashIdentity>(() => ({
    tenantId: authStore.currentTenantId ?? '',
    userId: authStore.user?.id ?? '',
    permissionFingerprint: cashPermissionFingerprint(authStore.permissionCodes ?? []),
    generation: sessionGeneration.value,
  }))

  /** A principal is addressable only with BOTH a tenant and a user. */
  const identityReady = computed(() => Boolean(identity.value.tenantId && identity.value.userId))

  /**
   * Permissions must be resolved before building/reading a principal-scoped
   * cache slot: `userCan` reads an empty ability while they are unknown, so
   * gating on this avoids caching a slot for an unresolved permission set.
   */
  const permissionsLoaded = computed(() => authStore.permissionsLoaded === true)

  /**
   * Freeze the current identity before an async boundary. The session generation
   * is read LIVE so the snapshot cannot inherit a lagging reactive value.
   */
  function captureIdentity(): CashIdentity {
    return { ...identity.value, generation: authStorage.getSessionGeneration() }
  }

  /**
   * True while the captured snapshot still describes the active principal AND its
   * session lifecycle. Read LIVE (never from a cached computed) so it is safe as
   * the post-await re-check on every async continuation.
   */
  function isCurrentIdentity(captured: CashIdentity): boolean {
    if (captured.generation !== authStorage.getSessionGeneration()) return false
    return isSameCashIdentity(captured, {
      tenantId: authStore.currentTenantId ?? '',
      userId: authStore.user?.id ?? '',
      permissionFingerprint: cashPermissionFingerprint(authStore.permissionCodes ?? []),
      generation: captured.generation,
    })
  }

  return {
    identity,
    identityReady,
    permissionsLoaded,
    captureIdentity,
    isCurrentIdentity,
    currentUserId: computed<string | null>(() => authStore.user?.id ?? null),
    tenantId: computed<string>(() => authStore.currentTenantId ?? ''),

    canReadRegisters: computed(() => can('read', 'CashRegister')),
    canCreateRegister: computed(() => can('create', 'CashRegister')),
    canUpdateRegister: computed(() => can('update', 'CashRegister')),

    canReadSessions: computed(() => can('read', 'CashSession')),
    canAuditSessions: computed(() => can('read', 'CashSessionAudit')),
    canOpenSession: computed(() => can('create', 'CashSession')),

    canCount: computed(() => can('create', 'CashCount')),
    canCashIn: computed(() => can('create', 'CashIn')),
    canCashOut: computed(() => can('create', 'CashOut')),
    canVerify: computed(() => can('create', 'CashVerification')),

    canDeclareHandover: computed(() => can('create', 'CashHandover')),
    canReadCustody: computed(() => can('read', 'CashHandover')),
    canReceiveHandover: computed(() => can('update', 'CashHandover')),

    /**
     * Independent verification needs the verify command PLUS the wider session
     * read: the verifier is never the cashier, so the session detail is only
     * reachable with `read:CashSessionAudit`. The ability is derived, never
     * granted automatically.
     */
    canVerifyIndependent: computed(
      () =>
        can('create', 'CashVerification') &&
        can('read', 'CashSession') &&
        can('read', 'CashSessionAudit'),
    ),

    /** Any Caja-related read at all (used for the empty access state). */
    canAnyCashRead: computed(
      () =>
        can('read', 'CashRegister') ||
        can('read', 'CashSession') ||
        can('read', 'CashSessionAudit') ||
        can('read', 'CashHandover'),
    ),
  }
}
