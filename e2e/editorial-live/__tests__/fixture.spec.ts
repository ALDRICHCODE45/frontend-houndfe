/** Pure tests for the editorial-live fixture contract. The reader is injected; no project file is read. */
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  EditorialLiveFixtureError,
  loadEditorialLiveFixture,
  validateEditorialLiveFixture,
  type EditorialLiveFixtureBinding,
} from '../support/fixture'

const BINDING: EditorialLiveFixtureBinding = { backendUrl: 'http://127.0.0.1:8082/api/v1', frontendOrigin: 'http://127.0.0.1:4191' }
const RESOURCE = 'res-0001'
const TENANT = { id: 'tenant-a', name: 'Tenant A', slug: 'tenant-a' }
const OTHER = { id: 'tenant-b', name: 'Tenant B', slug: 'tenant-b' }
const membership = (tenant = TENANT) => ({ tenantId: tenant.id, tenantName: tenant.name, tenantSlug: tenant.slug, roleName: 'Admin' })

function actor(n: number, patch: Record<string, unknown> = {}) {
  const id = `user-${n}`
  const email = `actor${n}@example.test`
  return {
    userId: id, email, isSuperAdmin: false, tenantId: TENANT.id, tenant: TENANT, permissionCodes: ['read:ProductEditorialDraft'],
    accessToken: `live-token-secret-${n}`, user: { id, email, name: `Actor ${n}`, isActive: true, createdAt: '2026-11-18T00:00:00.000Z' },
    memberships: [membership()], expiresAt: '2099-01-01T00:00:00.000Z', ttlSeconds: 3600, ...patch,
  }
}

function fixture(): Record<string, unknown> & { actors: Record<string, Record<string, unknown>> } {
  return {
    schemaVersion: 1,
    backend: { url: BINDING.backendUrl, basePath: '/api/v1', resourceId: RESOURCE },
    frontendOrigin: BINDING.frontendOrigin,
    tenants: [TENANT, OTHER],
    product: { id: 'product-1', tenantId: TENANT.id, name: 'Collar live', disposable: true },
    actors: {
      'superadmin-global': actor(1, { isSuperAdmin: true, tenantId: null, tenant: null, permissionCodes: [], memberships: [] }),
      'superadmin-tenant': actor(2, { isSuperAdmin: true, permissionCodes: [], memberships: [] }),
      'manage-all': actor(3, { permissionCodes: ['manage:all'] }),
      'editorial-only': actor(4, { permissionCodes: ['read:ProductEditorialDraft', 'update:ProductEditorialDraft'] }),
    },
    metadata: { owner: 'backend', backendHEAD: 'abc123', resourceId: RESOURCE, generatedAt: '2026-11-18T00:00:00Z',
      cleanup: { drop: true }, accessOnly: true, refreshTokenIssued: false, otpIssued: false },
  }
}

const rejects = (input: unknown, message: RegExp) => expect(() => validateEditorialLiveFixture(input, BINDING)).toThrow(message)

