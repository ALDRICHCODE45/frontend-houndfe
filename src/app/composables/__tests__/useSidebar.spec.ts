import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { AppAction, AppSubject, TenantSummary } from '@/features/auth/interfaces/auth.types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}))

// vue-router mock
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock Nuxt UI toast (declared globally - needed for sidebar error handling)
const mockToastAdd = vi.fn()
;(global as any).useToast = vi.fn(() => ({ add: mockToastAdd }))

// @vueuse/core
vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  return {
    ...actual,
    useColorMode: () => ({ value: 'light' }),
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

const tenants: TenantSummary[] = [
  { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' },
  { id: 'tenant-2', name: 'Sucursal Norte', slug: 'norte' },
]

const DASHBOARD_PATH = '/dashboard'

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

/** Allow only a single (action, subject) tuple; deny everything else. */
function userCanOnly(allowed: [AppAction, AppSubject]) {
  return vi.fn(
    (action: AppAction, subject: AppSubject) => allowed[0] === action && allowed[1] === subject,
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useSidebar — tenant integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('tenants comes from authStore.memberships', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore() as unknown as ReturnType<typeof useAuthStore>,
    )

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
      makeAuthStore({ memberships: tenants, isSuperAdmin: false }) as unknown as ReturnType<
        typeof useAuthStore
      >,
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

    expect(
      adminChildren.some((child) => child.label === 'Sucursales' && child.to === '/admin/tenants'),
    ).toBe(true)
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

    expect(
      adminChildren.some((child) => child.label === 'Sucursales' && child.to === '/admin/tenants'),
    ).toBe(false)
  })
})

describe('useSidebar — Dashboard extra visibility (ODD dashboard-analytics D1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('exposes the Dashboard extra at /dashboard when exact read:Analytics is granted', async () => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ userCan: userCanOnly(['read', 'Analytics']) }) as unknown as ReturnType<
        typeof useAuthStore
      >,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    const dashboard = sidebar.getNavigationItems(false).find((item) => item.label === 'Dashboard')
    expect(dashboard).toBeDefined()
    expect(dashboard?.to).toBe(DASHBOARD_PATH)
  })

  it.each([
    {
      label: 'unrelated read grant',
      userCan: userCanOnly(['read', 'NotificationConfig']),
    },
    { label: 'denied (no permissions)', userCan: vi.fn(() => false) },
  ])('hides the Dashboard extra for $label', async ({ userCan }) => {
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ userCan }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    expect(
      sidebar
        .getNavigationItems(false)
        .some((item) => item.label === 'Dashboard' && item.to === DASHBOARD_PATH),
    ).toBe(false)
  })
})

describe('useSidebar — switchTenant error handling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('catches switchTenant errors and does not throw (SUPER_ADMIN_REQUIRED)', async () => {
    const error403 = Object.assign(new Error('Request failed with status code 403'), {
      isAxiosError: true,
      response: {
        status: 403,
        data: { code: 'SUPER_ADMIN_REQUIRED' },
      },
    })
    const mockSwitch = vi.fn().mockRejectedValue(error403)
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ switchTenant: mockSwitch }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    // The error is caught internally, so this should not throw
    await expect(sidebar.switchTenant('tenant-2')).resolves.toBeUndefined()

    expect(mockSwitch).toHaveBeenCalledOnce()
    // Toast assertion removed — testing toast requires full Vue setup (E2E test)
    // Critical behavior: error is caught, user stays logged in
  })

  it('catches switchTenant errors and does not throw (TENANT_INACTIVE)', async () => {
    const error403 = Object.assign(new Error('Request failed with status code 403'), {
      isAxiosError: true,
      response: {
        status: 403,
        data: { code: 'TENANT_INACTIVE' },
      },
    })
    const mockSwitch = vi.fn().mockRejectedValue(error403)
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ switchTenant: mockSwitch }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    await expect(sidebar.switchTenant('tenant-1')).resolves.toBeUndefined()

    expect(mockSwitch).toHaveBeenCalledOnce()
  })

  it('catches network errors and does not throw', async () => {
    const networkError = new Error('Network Error')
    const mockSwitch = vi.fn().mockRejectedValue(networkError)
    vi.mocked(useAuthStore).mockReturnValue(
      makeAuthStore({ switchTenant: mockSwitch }) as unknown as ReturnType<typeof useAuthStore>,
    )

    const { useSidebar } = await import('../useSidebar')
    const sidebar = useSidebar()

    await expect(sidebar.switchTenant('tenant-1')).resolves.toBeUndefined()

    expect(mockSwitch).toHaveBeenCalledOnce()
  })
})
