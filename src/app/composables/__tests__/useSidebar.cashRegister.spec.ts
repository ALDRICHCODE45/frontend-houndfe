// useSidebar.cashRegister.spec.ts — the sidebar surfaces "Caja" only when the
// identity holds read:CashRegister (cash-register-ui T2, S1 subset).
//
// Mirrors useSidebar.sales.test.ts: mock the auth store and the router, then
// drive the real `getNavigationItems` through the shared access filter.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const userCan = vi.fn()

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { name: 'Test User' },
    memberships: [],
    isSuperAdmin: false,
    currentTenant: null,
    currentTenantId: 'tenant-1',
    userCan,
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

import { useSidebar } from '../useSidebar'

describe('useSidebar — Caja entry (cash-register-ui T2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    userCan.mockReset()
  })

  it('shows Caja inside POS when read:CashRegister is granted', () => {
    userCan.mockImplementation(
      (action: string, subject: string) => action === 'read' && subject === 'CashRegister',
    )

    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    const posSection = items.find((item) => item.label === 'POS')
    const caja = posSection?.children?.find((child) => child.label === 'Caja')

    expect(caja?.to).toBe('/pos/caja')
  })

  it('hides Caja when read:CashRegister is absent', () => {
    userCan.mockReturnValue(false)

    const { getNavigationItems } = useSidebar()
    const items = getNavigationItems(false)
    const posSection = items.find((item) => item.label === 'POS')

    expect(posSection?.children?.some((child) => child.label === 'Caja') ?? false).toBe(false)
  })
})
