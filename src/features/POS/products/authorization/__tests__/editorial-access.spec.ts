import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canReadEditorial, canWriteEditorial } from '../editorial-access'

const { auth } = vi.hoisted(() => ({ auth: {
  accessToken: 'synthetic', user: { id: 'user-1' }, isAuthenticated: true,
  currentTenant: { id: 'tenant-1' } as { id: string } | null,
  permissionsLoaded: true, permissionCodes: [] as string[], tempToken: null,
  isSuperAdmin: false, hydrateFromStorage: vi.fn(), fetchMe: vi.fn(),
  fetchPermissions: vi.fn(), clearSession: vi.fn(), userCan: vi.fn(),
} }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
vi.mock('../../views/ProductEditorialView.vue', () => ({ default: { render: () => null } }))
vi.mock('../../views/ProductDetailView.vue', () => ({ default: { render: () => null } }))
vi.mock('@/features/errors/views/ForbiddenView.vue', () => ({ default: { render: () => null } }))
vi.mock('@/features/auth/login/views/LoginView.vue', () => ({ default: { render: () => null } }))
vi.mock('@/features/auth/tenant-selection/views/TenantSelectionView.vue', () => ({ default: { render: () => null } }))
const read = 'read:ProductEditorialDraft'
const update = 'update:ProductEditorialDraft'

describe('exact editorial access and application routing', () => {
  beforeEach(async () => {
    auth.isAuthenticated = true
    auth.accessToken = 'synthetic'
    auth.currentTenant = { id: 'tenant-1' }
    auth.permissionsLoaded = true
    auth.permissionCodes = []
    auth.userCan.mockReturnValue(false)
    const { default: router } = await import('@/app/router')
    await router.push('/403')
  })

  it.each([
    [[], false, false], [[read], true, false], [[update], false, false],
    [[read, update], true, true], [['manage:all'], false, false],
    [['read:Product', 'update:Product', 'manage:ProductEditorialDraft'], false, false],
    [['read:*', '*:ProductEditorialDraft'], false, false],
  ])('checks literal grants %j', (codes, readable, writable) => {
    expect(canReadEditorial(codes as string[])).toBe(readable)
    expect(canWriteEditorial(codes as string[])).toBe(writable)
  })

  it.each([[[read], '/pos/products/p1/editorial'], [[update], '/403'], [['manage:all'], '/403']])(
    'navigates with %j without a Product prerequisite', async (codes, destination) => {
      auth.permissionCodes = codes as string[]
      auth.userCan.mockReturnValue(true) // CASL wildcard allowance must not substitute.
      const { default: router } = await import('@/app/router')
      await router.push('/pos/products/p1/editorial')
      expect(router.currentRoute.value.path).toBe(destination)
    },
  )

  it('waits for permission hydration before the exact check', async () => {
    auth.permissionsLoaded = false
    auth.fetchPermissions.mockImplementationOnce(async () => {
      auth.permissionCodes = [read]
      auth.permissionsLoaded = true
    })
    const { default: router } = await import('@/app/router')
    await router.push('/pos/products/p1/editorial')
    expect(auth.fetchPermissions).toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('pos-product-editorial')
  })

  it('keeps the existing operational Product read gate', async () => {
    auth.permissionCodes = [read]
    const { default: router } = await import('@/app/router')
    await router.push('/pos/products/p1')
    expect(router.currentRoute.value.path).toBe('/403')
    expect(auth.userCan).toHaveBeenCalledWith('read', 'Product')
    auth.userCan.mockImplementation((action, subject) => action === 'read' && subject === 'Product')
    await router.push('/pos/products/p1')
    expect(router.currentRoute.value.name).toBe('pos-product-detail')
  })

  it('requires authentication and a current tenant', async () => {
    auth.permissionCodes = [read]
    auth.isAuthenticated = false
    const { default: router } = await import('@/app/router')
    await router.push('/pos/products/p1/editorial')
    expect(router.currentRoute.value.path).toBe('/login')
    auth.isAuthenticated = true
    auth.currentTenant = null
    await router.push('/pos/products/p1/editorial')
    expect(router.currentRoute.value.path).toBe('/select-tenant')
  })
})
