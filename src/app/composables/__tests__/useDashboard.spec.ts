import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function makeAuthStore(overrides: Record<string, unknown> = {}) {
  return {
    isSuperAdmin: false,
    userCan: vi.fn(() => true),
    ...overrides,
  }
}

describe('useDashboard command visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows Admin / Sucursales command for super-admin users', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ isSuperAdmin: true }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useDashboard } = await import('../useDashboard')
    const dashboard = useDashboard()

    const pagesGroup = dashboard.searchGroups.value.find((group) => group.id === 'pages')
    const pageItems = pagesGroup?.items ?? []

    expect(pageItems.some((item) => item.id === 'admin-tenants' && item.to === '/admin/tenants')).toBe(true)
  })

  it('hides Admin / Sucursales command for non-super-admin users', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ isSuperAdmin: false }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useDashboard } = await import('../useDashboard')
    const dashboard = useDashboard()

    const pagesGroup = dashboard.searchGroups.value.find((group) => group.id === 'pages')
    const pageItems = pagesGroup?.items ?? []

    expect(pageItems.some((item) => item.id === 'admin-tenants' && item.to === '/admin/tenants')).toBe(false)
  })
})
