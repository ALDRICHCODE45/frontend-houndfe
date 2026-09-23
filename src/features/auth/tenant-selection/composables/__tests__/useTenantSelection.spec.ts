import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import type { TenantSummary } from '@/features/auth/interfaces/auth.types'
import { useTenantSelection } from '../useTenantSelection'

const pushMock = vi.fn()

const mockAuthStore = {
  memberships: [] as TenantSummary[],
  tempToken: null as string | null,
  isSuperAdmin: false,
  currentTenant: null as TenantSummary | null,
  userCan: vi.fn().mockReturnValue(true) as ReturnType<typeof vi.fn>,
  selectTenant: vi.fn(),
  switchTenant: vi.fn(),
  clearSession: vi.fn(),
}

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => mockAuthStore,
}))

function resetStore() {
  mockAuthStore.tempToken = null
  mockAuthStore.isSuperAdmin = false
  mockAuthStore.currentTenant = null
  mockAuthStore.userCan.mockReturnValue(true)
  mockAuthStore.memberships = [
    { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' },
    { id: 'tenant-2', name: 'Sucursal Norte', slug: 'norte' },
  ]
}

describe('useTenantSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('uses selectTenant flow when tempToken exists and lands on /dashboard', async () => {
    mockAuthStore.tempToken = 'temp-token-123'
    mockAuthStore.selectTenant.mockResolvedValue(undefined)

    const tenantSelection = useTenantSelection()
    await tenantSelection.submit('tenant-2')

    expect(mockAuthStore.selectTenant).toHaveBeenCalledWith('tenant-2')
    expect(mockAuthStore.switchTenant).not.toHaveBeenCalled()
    // D1: success destination is the resolver's first permitted path
    // (with userCan=true, read:Analytics grants /dashboard).
    expect(pushMock).toHaveBeenCalledWith('/dashboard')
    expect(tenantSelection.isSubmitting.value).toBe(false)
  })

  it('uses switchTenant flow for super-admin in global context and lands on /dashboard', async () => {
    mockAuthStore.isSuperAdmin = true
    mockAuthStore.currentTenant = null
    mockAuthStore.switchTenant.mockResolvedValue(undefined)

    const tenantSelection = useTenantSelection()
    await tenantSelection.submit('tenant-1')

    expect(mockAuthStore.switchTenant).toHaveBeenCalledWith('tenant-1')
    expect(mockAuthStore.selectTenant).not.toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith('/dashboard')
  })

  it('sets explicit error when auth state does not allow tenant selection', async () => {
    const tenantSelection = useTenantSelection()
    await tenantSelection.submit('tenant-1')

    expect(tenantSelection.error.value).toBe(
      'Estado de autenticación inválido para seleccionar sucursal',
    )
    expect(mockAuthStore.selectTenant).not.toHaveBeenCalled()
    expect(mockAuthStore.switchTenant).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalledWith('/')
  })

  it('redirects to login with expiry flag on expired temp token', async () => {
    mockAuthStore.tempToken = 'temp-token-123'
    mockAuthStore.selectTenant.mockRejectedValue({
      response: { status: 401 },
    })

    const tenantSelection = useTenantSelection()
    await tenantSelection.submit('tenant-1')

    expect(pushMock).toHaveBeenCalledWith({ path: '/login', query: { expired: 'tenant' } })
    expect(tenantSelection.error.value).toBeNull()
    expect(tenantSelection.isSubmitting.value).toBe(false)
  })

  it('stores API message for non-401 errors', async () => {
    mockAuthStore.tempToken = 'temp-token-123'
    mockAuthStore.selectTenant.mockRejectedValue({
      response: { status: 400, data: { message: 'No tienes acceso a esta sucursal' } },
    })

    const tenantSelection = useTenantSelection()
    await tenantSelection.submit('tenant-1')
    await nextTick()

    expect(tenantSelection.error.value).toBe('No tienes acceso a esta sucursal')
    expect(pushMock).not.toHaveBeenCalledWith('/')
  })

  it('cancel clears temp state and redirects to login', () => {
    const tenantSelection = useTenantSelection()

    tenantSelection.cancel()

    expect(mockAuthStore.clearSession).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/login')
  })
})

describe('useTenantSelection — non-Dashboard resolver outcomes (ODD dashboard-analytics D1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it.each([
    {
      label: '/pos/ventas when only read:Sale is granted (selectTenant flow)',
      setup: () => {
        mockAuthStore.tempToken = 'temp-token-123'
        mockAuthStore.selectTenant.mockResolvedValue(undefined)
        mockAuthStore.userCan.mockImplementation(
          (action: string, subject: string) => action === 'read' && subject === 'Sale',
        )
      },
      tenantId: 'tenant-2',
      expectedPush: '/pos/ventas',
    },
    {
      label: '/403 when no application route is accessible',
      setup: () => {
        mockAuthStore.tempToken = 'temp-token-123'
        mockAuthStore.selectTenant.mockResolvedValue(undefined)
        mockAuthStore.userCan.mockReturnValue(false)
      },
      tenantId: 'tenant-1',
      expectedPush: '/403',
    },
  ])('lands on $label', async ({ setup, tenantId, expectedPush }) => {
    setup()
    const tenantSelection = useTenantSelection()

    await tenantSelection.submit(tenantId)

    expect(pushMock).toHaveBeenCalledWith(expectedPush)
    expect(pushMock).not.toHaveBeenCalledWith('/dashboard')
  })
})
