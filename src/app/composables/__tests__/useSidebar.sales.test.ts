import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSidebar } from '../useSidebar'

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { name: 'Test User' },
    memberships: [],
    isSuperAdmin: false,
    currentTenant: null,
    userCan: vi.fn().mockReturnValue(true),
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  return { ...actual, useColorMode: () => ({ value: 'light' }) }
})

describe('useSidebar sales links', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('has Nueva Venta as top-level item and Ventas inside POS', () => {
    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    const nuevaVenta = items.find((item) => item.label === 'Nueva Venta')
    const posSection = items.find((item) => item.label === 'POS')
    const ventas = posSection?.children?.find((child) => child.label === 'Ventas')

    expect(nuevaVenta?.to).toBe('/pos/ventas/nueva')
    expect(ventas?.to).toBe('/pos/ventas')
    expect(posSection?.children?.some((child) => child.label === 'Nueva Venta')).toBe(false)
  })
})
