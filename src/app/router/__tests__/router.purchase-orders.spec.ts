import { beforeEach, describe, expect, it, vi } from 'vitest'
import { navigationGroups } from '@/app/navigation/navigation.registry'
import { filterAccessibleGroups } from '@/app/navigation/navigation.access'
const auth = vi.hoisted(() => ({
  accessToken: 'token', user: { id: 'user' }, isAuthenticated: true,
  permissionsLoaded: true, authPhase: 'authenticated',
  currentTenant: { id: 'branch', name: 'Centro', slug: 'centro' },
  isSuperAdmin: false, tempToken: null,
  hydrateFromStorage: vi.fn(), fetchMe: vi.fn(), fetchPermissions: vi.fn(), clearSession: vi.fn(), userCan: vi.fn(),
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => auth }))
vi.mock('@/features/procurement/purchase-orders/views/PurchaseOrderView.vue', () => ({ default: { name: 'PurchaseOrderView' } }))
vi.mock('@/features/errors/views/ForbiddenView.vue', () => ({ default: { name: 'ForbiddenView' } }))
vi.mock('@/features/auth/login/views/LoginView.vue', () => ({ default: { name: 'LoginView' } }))
describe('purchase order route and canonical navigation', () => {
  beforeEach(() => { auth.userCan.mockReturnValue(false) })
  it('protects the list and places it next to suppliers under Compras', async () => {
    const { default: router } = await import('../index')
    const route = router.getRoutes().find(item => item.path === '/procurement/purchase-orders')
    expect(route?.meta.permission).toEqual(['read', 'ProcurementPurchaseOrder'])
    expect(route?.meta.layout).toBe('dashboard')
    const group = navigationGroups.find(item => item.id === 'procurement')!
    expect(group.label).toBe('Compras')
    expect(group.children.map(child => child.to)).toEqual(['/procurement/suppliers', '/procurement/purchase-orders'])
    const groups = filterAccessibleGroups(navigationGroups, permission => permission?.[0] === 'read' && permission?.[1] === 'ProcurementPurchaseOrder')
    expect(groups.flatMap(item => item.children).map(child => child.to)).toEqual(['/procurement/purchase-orders'])
  })
  it('denies direct navigation without read and permits an explicit grant', async () => {
    const { default: router } = await import('../index')
    await router.push('/procurement/purchase-orders')
    expect(router.currentRoute.value.path).toBe('/403')
    auth.userCan.mockImplementation((action, subject) => action === 'read' && subject === 'ProcurementPurchaseOrder')
    await router.push('/procurement/purchase-orders')
    expect(router.currentRoute.value.path).toBe('/procurement/purchase-orders')
  })
})
