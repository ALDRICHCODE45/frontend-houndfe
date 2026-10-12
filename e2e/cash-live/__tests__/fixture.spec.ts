/**
 * Pure tests for the backend-issued auth fixture contract (`../support/fixture.ts`).
 *
 * The fixture JSON is emitted by the local backend session (fictitious actors,
 * backend-issued access-only tokens, permissions, memberships, declared
 * tenants and resource metadata). These tests prove fail-closed structural
 * validation against the ACTUAL backend schema, the ownership binding to the
 * declared env, internal identity bindings, path confinement at load time, and
 * that token values never leak into validation error messages. No files are
 * read from the project; the reader is injected.
 */
import { describe, expect, it, vi } from 'vitest'

import {
  CashLiveFixtureError,
  assertPathInside,
  loadCashLiveFixture,
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

/**
 * The permission set the owned backend intentionally issues to the UNUSED
 * verifier actor (backend seq15): the minimal cash verification/handover set
 * with no catalog/open ability, so no `read:CashRegister`. The fixture contract
 * must accept this actor.
 */
const MINIMAL_VERIFIER_PERMISSIONS = [
  'read:CashSession',
  'read:CashSessionAudit',
  'create:CashVerification',
  'read:CashHandover',
  'update:CashHandover',
] as const

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
      [...MINIMAL_VERIFIER_PERMISSIONS],
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

const withActor = (role: 'cashier' | 'verifier' | 'foreign', patch: Record<string, unknown>) => {
  const fixture = validFixture()
  return {
    ...fixture,
    actors: { ...fixture.actors, [role]: { ...fixture.actors[role], ...patch } },
  }
}

describe('validateCashLiveFixture — fail-closed structure (actual backend schema)', () => {
  it('rejects non-object and empty input', () => {
    for (const input of [null, undefined, 42, 'fixture', []]) {
      expect(() => validateCashLiveFixture(input, BINDING)).toThrow(CashLiveFixtureError)
    }
  })

  it('rejects a wrong schemaVersion', () => {
    expect(() => validateCashLiveFixture({ ...validFixture(), schemaVersion: 2 }, BINDING)).toThrow(
      /schemaVersion/,
    )
  })

  it('rejects the provisional binding/resourceIdentity shape', () => {
    expect(() =>
      validateCashLiveFixture({ schemaVersion: 1, binding: {}, actors: [] }, BINDING),
    ).toThrow(/backend|frontendOrigin|actors/)
  })
})

describe('validateCashLiveFixture — backend URL, origin and resource identity binding', () => {
  it('rejects a backend.url mismatch and a non-string basePath', () => {
    const fixture = validFixture()
    expect(() =>
      validateCashLiveFixture(
        { ...fixture, backend: { ...fixture.backend, url: 'http://127.0.0.1:9999/api/v1' } },
        BINDING,
      ),
    ).toThrow(/backend\.url/)
    expect(() =>
      validateCashLiveFixture(
        { ...fixture, backend: { ...fixture.backend, basePath: 1 } },
        BINDING,
      ),
    ).toThrow(/backend\.basePath/)
  })

  it('accepts an empty basePath and rejects a missing resourceId', () => {
    expect(validateCashLiveFixture(validFixture(), BINDING).backend.basePath).toBe('')
    const fixture = validFixture()
    expect(() =>
      validateCashLiveFixture(
        { ...fixture, backend: { ...fixture.backend, resourceId: '' } },
        BINDING,
      ),
    ).toThrow(/backend\.resourceId/)
  })

  it('rejects a frontendOrigin mismatch', () => {
    expect(() =>
      validateCashLiveFixture(
        { ...validFixture(), frontendOrigin: 'http://127.0.0.1:5173' },
        BINDING,
      ),
    ).toThrow(/frontendOrigin/)
  })

  it('rejects a metadata.resourceId that does not bind to backend.resourceId', () => {
    const fixture = validFixture()
    expect(() =>
      validateCashLiveFixture(
        { ...fixture, metadata: { ...fixture.metadata, resourceId: 'other-resource-id' } },
        BINDING,
      ),
    ).toThrow(/metadata\.resourceId/)
  })
})

describe('validateCashLiveFixture — declared tenants and the owned actor roles', () => {
  it('requires the three owned roles', () => {
    const fixture = validFixture()
    const { verifier: _omitted, ...remaining } = fixture.actors
    expect(() => validateCashLiveFixture({ ...fixture, actors: remaining }, BINDING)).toThrow(
      /actors\.verifier/,
    )
  })

  it('rejects a non-object actors map and empty tenants[]', () => {
    const fixture = validFixture()
    expect(() => validateCashLiveFixture({ ...fixture, actors: [] }, BINDING)).toThrow(/actors/)
    expect(() => validateCashLiveFixture({ ...fixture, tenants: [] }, BINDING)).toThrow(/tenants/)
  })

  it('rejects an actor tenant that is not declared in tenants[]', () => {
    const undeclared = { id: 'tenant-x', name: 'X', slug: 'x' }
    const broken = {
      ...validFixture().actors.cashier,
      tenant: undeclared,
      tenantId: undeclared.id,
    }
    const fixture = validFixture()
    expect(() =>
      validateCashLiveFixture(
        { ...fixture, actors: { ...fixture.actors, cashier: broken } },
        BINDING,
      ),
    ).toThrow(/cashier\.tenant\.id/)
  })

  it('rejects duplicate tenant ids', () => {
    const fixture = validFixture()
    expect(() =>
      validateCashLiveFixture({ ...fixture, tenants: [TENANT_A, { ...TENANT_A }] }, BINDING),
    ).toThrow(/distinct/)
  })
})

describe('validateCashLiveFixture — internal identity bindings', () => {
  it('rejects userId/email that do not bind to user.id/user.email', () => {
    expect(() =>
      validateCashLiveFixture(withActor('verifier', { userId: 'other-user-id' }), BINDING),
    ).toThrow(/userId/)
    expect(() =>
      validateCashLiveFixture(withActor('verifier', { email: 'other@cash-live.test' }), BINDING),
    ).toThrow(/email/)
  })

  it('rejects tenantId that does not bind to tenant.id', () => {
    expect(() =>
      validateCashLiveFixture(withActor('verifier', { tenantId: 'other-tenant-id' }), BINDING),
    ).toThrow(/tenantId/)
  })

  it('rejects a malformed user shape', () => {
    const broken = {
      ...validFixture().actors.verifier,
      user: { ...validFixture().actors.verifier.user, email: '' },
    }
    expect(() =>
      validateCashLiveFixture(withActor('verifier', { user: broken.user }), BINDING),
    ).toThrow(/user\.email/)
  })

  it('rejects memberships that are empty, malformed, or omit the actor tenant', () => {
    expect(() =>
      validateCashLiveFixture(withActor('verifier', { memberships: [] }), BINDING),
    ).toThrow(/memberships/)
    expect(() =>
      validateCashLiveFixture(
        withActor('verifier', {
          memberships: [
            {
              tenantId: 'tenant-b-id',
              tenantName: 'Tenant B',
              tenantSlug: 'tenant-b',
              roleName: 'owner',
            },
          ],
        }),
        BINDING,
      ),
    ).toThrow(/memberships/)
    expect(() =>
      validateCashLiveFixture(
        withActor('verifier', {
          memberships: [
            { tenantId: 'tenant-a-id', tenantName: 'Tenant A', tenantSlug: 'tenant-a' },
          ],
        }),
        BINDING,
      ),
    ).toThrow(/roleName/)
    expect(() =>
      validateCashLiveFixture(
        withActor('verifier', {
          memberships: [
            { tenantId: 'undeclared', tenantName: 'X', tenantSlug: 'x', roleName: 'owner' },
          ],
        }),
        BINDING,
      ),
    ).toThrow(/tenants\[\]/)
  })

  it('rejects duplicate userIds and duplicate accessTokens across actors', () => {
    expect(() =>
      validateCashLiveFixture(withActor('verifier', { userId: 'user-cashier-id' }), BINDING),
    ).toThrow(/distinct userId/)
    expect(() =>
      validateCashLiveFixture(
        withActor('verifier', { accessToken: 'synthetic-access-token-0001' }),
        BINDING,
      ),
    ).toThrow(/distinct accessToken/)
  })
})

describe('validateCashLiveFixture — permissions and access-only tokens', () => {
  it('rejects malformed permission codes', () => {
    expect(() =>
      validateCashLiveFixture(
        withActor('verifier', { permissionCodes: ['not-a-permission'] }),
        BINDING,
      ),
    ).toThrow(/permissionCodes/)
  })

  it('requires read:CashRegister for the executing cashier but not the unused verifier or foreign', () => {
    expect(() =>
      validateCashLiveFixture(withActor('cashier', { permissionCodes: ['read:Sale'] }), BINDING),
    ).toThrow(/read:CashRegister/)
    // The unused verifier carries the intentional minimal set (backend seq15)
    // and must be accepted; the foreign actor is the denial/isolation actor.
    expect(() =>
      validateCashLiveFixture(
        withActor('verifier', { permissionCodes: [...MINIMAL_VERIFIER_PERMISSIONS] }),
        BINDING,
      ),
    ).not.toThrow()
    expect(() =>
      validateCashLiveFixture(withActor('foreign', { permissionCodes: ['read:Sale'] }), BINDING),
    ).not.toThrow()
    expect(() => validateCashLiveFixture(validFixture(), BINDING)).not.toThrow()
  })

  it('rejects missing, whitespace or placeholder synthetic access tokens', () => {
    expect(() =>
      validateCashLiveFixture(withActor('verifier', { accessToken: '' }), BINDING),
    ).toThrow(/accessToken/)
    expect(() =>
      validateCashLiveFixture(withActor('verifier', { accessToken: 'abc def' }), BINDING),
    ).toThrow(/accessToken/)
    expect(() =>
      validateCashLiveFixture(
        withActor('verifier', { accessToken: 'e2e-access-token-0001' }),
        BINDING,
      ),
    ).toThrow(/synthetic/)
  })

  it('rejects any refresh token: the backend issues access-only tokens', () => {
    expect(() =>
      validateCashLiveFixture(
        withActor('verifier', { refreshToken: 'never-issued-refresh' }),
        BINDING,
      ),
    ).toThrow(/refresh token/)
  })

  it('rejects invalid expiry declarations', () => {
    expect(() =>
      validateCashLiveFixture(withActor('verifier', { expiresAt: '' }), BINDING),
    ).toThrow(/expiresAt/)
    expect(() =>
      validateCashLiveFixture(withActor('verifier', { expiresAt: 'not-a-date' }), BINDING),
    ).toThrow(/expiresAt/)
    expect(() =>
      validateCashLiveFixture(withActor('verifier', { ttlSeconds: 0 }), BINDING),
    ).toThrow(/ttlSeconds/)
    expect(() =>
      validateCashLiveFixture(withActor('verifier', { ttlSeconds: '7200' }), BINDING),
    ).toThrow(/ttlSeconds/)
  })
})

describe('validateCashLiveFixture — metadata security contract', () => {
  it('rejects accessOnly=false, refreshTokenIssued=true and otpIssued=true', () => {
    expect(() => validateCashLiveFixture(withMetadata({ accessOnly: false }), BINDING)).toThrow(
      /accessOnly/,
    )
    expect(() =>
      validateCashLiveFixture(withMetadata({ refreshTokenIssued: true }), BINDING),
    ).toThrow(/refreshTokenIssued/)
    expect(() => validateCashLiveFixture(withMetadata({ otpIssued: true }), BINDING)).toThrow(
      /otpIssued/,
    )
  })

  it('rejects a missing readiness counter', () => {
    const fixture = validFixture()
    const readiness = { ...fixture.metadata.readiness }
    delete (readiness as Record<string, unknown>).accessTokensIssued
    expect(() =>
      validateCashLiveFixture(
        { ...fixture, metadata: { ...fixture.metadata, readiness } },
        BINDING,
      ),
    ).toThrow(/accessTokensIssued/)
  })

  it('rejects missing owner/backendHEAD/generatedAt/cleanup declarations', () => {
    for (const key of ['owner', 'backendHEAD', 'generatedAt', 'cleanup'] as const) {
      expect(() => validateCashLiveFixture(withMetadata({ [key]: undefined }), BINDING)).toThrow(
        new RegExp(key),
      )
    }
  })
})

function withMetadata(patch: Record<string, unknown>) {
  const fixture = validFixture()
  return { ...fixture, metadata: { ...fixture.metadata, ...patch } }
}

describe('validateCashLiveFixture — accepted fixture, normalized shape and token redaction', () => {
  it('accepts a valid fixture with the normalized access-only actor shape', () => {
    const validated: ValidatedCashLiveFixture = validateCashLiveFixture(validFixture(), BINDING)
    expect(validated.actors.map((entry) => entry.role)).toEqual(['cashier', 'verifier', 'foreign'])
    const cashier = validated.actors[0]!
    expect(cashier.tokens.access).toBe('synthetic-access-token-0001')
    expect(Object.keys(cashier.tokens)).toEqual(['access'])
    expect(cashier.user.email).toBe('cashier@cash-live.test')
    expect(cashier.tenant).toEqual(TENANT_A)
    expect(cashier.memberships).toEqual([
      { id: 'tenant-a-id', name: 'Tenant A', slug: 'tenant-a', roleName: 'owner' },
    ])
    expect(validated.tenants).toHaveLength(2)
    expect(validated.backend).toEqual({
      url: BINDING.backendUrl,
      basePath: '',
      resourceId: RESOURCE_ID,
    })
    expect(validated.frontendOrigin).toBe(BINDING.frontendOrigin)
    expect(validated.metadata.accessOnly).toBe(true)
    expect(validated.metadata.refreshTokenIssued).toBe(false)
  })

  it('accepts the intentional minimal verifier without read:CashRegister', () => {
    const validated = validateCashLiveFixture(
      withActor('verifier', { permissionCodes: [...MINIMAL_VERIFIER_PERMISSIONS] }),
      BINDING,
    )
    const verifier = validated.actors[1]!
    expect(verifier.role).toBe('verifier')
    expect(verifier.permissionCodes).toEqual([...MINIMAL_VERIFIER_PERMISSIONS])
    expect(verifier.permissionCodes).not.toContain('read:CashRegister')
  })

  it('never echoes token values in rejection messages', () => {
    // The rejection is structural (empty memberships) while the actor carries a
    // real-looking secret token, so the thrown message must not include it.
    const secret = 'secret-access-VALUE-leak'
    const broken = withActor('verifier', { accessToken: secret, memberships: [] })
    try {
      validateCashLiveFixture(broken, BINDING)
      expect.unreachable('expected rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(CashLiveFixtureError)
      expect((error as Error).message).toMatch(/memberships/)
      expect((error as Error).message).not.toContain(secret)
    }
  })
})

describe('assertPathInside — load-time confinement', () => {
  it('accepts a real path that stays inside the project root', () => {
    expect(() =>
      assertPathInside('/repo/frontend', '/repo/frontend/artifacts/cash-live/scratch/f.json'),
    ).not.toThrow()
  })

  it('rejects a symlink-resolved path that escapes the project root', () => {
    expect(() => assertPathInside('/repo/frontend', '/elsewhere/leaked.json')).toThrow(/project/)
  })
})

describe('loadCashLiveFixture — injected IO, fail-closed loading', () => {
  const PATH = '/repo/frontend/artifacts/cash-live/scratch/fixture.json'

  it('parses and validates the file through the injected reader', () => {
    const loaded = loadCashLiveFixture(PATH, BINDING, '/repo/frontend', {
      readFile: () => JSON.stringify(validFixture()),
      realpath: (p: string) => p,
    })
    expect(loaded.actors[1]?.user.email).toBe('verifier@cash-live.test')
  })

  it('rejects an unreadable file without echoing content', () => {
    expect(() =>
      loadCashLiveFixture(PATH, BINDING, '/repo/frontend', {
        readFile: () => {
          throw new Error('EACCES: secret body leak secret-access-VALUE-leak')
        },
        realpath: (p: string) => p,
      }),
    ).toThrow(/not readable/)
  })

  it('rejects invalid JSON without echoing content', () => {
    expect(() =>
      loadCashLiveFixture(PATH, BINDING, '/repo/frontend', {
        readFile: () => '{"schemaVersion":1, TRUNCATED secret-access-VALUE-leak',
        realpath: (p: string) => p,
      }),
    ).toThrow(/parse/)
  })

  it('rejects a symlink-resolved path that escapes the scratch root before reading', () => {
    const readFile = vi.fn(() => JSON.stringify(validFixture()))
    expect(() =>
      loadCashLiveFixture(PATH, BINDING, '/repo/frontend', {
        readFile,
        realpath: () => '/elsewhere/leaked.json',
      }),
    ).toThrow(/scratch root/)
    // The reader must never be invoked for an out-of-root resolved path.
    expect(readFile).not.toHaveBeenCalled()
  })
})
