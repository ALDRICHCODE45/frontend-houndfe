import { describe, expect, it, vi } from 'vitest'
import { navigationGroups } from '../navigation.registry'
import { buildCanAccess, type AccessAuthStore, type CanAccess } from '../navigation.access'
import {
  DASHBOARD_NAV_ITEM,
  DASHBOARD_PATH,
  FORBIDDEN_PATH,
  resolveLandingDestinationForAuth,
  resolveRememberedLandingPath,
  isRememberableLandingLocation,
  type LandingLocationFacts,
  type LandingRouteFacts,
  type LandingRouteMeta,
  type LandingRouteResolver,
} from '../navigation.landing'

function auth(userCan: AccessAuthStore['userCan'], isSuperAdmin = false): AccessAuthStore {
  return { isSuperAdmin, userCan }
}

function registrySnapshot() {
  return navigationGroups.map((group) => ({
    id: group.id,
    children: group.children.map((child) => ({ ...child })),
  }))
}

describe('resolveLandingDestinationForAuth', () => {
  it('prioritizes the exact permissioned Dashboard destination', () => {
    const store = auth((action, subject) => action === 'read' && subject === 'Analytics')

    expect(DASHBOARD_NAV_ITEM).toMatchObject({
      to: DASHBOARD_PATH,
      permission: ['read', 'Analytics'],
    })
    expect(resolveLandingDestinationForAuth(store)).toBe(DASHBOARD_PATH)
  })

  it('falls back to the first accessible ordered registry child', () => {
    const store = auth((action, subject) => action === 'read' && subject === 'Sale')
    expect(resolveLandingDestinationForAuth(store)).toBe('/pos/ventas')
  })

  it('honors the first super-admin-only registry destination', () => {
    expect(resolveLandingDestinationForAuth(auth(() => false, true))).toBe('/admin/tenants')
  })

  it('falls back to /403 when no application destination is accessible', () => {
    expect(resolveLandingDestinationForAuth(auth(() => false))).toBe(FORBIDDEN_PATH)
  })

  it('does not mutate the registry or inject Dashboard as a group child', () => {
    const before = registrySnapshot()
    resolveLandingDestinationForAuth(auth(() => true))

    expect(registrySnapshot()).toEqual(before)
    expect(navigationGroups.flatMap((group) => group.children)).not.toContainEqual(
      expect.objectContaining({ to: DASHBOARD_PATH }),
    )
  })
})

// ─── Remembered landing eligibility (ODD root-last-route) ─────────────────
//
// A remembered destination is restorable only when it is an explicitly opted-in
// stable application route the current identity may enter. Root, auth, public,
// error, create, detail, dynamic and non-canonical candidates must be rejected;
// never authorize from menu visibility.

function canAccessFor(
  userCan: (action: string, subject: string) => boolean,
  isSuperAdmin = false,
): CanAccess {
  return buildCanAccess(auth(userCan as AccessAuthStore['userCan'], isSuperAdmin))
}

function routeResolver(
  facts: Record<string, LandingRouteFacts>,
  unmatched: string[] = [],
): LandingRouteResolver {
  return vi.fn((path: string) => {
    if (unmatched.includes(path)) return null
    return facts[path] ?? null
  })
}

function optedIn(permission?: [string, string]): LandingRouteMeta {
  return {
    rememberAsLanding: true,
    permission: permission as LandingRouteMeta['permission'],
  }
}

function facts(canonicalPath: string, meta: LandingRouteMeta): LandingRouteFacts {
  return { canonicalPath, meta, dynamicParams: [] }
}

