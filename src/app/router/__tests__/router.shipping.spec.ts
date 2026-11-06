// router.shipping.spec.ts — «Envíos» and «Validaciones de zona» (ODD shipping-settings T1, S2).
//
// Route contract:
//   /sistema/envios               name sistema-shipping          ['read', 'ShippingSettings']
//     tab in the query: ?tab=zonas | cajas | origen | horario (default zonas)
//   /sistema/envios/validaciones  name sistema-zone-validations  ['validate', 'DeliveryZone']

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAuthStore = {
  accessToken: null as string | null,
  user: null as { id: string } | null,
  isAuthenticated: false,
  permissionsLoaded: false,
  authPhase: 'idle' as string,
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

// Shared-route stubs, as in router.refunds.spec.ts: this spec asserts paths and
// metadata, never these components.
vi.mock('@/features/auth/login/views/LoginView.vue', () => ({ default: { name: 'LoginView' } }))
vi.mock('@/features/errors/views/ForbiddenView.vue', () => ({ default: { name: 'ForbiddenView' } }))
vi.mock('@/features/errors/views/NotFoundView.vue', () => ({ default: { name: 'NotFoundView' } }))

vi.mock('@/features/shipping/shipping-settings/views/ShippingSettingsView.vue', () => ({
  default: { name: 'ShippingSettingsView' },
}))
vi.mock('@/features/shipping/delivery-zones/views/ZoneValidationsView.vue', () => ({
  default: { name: 'ZoneValidationsView' },
}))

function authenticate(userCan: (action: string, subject: string) => boolean) {
  mockAuthStore.accessToken = 'access-token'
  mockAuthStore.user = { id: 'user-1' }
  mockAuthStore.isAuthenticated = true
  mockAuthStore.permissionsLoaded = true
  mockAuthStore.authPhase = 'authenticated'
  mockAuthStore.currentTenant = { id: 'tenant-1', name: 'Centro', slug: 'centro' }
  mockAuthStore.userCan.mockImplementation(userCan)
}

async function resolvedComponent(router: { currentRoute: { value: { matched: unknown[] } } }) {
  const matched = router.currentRoute.value.matched[0] as { components: { default: unknown } }
  const raw = matched.components.default
  const resolved = typeof raw === 'function' ? await (raw as () => Promise<unknown>)() : raw
  return (resolved as { default?: unknown }).default ?? resolved
}

describe('router — /sistema/envios and /sistema/envios/validaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockAuthStore.accessToken = null
    mockAuthStore.user = null
    mockAuthStore.isAuthenticated = false
    mockAuthStore.permissionsLoaded = false
    mockAuthStore.authPhase = 'idle'
    mockAuthStore.currentTenant = null
    mockAuthStore.userCan.mockReturnValue(false)
  })

  it('resolves Envíos in the dashboard layout, guarded by read:ShippingSettings, keeping the tab query', async () => {
    authenticate((action, subject) => action === 'read' && subject === 'ShippingSettings')
    const { default: router } = await import('../index')

    await router.push({ name: 'sistema-shipping', query: { tab: 'cajas' } })
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/sistema/envios')
    expect(router.currentRoute.value.query.tab).toBe('cajas')
    expect(router.currentRoute.value.meta.layout).toBe('dashboard')
    expect(router.currentRoute.value.meta.permission).toEqual(['read', 'ShippingSettings'])
    expect(router.currentRoute.value.meta.skipTenantCheck).toBeUndefined()
    expect(await resolvedComponent(router)).toBe(
      (await import('@/features/shipping/shipping-settings/views/ShippingSettingsView.vue')).default,
    )
  })

  it('resolves Validaciones de zona, guarded by validate:DeliveryZone', async () => {
    authenticate((action, subject) => action === 'validate' && subject === 'DeliveryZone')
    const { default: router } = await import('../index')

    await router.push('/sistema/envios/validaciones')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('sistema-zone-validations')
    expect(router.currentRoute.value.meta.layout).toBe('dashboard')
    expect(router.currentRoute.value.meta.permission).toEqual(['validate', 'DeliveryZone'])
    expect(await resolvedComponent(router)).toBe(
      (await import('@/features/shipping/delivery-zones/views/ZoneValidationsView.vue')).default,
    )
  })

  it('sends a user with only read:DeliveryZone to /403 on both routes', async () => {
    authenticate((action, subject) => action === 'read' && subject === 'DeliveryZone')
    const { default: router } = await import('../index')

    await router.push('/login')
    await router.isReady()
    await router.push('/sistema/envios')
    expect(router.currentRoute.value.path).toBe('/403')

    await router.push('/sistema/envios/validaciones')
    expect(router.currentRoute.value.path).toBe('/403')
  })
})
