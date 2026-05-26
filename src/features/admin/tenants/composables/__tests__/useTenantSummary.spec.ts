import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useTenantSummary } from '../useTenantSummary'

vi.mock('@/features/admin/tenants/api/tenants.api', () => ({
  tenantsApi: {
    getById: vi.fn(),
  },
}))

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}))

describe('useTenantSummary', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  async function setupAuthStore(currentTenant: { id: string; name: string } | null) {
    const { useAuthStore } = await import('@/features/auth/stores/useAuthStore')
    // Pinia unwraps refs at access time, so mock the unwrapped value
    vi.mocked(useAuthStore).mockReturnValue({
      currentTenant,
    } as never)
  }

  async function setupQueryReturn(opts: {
    data?: { id: string; name: string } | null
    isLoading?: boolean
    isError?: boolean
  }) {
    const { useQuery } = await import('@tanstack/vue-query')
    vi.mocked(useQuery).mockReturnValue({
      data: ref(opts.data ?? null),
      isLoading: ref(opts.isLoading ?? false),
      isError: ref(opts.isError ?? false),
    } as never)
  }

  it('returns the active store tenant name without calling the API when ids match', async () => {
    await setupAuthStore({ id: 'tenant-1', name: 'Centro' })
    await setupQueryReturn({})

    const { tenantName, isLoadingTenantName } = useTenantSummary(() => 'tenant-1')

    expect(tenantName.value).toBe('Centro')
    expect(isLoadingTenantName.value).toBe(false)

    const { useQuery } = await import('@tanstack/vue-query')
    // useQuery is invoked but the query is disabled (enabled=false)
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as { enabled: { value: boolean } }
    expect(callArgs.enabled.value).toBe(false)
  })

  it('returns the fetched tenant name when route tenant differs from active tenant', async () => {
    await setupAuthStore({ id: 'tenant-1', name: 'Centro' })
    await setupQueryReturn({ data: { id: 'tenant-2', name: 'Norte' } })

    const { tenantName } = useTenantSummary(() => 'tenant-2')

    expect(tenantName.value).toBe('Norte')

    const { useQuery } = await import('@tanstack/vue-query')
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as { enabled: { value: boolean } }
    expect(callArgs.enabled.value).toBe(true)
  })

  it('falls back to the literal tenantId when fetch fails', async () => {
    await setupAuthStore({ id: 'tenant-1', name: 'Centro' })
    await setupQueryReturn({ isError: true })

    const { tenantName } = useTenantSummary(() => 'tenant-zzz')

    expect(tenantName.value).toBe('tenant-zzz')
  })

  it('reports loading state while fetching cross-tenant name', async () => {
    await setupAuthStore({ id: 'tenant-1', name: 'Centro' })
    await setupQueryReturn({ isLoading: true })

    const { isLoadingTenantName } = useTenantSummary(() => 'tenant-2')

    expect(isLoadingTenantName.value).toBe(true)
  })

  it('does not report loading when ids match (store hit)', async () => {
    await setupAuthStore({ id: 'tenant-1', name: 'Centro' })
    await setupQueryReturn({ isLoading: true })

    const { isLoadingTenantName } = useTenantSummary(() => 'tenant-1')

    expect(isLoadingTenantName.value).toBe(false)
  })
})
