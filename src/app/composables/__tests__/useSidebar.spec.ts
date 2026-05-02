import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}))

// vue-router mock
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// @vueuse/core
vi.mock('@vueuse/core', () => ({
  useColorMode: () => ({ value: 'light' }),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

import type { TenantSummary } from '@/features/auth/interfaces/auth.types'

const tenants: TenantSummary[] = [
  { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' },
  { id: 'tenant-2', name: 'Sucursal Norte', slug: 'norte' },
]

function makeAuthStore(overrides: Record<string, unknown> = {}) {
  return {
    memberships: tenants,
    currentTenant: tenants[0],
    isSuperAdmin: false,
    switchTenant: vi.fn().mockResolvedValue(undefined),
    userCan: vi.fn(() => true),
    user: { name: 'Test User' },
    logout: vi.fn(),
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useSidebar — tenant integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('tenants comes from authStore.memberships', async () => {
    vi.mocked(useAuthStore).mockReturnValue(makeAuthStore() as unknown as ReturnType<typeof useAuthStore>)

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    expect(sidebar.tenants.value).toEqual(tenants)
    expect(sidebar.tenants.value).toHaveLength(2)
    expect(sidebar.tenants.value[0]!.id).toBe('tenant-1')
  })

  it('currentTenantLabel returns tenant name when a tenant is active', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({
        currentTenant: { id: 'tenant-2', name: 'Sucursal Norte', slug: 'norte' },
        isSuperAdmin: false,
      }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    expect(sidebar.currentTenantLabel.value).toBe('Sucursal Norte')
  })

  it('currentTenantLabel returns "(Global)" for super-admin with no tenant', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({
        currentTenant: null,
        isSuperAdmin: true,
      }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    expect(sidebar.currentTenantLabel.value).toBe('(Global)')
  })

  it('switchTenant(id) delegates to authStore.switchTenant', async () => {
    const mockSwitch = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ switchTenant: mockSwitch }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    await sidebar.switchTenant('tenant-2')

    expect(mockSwitch).toHaveBeenCalledOnce()
    expect(mockSwitch).toHaveBeenCalledWith('tenant-2')
  })

  it('switchTenant(null) delegates null to authStore.switchTenant (super-admin global)', async () => {
    const mockSwitch = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({
        isSuperAdmin: true,
        currentTenant: null,
        switchTenant: mockSwitch,
      }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    await sidebar.switchTenant(null)

    expect(mockSwitch).toHaveBeenCalledOnce()
    expect(mockSwitch).toHaveBeenCalledWith(null)
  })

  it('showTenantSwitcher is true when user has multiple memberships', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ memberships: tenants, isSuperAdmin: false }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    expect(sidebar.showTenantSwitcher.value).toBe(true)
  })

  it('showTenantSwitcher is true when user is super-admin (even with single membership)', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({
        memberships: [tenants[0]!],
        isSuperAdmin: true,
      }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    expect(sidebar.showTenantSwitcher.value).toBe(true)
  })

  it('showTenantSwitcher is false for single-tenant non-admin user', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({
        memberships: [tenants[0]!],
        isSuperAdmin: false,
      }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    expect(sidebar.showTenantSwitcher.value).toBe(false)
  })

  it('shows Admin > Sucursales only for super-admin', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({
        isSuperAdmin: true,
      }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    const items = sidebar.getNavigationItems(false)
    const adminSection = items.find((item) => item.label === 'Admin')
    const adminChildren = adminSection?.children ?? []

    expect(adminChildren.some((child) => child.label === 'Sucursales' && child.to === '/admin/tenants')).toBe(true)
  })

  it('hides Admin > Sucursales for non-super-admin users', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({
        isSuperAdmin: false,
      }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    const items = sidebar.getNavigationItems(false)
    const adminSection = items.find((item) => item.label === 'Admin')
    const adminChildren = adminSection?.children ?? []

    expect(adminChildren.some((child) => child.label === 'Sucursales' && child.to === '/admin/tenants')).toBe(false)
  })
})
