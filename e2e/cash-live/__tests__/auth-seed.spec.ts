// @vitest-environment jsdom
/**
 * Tests for the actor auth seeding (`../support/auth-seed.ts`).
 *
 * The seeding must reproduce the EXISTING `hound.auth.*` localStorage contract
 * (keys reused read-only from `e2e/responsive/fixtures/auth.ts`) from a
 * backend-issued validated fixture actor. This fixture is ACCESS-ONLY: the
 * owned backend issues no refresh token and no OTP, so the seed must never
 * write `hound.auth.refreshToken` / `hound.auth.tempToken` and must never
 * invent a token value.
 *
 * The hydration proof drives the REAL public store (`useAuthStore`) through
 * `hydrateFromStorage`, so it needs `jsdom` localStorage and the app `@` alias
 * in whatever config discovers this file. All fixtures here are synthetic
 * (never the real backend fixture file) and every value is validated through
 * the real `validateCashLiveFixture` contract before it is used.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { AUTH_STORAGE_KEYS } from '../../responsive/fixtures/auth'
import { useAuthStore } from '../../../src/features/auth/stores/useAuthStore'
import {
  AUTH_SEED_ABSENT_KEYS,
  actorPermissions,
  buildActorAuthSeed,
  buildActorAuthSeedPlan,
} from '../support/auth-seed'
import {
  validateCashLiveFixture,
  type CashLiveFixtureBinding,
  type ValidatedCashLiveFixture,
} from '../support/fixture'

const BINDING: CashLiveFixtureBinding = {
  backendUrl: 'http://127.0.0.1:8081/api/v1',
  frontendOrigin: 'http://127.0.0.1:4189',
}

const RESOURCE_ID = 'aaaaaaaa-0000-4000-8000-000000000001'

const TENANT_A = { id: 'tenant-a-id', name: 'Tenant A', slug: 'tenant-a' }
const TENANT_B = { id: 'tenant-b-id', name: 'Tenant B', slug: 'tenant-b' }

const actorUser = (id: string, email: string, name: string) => ({
  id,
  email,
  name,
  isActive: true,
  createdAt: '2025-06-01T00:00:00.000Z',
})

const actor = (
  role: 'cashier' | 'verifier' | 'foreign',
  tenant: { id: string; name: string; slug: string },
  permissionCodes: string[],
  accessToken: string,
) => ({
  userId: `user-${role}-id`,
  tenantId: tenant.id,
  email: `${role}@cash-live.test`,
  permissionCodes,
  accessToken,
  functionalRole: role,
  user: actorUser(`user-${role}-id`, `${role}@cash-live.test`, `Actor ${role}`),
  tenant,
  memberships: [
    { tenantId: tenant.id, tenantName: tenant.name, tenantSlug: tenant.slug, roleName: 'owner' },
  ],
  expiresAt: '2025-06-01T02:00:00.000Z',
  ttlSeconds: 7200,
})

/** Synthetic access-only fixture matching the actual backend schema. */
const validFixture = () => ({
  schemaVersion: 1,
  backend: { url: BINDING.backendUrl, basePath: '', resourceId: RESOURCE_ID },
  frontendOrigin: BINDING.frontendOrigin,
  tenants: [TENANT_A, TENANT_B],
  actors: {
    cashier: actor(
      'cashier',
      TENANT_A,
      ['read:CashRegister', 'create:CashSession'],
      'synthetic-access-token-0001',
    ),
    verifier: actor(
      'verifier',
      TENANT_A,
      ['read:CashRegister', 'read:CashSessionAudit'],
      'synthetic-access-token-0002',
    ),
    foreign: actor('foreign', TENANT_B, ['read:Sale'], 'synthetic-access-token-0003'),
  },
  metadata: {
    owner: 'cash-live-harness',
    backendHEAD: 'a29a61404eff4d98e333613b1691d1c01528d600',
    resourceId: RESOURCE_ID,
    generatedAt: '2025-06-01T00:00:00.000Z',
    readiness: {
      seeded: true,
      tenants: 2,
      users: 3,
      permissionsSeeded: 5,
      accessTokensIssued: 3,
    },
    cleanup: { owner: 'backend', drops: ['pg', 'server'] },
    accessOnly: true,
    refreshTokenIssued: false,
    otpIssued: false,
  },
})

const fixture: ValidatedCashLiveFixture = validateCashLiveFixture(validFixture(), BINDING)
const [cashier, verifier] = fixture.actors

const seed = () => buildActorAuthSeed(cashier!)
const entriesOf = (actorSeed: readonly { key: string; value: string }[]) =>
  Object.fromEntries(actorSeed.map((entry) => [entry.key, entry.value]))