describe('resolveRememberedLandingPath', () => {
  const grantsSale = canAccessFor((action, subject) => action === 'read' && subject === 'Sale')

  it('returns the remembered path for an opted-in stable route the identity may enter', () => {
    const resolve = routeResolver({
      '/pos/ventas': facts('/pos/ventas', optedIn(['read', 'Sale'])),
    })

    expect(resolveRememberedLandingPath('/pos/ventas', resolve, grantsSale)).toBe('/pos/ventas')
  })

  it('returns null when there is no remembered candidate', () => {
    const resolve = routeResolver({})
    expect(resolveRememberedLandingPath(null, resolve, grantsSale)).toBeNull()
  })

  it.each([
    { label: 'root', candidate: '/', resolver: routeResolver({ '/': facts('/', optedIn()) }) },
    {
      label: 'external URL',
      candidate: 'https://evil.example.com/pos/ventas',
      resolver: routeResolver({}),
    },
    {
      label: 'query-bearing value',
      candidate: '/pos/ventas?tab=2',
      resolver: routeResolver({}),
    },
    {
      label: 'unmatched path',
      candidate: '/pos/desconocido',
      resolver: routeResolver({}, ['/pos/desconocido']),
    },
  ])('returns null for a $label candidate', ({ candidate, resolver }) => {
    expect(resolveRememberedLandingPath(candidate, resolver, grantsSale)).toBeNull()
  })

  it('returns null for a non-canonical path', () => {
    const resolve = routeResolver({
      '/pos/ventas/': facts('/pos/ventas', optedIn(['read', 'Sale'])),
    })

    expect(resolveRememberedLandingPath('/pos/ventas/', resolve, grantsSale)).toBeNull()
  })

  it.each([
    {
      label: 'not explicitly opted in',
      meta: { permission: ['read', 'Sale'] as LandingRouteMeta['permission'] },
    },
    { label: 'public', meta: { public: true, rememberAsLanding: true } },
  ])('returns null when the route is $label', ({ meta }) => {
    const resolve = routeResolver({ '/pos/ventas': facts('/pos/ventas', meta) })

    expect(resolveRememberedLandingPath('/pos/ventas', resolve, grantsSale)).toBeNull()
  })

  it('returns null for a dynamic detail route', () => {
    const resolve: LandingRouteResolver = () => ({
      canonicalPath: '/pos/ventas/123',
      meta: optedIn(['read', 'Sale']),
      dynamicParams: ['id'],
    })

    expect(resolveRememberedLandingPath('/pos/ventas/123', resolve, grantsSale)).toBeNull()
  })

  it('returns null when the current permissions deny the remembered route', () => {
    const denied = canAccessFor(() => false)
    const resolve = routeResolver({
      '/admin/users': facts('/admin/users', optedIn(['read', 'User'])),
    })

    expect(resolveRememberedLandingPath('/admin/users', resolve, denied)).toBeNull()
  })

  it('honors the super-admin gate on the remembered route', () => {
    const meta: LandingRouteMeta = { rememberAsLanding: true, requiresSuperAdmin: true }
    const resolve = routeResolver({ '/admin/tenants': facts('/admin/tenants', meta) })

    expect(
      resolveRememberedLandingPath(
        '/admin/tenants',
        resolve,
        canAccessFor(() => false),
      ),
    ).toBeNull()
    expect(
      resolveRememberedLandingPath(
        '/admin/tenants',
        resolve,
        canAccessFor(() => false, true),
      ),
    ).toBe('/admin/tenants')
  })
})

describe('isRememberableLandingLocation', () => {
  function location(overrides: Partial<LandingLocationFacts> = {}): LandingLocationFacts {
    return {
      path: '/pos/ventas',
      name: 'pos-sales-list',
      meta: optedIn(['read', 'Sale']),
      dynamicParams: [],
      ...overrides,
    }
  }

  it('accepts an opted-in stable module route', () => {
    expect(isRememberableLandingLocation(location())).toBe(true)
  })

  it.each([
    { label: 'root by name', overrides: { path: '/', name: 'root' } },
    { label: 'root by path', overrides: { path: '/', name: 'other' } },
    { label: 'unnamed location', overrides: { name: null } },
    { label: 'public route', overrides: { meta: { public: true, rememberAsLanding: true } } },
    { label: 'not opted in', overrides: { meta: {} } },
    { label: 'dynamic route', overrides: { dynamicParams: ['id'] } },
  ])('rejects a $label', ({ overrides }) => {
    expect(isRememberableLandingLocation(location(overrides))).toBe(false)
  })
})
