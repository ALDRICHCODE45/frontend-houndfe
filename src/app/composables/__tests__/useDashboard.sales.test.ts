import { describe, it, expect, vi } from 'vitest'
import { useDashboard } from '../useDashboard'

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    isSuperAdmin: false,
    userCan: vi.fn().mockReturnValue(true),
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('useDashboard sales actions', () => {
  it('contains Nueva Venta command targeting /pos/ventas/nueva', () => {
    const { searchGroups } = useDashboard()
    const actions = searchGroups.value.find((group) => group.id === 'actions')
    const newSale = actions?.items?.find((item) => item.id === 'new-sale')

    expect(newSale).toBeDefined()
    expect(newSale?.label).toBe('Nueva Venta')
    expect(newSale?.to).toBe('/pos/ventas/nueva')
  })
})