describe('validateEditorialLiveFixture', () => {
  it('normalizes the four actors in journey order, global without a tenant', () => {
    const result = validateEditorialLiveFixture(fixture(), BINDING)
    expect(result.actors.map(a => a.role)).toEqual(['superadmin-global', 'superadmin-tenant', 'manage-all', 'editorial-only'])
    expect(result.actors[0]).toMatchObject({ isSuperAdmin: true, tenant: null, permissionCodes: [] })
    expect(result.actors[2]!.tenant).toEqual(TENANT)
    expect(result.actors[3]!.tokens).toEqual({ access: 'live-token-secret-4' })
    expect(result.actors[3]!.memberships[0]).toEqual({ id: TENANT.id, name: TENANT.name, slug: TENANT.slug, roleName: 'Admin' })
    expect(result.product).toEqual({ id: 'product-1', tenantId: TENANT.id, name: 'Collar live' })
    expect(Object.isFrozen(result.actors[0])).toBe(true)
  })

  it('rejects a non-object', () => rejects([], /JSON object/))

  it('binds ownership to the declared backend URL and frontend origin', () => {
    const wrongBackend = fixture(); (wrongBackend.backend as Record<string, unknown>).url = 'http://127.0.0.1:9999'
    rejects(wrongBackend, /backend.url must match/)
    rejects({ ...fixture(), frontendOrigin: 'http://127.0.0.1:4189' }, /frontendOrigin must match/)
  })

  it('binds metadata.resourceId to backend.resourceId', () => {
    const input = fixture(); (input.metadata as Record<string, unknown>).resourceId = 'other'
    rejects(input, /metadata.resourceId must bind/)
  })

  it.each([['accessOnly', false], ['refreshTokenIssued', true], ['otpIssued', true]])('rejects metadata.%s = %s', (key, value) => {
    const input = fixture(); (input.metadata as Record<string, unknown>)[key] = value
    rejects(input, new RegExp(`metadata.${key}`))
  })

  it('requires a disposable product inside the declared tenants', () => {
    rejects({ ...fixture(), product: { id: 'p', tenantId: TENANT.id, name: 'x', disposable: false } }, /product.disposable/)
    rejects({ ...fixture(), product: { id: 'p', tenantId: 'nope', name: 'x', disposable: true } }, /product.tenantId/)
  })

  it.each(['superadmin-global', 'superadmin-tenant', 'manage-all', 'editorial-only'])('requires actor %s', role => {
    const input = fixture(); delete input.actors[role]
    rejects(input, new RegExp(`actors.${role} is required`))
  })

  it('global actor must be a Super Admin without a tenant', () => {
    const tenanted = fixture(); tenanted.actors['superadmin-global'] = actor(1, { isSuperAdmin: true, permissionCodes: [], memberships: [] })
    rejects(tenanted, /superadmin-global.tenantId must be null/)
    const notAdmin = fixture(); notAdmin.actors['superadmin-global']!.isSuperAdmin = false
    rejects(notAdmin, /superadmin-global.isSuperAdmin must be true/)
  })

  it('tenant actors must sit in the product tenant', () => {
    const input = fixture(); input.actors['manage-all'] = actor(3, { permissionCodes: ['manage:all'], tenantId: OTHER.id, tenant: OTHER, memberships: [membership(OTHER)] })
    rejects(input, /manage-all.tenant.id must be the product tenant/)
  })

  it('manage-all needs manage:all and is not a Super Admin', () => {
    const input = fixture(); input.actors['manage-all']!.permissionCodes = ['read:ProductEditorialDraft']
    rejects(input, /must include manage:all/)
    const admin = fixture(); admin.actors['manage-all']!.isSuperAdmin = true
    rejects(admin, /manage-all.isSuperAdmin must be false/)
  })

  it('editorial-only needs read+update and never manage:all', () => {
    const missing = fixture(); missing.actors['editorial-only']!.permissionCodes = ['read:ProductEditorialDraft']
    rejects(missing, /must include read:ProductEditorialDraft and update:ProductEditorialDraft/)
    const wildcard = fixture(); wildcard.actors['editorial-only']!.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft', 'manage:all']
    rejects(wildcard, /must not include manage:all/)
  })

  it('rejects refresh tokens, synthetic tokens, duplicate tokens and duplicate users', () => {
    const refresh = fixture(); refresh.actors['manage-all']!.refreshToken = 'r'
    rejects(refresh, /must not carry a refresh token/)
    const synthetic = fixture(); synthetic.actors['manage-all']!.accessToken = 'e2e-access-token-0001'
    rejects(synthetic, /synthetic/)
    const dupToken = fixture(); dupToken.actors['manage-all']!.accessToken = 'live-token-secret-4'
    rejects(dupToken, /distinct accessToken/)
    const dupUser = fixture(); dupUser.actors['manage-all'] = actor(4, { permissionCodes: ['manage:all'], accessToken: 'live-token-secret-3' })
    rejects(dupUser, /distinct userId/)
  })

  it('never echoes a token value in errors', () => {
    const input = fixture(); input.actors['editorial-only']!.accessToken = 'has space secret-xyz'
    try {
      validateEditorialLiveFixture(input, BINDING)
      expect.unreachable()
    } catch (error) {
      expect((error as Error).message).toMatch(/whitespace/)
      expect((error as Error).message).not.toContain('secret-xyz')
      expect((error as Error).message).not.toContain('live-token-secret')
    }
  })
})

describe('loadEditorialLiveFixture', () => {
  const ROOT = '/repo/frontend'
  const DECLARED = 'artifacts/editorial-live/fixture.json'
  const ABS = path.resolve(ROOT, DECLARED)
  const identity = (p: string) => p

  it('reads the real path and validates it', () => {
    const readFile = vi.fn(() => JSON.stringify(fixture()))
    const result = loadEditorialLiveFixture(DECLARED, BINDING, ROOT, { readFile, realpath: identity })
    expect(readFile).toHaveBeenCalledWith(ABS)
    expect(result.actors).toHaveLength(4)
  })

  it('rejects a lexical escape before any IO', () => {
    const readFile = vi.fn()
    expect(() => loadEditorialLiveFixture('../x.json', BINDING, ROOT, { readFile, realpath: identity })).toThrow(EditorialLiveFixtureError)
    expect(readFile).not.toHaveBeenCalled()
  })

  it('rejects a symlinked fixture resolving outside the scratch root, without reading it', () => {
    const readFile = vi.fn()
    const realpath = (p: string) => (p === ABS ? '/home/someone/secret.json' : p)
    expect(() => loadEditorialLiveFixture(DECLARED, BINDING, ROOT, { readFile, realpath })).toThrow(/scratch root/)
    expect(readFile).not.toHaveBeenCalled()
  })

  it('rejects a symlinked scratch root that leaves the project', () => {
    const scratch = path.resolve(ROOT, 'artifacts/editorial-live')
    const realpath = (p: string) => (p === scratch ? '/tmp/elsewhere' : p === ABS ? '/tmp/elsewhere/fixture.json' : p)
    expect(() => loadEditorialLiveFixture(DECLARED, BINDING, ROOT, { readFile: vi.fn(), realpath })).toThrow(/scratch root/)
  })

  it('suppresses reader, realpath and JSON errors', () => {
    const leaky = () => { throw new Error('content: live-token-secret-1') }
    for (const io of [
      { readFile: leaky, realpath: identity },
      { readFile: () => '', realpath: leaky },
      { readFile: () => '{ live-token-secret-1', realpath: identity },
    ]) {
      try {
        loadEditorialLiveFixture(DECLARED, BINDING, ROOT, io)
        expect.unreachable()
      } catch (error) {
        expect(error).toBeInstanceOf(EditorialLiveFixtureError)
        expect((error as Error).message).not.toContain('live-token-secret')
      }
    }
  })
})
