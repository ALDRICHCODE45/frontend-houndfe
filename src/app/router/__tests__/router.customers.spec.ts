import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    accessToken: null,
    user: null,
    isAuthenticated: false,
    permissionsLoaded: false,
    hydrateFromStorage: vi.fn(),
    fetchMe: vi.fn(),
    fetchPermissions: vi.fn(),
    clearSession: vi.fn(),
    userCan: vi.fn().mockReturnValue(true),
    logout: vi.fn(),
  }),
}))

type Router = (typeof import('../index'))['default']
let router: Router

beforeAll(async () => {
  const module = await import('../index')
  router = module.default
})

// customers-module T4 (S4): the customer page lives under the customers list, like products and sales.
describe('customer detail route', () => {
  it('is /pos/customers/:id, named pos-customer-detail, and needs read:Customer', () => {
    const route = router.getRoutes().find((r) => r.path === '/pos/customers/:id')
    expect(route?.name).toBe('pos-customer-detail')
    expect(route?.meta).toMatchObject({ layout: 'dashboard', permission: ['read', 'Customer'] })
  })

  it('keeps the list at /pos/customers', () => {
    const resolved = router.resolve('/pos/customers')
    expect(resolved.name).toBe('pos-customers')
  })

  it('resolves a customer id to the detail page', () => {
    const resolved = router.resolve('/pos/customers/c-1')
    expect(resolved.name).toBe('pos-customer-detail')
    expect(resolved.params.id).toBe('c-1')
  })

  it('redirects the Spanish /pos/clientes/:id link to the same page, keeping the tab', () => {
    const record = router.getRoutes().find((r) => r.path === '/pos/clientes/:id')
    expect(typeof record?.redirect).toBe('function')
    const from = router.resolve('/pos/clientes/c-1?tab=ventas')
    const target = (record!.redirect as (to: typeof from) => unknown)(from)
    const resolved = router.resolve(target as Parameters<Router['resolve']>[0])
    expect(resolved.name).toBe('pos-customer-detail')
    expect(resolved.params.id).toBe('c-1')
    expect(resolved.query.tab).toBe('ventas')
  })
})
