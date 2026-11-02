import { beforeEach, describe, expect, it, vi } from 'vitest'
import { navigationGroups } from '@/app/navigation/navigation.registry'
import { filterAccessibleGroups } from '@/app/navigation/navigation.access'
const auth = vi.hoisted(() => ({
  accessToken: 'token', user: { id: 'user' }, isAuthenticated: true,
  permissionsLoaded: true, authPhase: 'authenticated',
  currentTenant: { id: 'branch', name: 'Centro', slug: 'centro' },
  isSuperAdmin: false, tempToken: null,
  hydrateFromStorage: vi.fn(), fetchMe: vi.fn(), fetchPermissions: vi.fn(), clearSession: vi.fn(),
  userCan: vi.fn(),
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
vi.mock('@/features/procurement/suppliers/views/SupplierView.vue', () => ({ default: { name: 'SupplierView' } }))
vi.mock('@/features/errors/views/ForbiddenView.vue', () => ({ default: { name: 'ForbiddenView' } }))
vi.mock('@/features/auth/login/views/LoginView.vue', () => ({ default: { name: 'LoginView' } }))
describe('supplier route and canonical navigation', () => {
  beforeEach(() => { auth.userCan.mockReturnValue(false) })
  it('registers a protected supplier route and a matching navigation entry', async () => {
    const { default: router } = await import('../index')
    const route = router.getRoutes().find(item => item.path === '/procurement/suppliers')
    expect(route?.meta.permission).toEqual(['read', 'ProcurementSupplier'])
    expect(route?.meta.layout).toBe('dashboard')
    const groups = filterAccessibleGroups(navigationGroups, permission => permission?.[0] === 'read' && permission?.[1] === 'ProcurementSupplier')
    expect(groups.flatMap(group => group.children).map(child => child.to)).toEqual(['/procurement/suppliers'])
    expect(filterAccessibleGroups(navigationGroups, () => false)).toEqual([])
  })
  it('denies direct navigation without read permission, allows an explicit grant', async () => {
    const { default: router } = await import('../index')
    await router.push('/procurement/suppliers')
    expect(router.currentRoute.value.path).toBe('/403')
    auth.userCan.mockImplementation((action, subject) => action === 'read' && subject === 'ProcurementSupplier')
    await router.push('/procurement/suppliers')
    expect(router.currentRoute.value.path).toBe('/procurement/suppliers')
  })
})
