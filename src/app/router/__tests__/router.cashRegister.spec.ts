// router.cashRegister.spec.ts — the POS "Caja" route (cash-register-ui T2) plus
// the regression pin that the pre-existing Clientes route/nav target is intact.
//
// Setup is deterministic on purpose:
//   - the router module is imported ONCE at file scope (the auth store is already
//     mocked), so no heavy `vi.resetModules()` + dynamic import runs inside a
//     test and the per-test timeout is not spent on module loading;
//   - the router is a singleton, so each navigation starts from a DIFFERENT path
//     (a push to the path we are already on is a duplicate navigation that never
//     runs the guard);
//   - the two cash VIEWS are stubbed below because this spec pins the route
//     record, its metadata and the REAL global guard, not the UI. Routing to
//     /pos/caja lazily imports CashRegisterView.vue and its collaborator graph
//     (TanStack Query, the cash/user API clients, ten panels), and that first
//     transform is charged to whichever test navigates there first — this
//     spec's first case. The views have their own composable/transport unit
//     coverage (CashReceptionView.spec.ts, CashRegisterView.spec.ts), so the
//     guard assertions here stay real while the view graph is isolated.
//
// The route:
//   path: /pos/caja
//   name: pos-cash-register
//   meta.layout: 'dashboard'
//   meta.permission: ['read', 'CashRegister']
//   NO skipTenantCheck, NO requiresSuperAdmin.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { navigationGroups } from '@/app/navigation/navigation.registry'

const mockAuthStore = {
  accessToken: null as string | null,
  user: null as { id: string } | null,
  isAuthenticated: false,
  permissionsLoaded: false,
  authPhase: 'idle' as
    | 'idle'
    | 'authenticating'
    | 'needs-tenant-selection'
    | 'selecting-tenant'
    | 'authenticated',
  currentTenant: null as { id: string; name: string; slug: string } | null,
  isSuperAdmin: false,
  tempToken: null as string | null,
  hydrateFromStorage: vi.fn(),
  fetchMe: vi.fn(),
  fetchPermissions: vi.fn(),
  clearSession: vi.fn(),
  userCan: vi.fn().mockReturnValue(false),
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => mockAuthStore,
}))

// Route-view stubs: keep the real router, route metadata and global guard while
// cutting the heavy cash view module graph out of this routing-only test.
vi.mock('@/features/POS/cash-register/views/CashRegisterView.vue', () => ({
  default: { name: 'CashRegisterView' },
}))
vi.mock('@/features/POS/cash-register/views/CashReceptionView.vue', () => ({
  default: { name: 'CashReceptionView' },
}))

import router from '../index'

function authenticateWithCashRegister(granted: boolean) {
  mockAuthStore.accessToken = 'access-token'
  mockAuthStore.user = { id: 'user-1' }
  mockAuthStore.isAuthenticated = true
  mockAuthStore.permissionsLoaded = true
  mockAuthStore.authPhase = 'authenticated'
  mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Centro', slug: 'centro' }
  mockAuthStore.userCan.mockImplementation(
    (action: string, subject: string) => granted && action === 'read' && subject === 'CashRegister',
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthStore.accessToken = null
  mockAuthStore.user = null
  mockAuthStore.isAuthenticated = false
  mockAuthStore.permissionsLoaded = false
  mockAuthStore.authPhase = 'idle'
  mockAuthStore.currentTenant = null
  mockAuthStore.isSuperAdmin = false
  mockAuthStore.tempToken = null
  mockAuthStore.userCan.mockReturnValue(false)
})

describe('router — /pos/caja (cash-register-ui T2)', () => {
  it('resolves the route with dashboard layout when read:CashRegister is granted', async () => {
    authenticateWithCashRegister(true)

    await router.push('/pos/caja')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/pos/caja')
    expect(router.currentRoute.value.name).toBe('pos-cash-register')
    expect(router.currentRoute.value.meta.permission).toEqual(['read', 'CashRegister'])
    expect(router.currentRoute.value.meta.layout).toBe('dashboard')
    expect(router.currentRoute.value.meta.skipTenantCheck).toBeUndefined()
    expect(router.currentRoute.value.meta.requiresSuperAdmin).toBeUndefined()
  })

  it('redirects to /403 without read:CashRegister', async () => {
    authenticateWithCashRegister(false)

    // Start elsewhere so the target push is a real navigation that runs the guard.
    await router.push('/403')
    await router.isReady()

    await router.push('/pos/caja')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })
})

describe('router — recipient-only cash reception', () => {
  it('lands the canonical receiver on reception without register/session/audit grants', async () => {
    authenticateWithCashRegister(false)
    const codes = ['read:CashHandover', 'update:CashHandover']
    mockAuthStore.userCan.mockImplementation((action: string, subject: string) =>
      codes.includes(`${action}:${subject}`),
    )
    await router.push('/403')
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/pos/caja/recepciones')
    expect(router.currentRoute.value.meta.permission).toEqual(['read', 'CashHandover'])
    await router.push('/pos/caja')
    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('rejects reception when only update:CashHandover is granted', async () => {
    authenticateWithCashRegister(false)
    mockAuthStore.userCan.mockImplementation(
      (action: string, subject: string) => action === 'update' && subject === 'CashHandover',
    )
    await router.push('/403')
    await router.push('/pos/caja/recepciones')
    expect(router.currentRoute.value.path).toBe('/403')
  })
})

describe('router — pre-existing navigation targets stay resolvable', () => {
  it('keeps the Clientes route registered at /pos/customers (no unrelated rewrite)', () => {
    const resolved = router.resolve('/pos/customers')

    expect(resolved.name).toBe('pos-customers')
    expect(resolved.matched.length).toBeGreaterThan(0)
  })

  it('matches every POS navigation-registry target to a registered route', () => {
    const posGroup = navigationGroups.find((group) => group.id === 'pos')
    const targets = [...new Set(posGroup!.children.map((child) => child.to))]

    const unresolved = targets.filter((target) => router.resolve(target).matched.length === 0)
    expect(unresolved).toEqual([])
  })

  it('keeps the Caja entry and the Clientes entry pointing at their routes', () => {
    const posGroup = navigationGroups.find((group) => group.id === 'pos')
    const cashEntry = posGroup!.children.find((child) => child.id === 'pos-cash-register')
    const customerEntry = posGroup!.children.find((child) => child.id === 'pos-customers')

    expect(router.resolve(cashEntry!.to).name).toBe('pos-cash-register')
    expect(router.resolve(customerEntry!.to).name).toBe('pos-customers')
  })
})
