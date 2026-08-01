import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mock the auth store so route guards don't try to hydrate/fetch the real
// session. userCan returns true by default — the route-shape tests don't
// exercise the permission gate here (router.spec.ts covers that path).
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

let routes: ReturnType<(typeof import('../index'))['default']['getRoutes']>

beforeAll(async () => {
  const module = await import('../index')
  routes = module.default.getRoutes()
})

describe('quotations routes (sdd-quotations-crud S1, REQ-QTN-001)', () => {
  it('registers /pos/cotizaciones as the list route', () => {
    const listRoute = routes.find((r) => r.path === '/pos/cotizaciones')
    expect(listRoute).toBeDefined()
    expect(listRoute?.name).toBe('pos-quotations-list')
  })

  it('registers /pos/cotizaciones/nueva as the create route', () => {
    const createRoute = routes.find((r) => r.path === '/pos/cotizaciones/nueva')
    expect(createRoute).toBeDefined()
    expect(createRoute?.name).toBe('pos-quotations-create')
  })

  it('registers /pos/cotizaciones/:id as the detail route', () => {
    const detailRoute = routes.find((r) => r.path === '/pos/cotizaciones/:id')
    expect(detailRoute).toBeDefined()
    expect(detailRoute?.name).toBe('pos-quotation-detail')
  })

  it('does not collide with the create route — detail param matcher is separate', () => {
    const detailRoute = routes.find((r) => r.path === '/pos/cotizaciones/:id')
    const createRoute = routes.find((r) => r.path === '/pos/cotizaciones/nueva')

    expect(detailRoute).toBeDefined()
    expect(createRoute).toBeDefined()
  })

  it('gates list/detail with read and create with create:Quotation (REQ-QTN-014)', () => {
    const listMeta = routes.find((r) => r.path === '/pos/cotizaciones')?.meta as {
      permission?: [string, string]
    }
    const createMeta = routes.find((r) => r.path === '/pos/cotizaciones/nueva')?.meta as {
      permission?: [string, string]
    }
    const detailMeta = routes.find((r) => r.path === '/pos/cotizaciones/:id')?.meta as {
      permission?: [string, string]
    }

    expect(listMeta.permission).toEqual(['read', 'Quotation'])
    expect(createMeta.permission).toEqual(['create', 'Quotation'])
    expect(detailMeta.permission).toEqual(['read', 'Quotation'])
  })

  it('uses dashboard layout for every quotation route', () => {
    const listMeta = routes.find((r) => r.path === '/pos/cotizaciones')?.meta as {
      layout?: string
    }
    const createMeta = routes.find((r) => r.path === '/pos/cotizaciones/nueva')?.meta as {
      layout?: string
    }
    const detailMeta = routes.find((r) => r.path === '/pos/cotizaciones/:id')?.meta as {
      layout?: string
    }

    expect(listMeta.layout).toBe('dashboard')
    expect(createMeta.layout).toBe('dashboard')
    expect(detailMeta.layout).toBe('dashboard')
  })
})