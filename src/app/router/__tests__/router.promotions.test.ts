import { describe, it, expect, vi, beforeAll } from 'vitest'

// ── Mock dependencies that the router pulls in ────────────────────────────────
// The router imports useAuthStore which depends on Pinia — mock the auth guard
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

// ── Import REAL router after mocking dependencies ─────────────────────────────

let routerRoutes: Array<{ path: string; name?: string | symbol; component?: unknown }>

beforeAll(async () => {
  const routerModule = await import('../index')
  routerRoutes = routerModule.default.getRoutes()
})

// ── Tests against REAL router configuration ───────────────────────────────────

describe('Promotions routes — real router config', () => {
  it('includes /pos/promociones route with name pos-promotions', () => {
    const route = routerRoutes.find((r) => r.path === '/pos/promociones')
    expect(route).toBeDefined()
    expect(route!.name).toBe('pos-promotions')
  })

  it('includes /pos/promociones/crear/:type route with name pos-promotion-create', () => {
    const route = routerRoutes.find((r) => r.path === '/pos/promociones/crear/:type')
    expect(route).toBeDefined()
    expect(route!.name).toBe('pos-promotion-create')
  })

  it('includes /pos/promociones/:id route with name pos-promotion-detail', () => {
    const route = routerRoutes.find((r) => r.path === '/pos/promociones/:id')
    expect(route).toBeDefined()
    expect(route!.name).toBe('pos-promotion-detail')
  })

  it('create route path contains :type dynamic segment', () => {
    const route = routerRoutes.find((r) => r.name === 'pos-promotion-create')
    expect(route!.path).toContain(':type')
  })

  it('detail route path contains :id dynamic segment', () => {
    const route = routerRoutes.find((r) => r.name === 'pos-promotion-detail')
    expect(route!.path).toContain(':id')
  })

  it('create and detail routes have distinct paths', () => {
    const createRoute = routerRoutes.find((r) => r.name === 'pos-promotion-create')
    const detailRoute = routerRoutes.find((r) => r.name === 'pos-promotion-detail')
    expect(createRoute!.path).not.toBe(detailRoute!.path)
  })

  it('promotions list route has dashboard layout meta', () => {
    const route = routerRoutes.find((r) => r.path === '/pos/promociones') as unknown as {
      path: string
      meta?: { layout?: string }
    }
    expect(route!.meta?.layout).toBe('dashboard')
  })

  it('all 3 promotion routes exist in total', () => {
    const promotionRoutes = routerRoutes.filter((r) =>
      typeof r.path === 'string' && r.path.startsWith('/pos/promociones'),
    )
    expect(promotionRoutes.length).toBeGreaterThanOrEqual(3)
  })
})