describe('buildActorAuthSeed — existing storage contract from a validated backend fixture', () => {
  it('never emits a refresh token (backend issues access-only tokens)', () => {
    const keys = seed().map((entry) => entry.key)
    expect(keys).not.toContain(AUTH_STORAGE_KEYS.refreshToken)
    expect(seed().find((entry) => entry.key === AUTH_STORAGE_KEYS.refreshToken)).toBeUndefined()
  })

  it('does not emit the tenant-selection temp token', () => {
    const keys = seed().map((entry) => entry.key)
    expect(keys).not.toContain(AUTH_STORAGE_KEYS.tempToken)
  })

  it('emits exactly the identity/permission keys of the existing contract', () => {
    const keys = seed()
      .map((entry) => entry.key)
      .sort()
    expect(keys).toEqual(
      [
        AUTH_STORAGE_KEYS.accessToken,
        AUTH_STORAGE_KEYS.user,
        AUTH_STORAGE_KEYS.permissionCodes,
        AUTH_STORAGE_KEYS.currentTenant,
        AUTH_STORAGE_KEYS.memberships,
        AUTH_STORAGE_KEYS.isSuperAdmin,
      ].sort(),
    )
  })

  it('uses the backend-issued access token verbatim', () => {
    expect(entriesOf(seed())[AUTH_STORAGE_KEYS.accessToken]).toBe('synthetic-access-token-0001')
  })

  it('serializes the user, tenant, memberships and permissions as the app expects', () => {
    const entries = entriesOf(seed())
    expect(JSON.parse(entries[AUTH_STORAGE_KEYS.user]!)).toEqual(cashier!.user)
    expect(JSON.parse(entries[AUTH_STORAGE_KEYS.currentTenant]!)).toEqual(TENANT_A)
    expect(JSON.parse(entries[AUTH_STORAGE_KEYS.memberships]!)).toEqual([TENANT_A])
    expect(JSON.parse(entries[AUTH_STORAGE_KEYS.permissionCodes]!)).toEqual([
      'read:CashRegister',
      'create:CashSession',
    ])
    expect(entries[AUTH_STORAGE_KEYS.isSuperAdmin]).toBe('false')
  })

  it('supports distinct actors for distinct isolated browser contexts', () => {
    const verifierEntries = entriesOf(buildActorAuthSeed(verifier!))
    const cashierEntries = entriesOf(seed())
    expect(cashierEntries[AUTH_STORAGE_KEYS.accessToken]).not.toBe(
      verifierEntries[AUTH_STORAGE_KEYS.accessToken],
    )
    expect(JSON.parse(verifierEntries[AUTH_STORAGE_KEYS.user]!).id).toBe('user-verifier-id')
  })
})

describe('buildActorAuthSeedPlan — explicit absence of refresh/temp keys', () => {
  it('clears the refresh and temp keys in an isolated context', () => {
    expect(buildActorAuthSeedPlan(cashier!).remove).toEqual([
      AUTH_STORAGE_KEYS.refreshToken,
      AUTH_STORAGE_KEYS.tempToken,
    ])
    expect(AUTH_SEED_ABSENT_KEYS).toContain(AUTH_STORAGE_KEYS.refreshToken)
    expect(AUTH_SEED_ABSENT_KEYS).toContain(AUTH_STORAGE_KEYS.tempToken)
  })

  it('never invents a token: the only token written is the fixture access token', () => {
    const tokenEntries = buildActorAuthSeedPlan(cashier!).set.filter((entry) =>
      entry.key.toLowerCase().includes('token'),
    )
    expect(tokenEntries).toEqual([
      { key: AUTH_STORAGE_KEYS.accessToken, value: 'synthetic-access-token-0001' },
    ])
  })
})

describe('seeded storage hydrates the REAL auth store (public API)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setActivePinia(createPinia())
  })

  it('restores the access-only actor session from a clean isolated context', () => {
    for (const { key, value } of buildActorAuthSeed(cashier!))
      window.localStorage.setItem(key, value)

    const store = useAuthStore()
    store.hydrateFromStorage()

    expect(store.isAuthenticated).toBe(true)
    expect(store.accessToken).toBe('synthetic-access-token-0001')
    expect(store.refreshToken).toBeNull()
    expect(store.tempToken).toBeNull()
    expect(store.user).toEqual(cashier!.user)
    expect(store.currentTenant).toEqual(TENANT_A)
    expect(store.memberships).toEqual([TENANT_A])
    expect(store.permissionCodes).toEqual(['read:CashRegister', 'create:CashSession'])
    expect(store.authPhase).toBe('authenticated')
  })

  it('clears a stale refresh/temp token before hydration (no residual credential)', () => {
    window.localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, 'stale-refresh')
    window.localStorage.setItem(AUTH_STORAGE_KEYS.tempToken, 'stale-temp')
    const plan = buildActorAuthSeedPlan(cashier!)
    for (const key of plan.remove) window.localStorage.removeItem(key)
    for (const { key, value } of plan.set) window.localStorage.setItem(key, value)

    const store = useAuthStore()
    store.hydrateFromStorage()

    expect(store.refreshToken).toBeNull()
    expect(store.tempToken).toBeNull()
    expect(store.isAuthenticated).toBe(true)
  })
})

describe('actorPermissions — deterministic permission source for the journey', () => {
  it('returns the fixture permission codes of one actor', () => {
    expect(actorPermissions(cashier!)).toEqual(['read:CashRegister', 'create:CashSession'])
  })
})
