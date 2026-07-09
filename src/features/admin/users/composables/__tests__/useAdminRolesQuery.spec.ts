import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'
import { useAdminRolesQuery } from '../useAdminRolesQuery'
import { rolesApi } from '../../../roles/api/roles.api'

// ─── Reactive auth-store mock ────────────────────────────────────────────────
// Mirrors the auth-store contract that useAdminRolesQuery depends on:
//   - currentTenantId: reactive string (ComputedRef in production)
//   - userCan(action, subject): boolean
//
// In production, `userCan` reads `permissionCodes.value` (a ref) so the
// composable's `enabled` computed re-evaluates whenever permissions change.
// The mock mirrors that: `mockUserCan` reads `mockPermissionCodes.value`,
// so tests drive permission state by mutating the ref.
const mockPermissionCodes = ref<string[]>(['read:Role'])
const mockUserCan = vi.fn((action: string, subject: string) =>
  mockPermissionCodes.value.includes(`${action}:${subject}`),
)
const mockCurrentTenantId = ref('tenant-1')

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

vi.mock('../../../roles/api/roles.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../roles/api/roles.api')>()
  return {
    ...actual,
    rolesApi: {
      getPaginated: vi.fn(),
    },
  }
})

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: mockUserCan,
    currentTenantId: computed(() => mockCurrentTenantId.value),
  }),
}))

// ─── Test helpers ────────────────────────────────────────────────────────────

interface ResolvedQueryOptions {
  queryKey?: { value?: readonly unknown[] } | readonly unknown[]
  enabled?: { value: boolean }
  queryFn?: () => Promise<unknown>
}

async function resolveQueryOptions(): Promise<ResolvedQueryOptions> {
  const { useQuery } = await import('@tanstack/vue-query')
  const calls = vi.mocked(useQuery).mock.calls
  const lastCall = calls[calls.length - 1]
  const raw = lastCall?.[0] as unknown
  return (typeof raw === 'function' ? (raw as () => unknown)() : raw) as ResolvedQueryOptions
}

async function resolveQueryKey(): Promise<readonly unknown[]> {
  const { queryKey } = await resolveQueryOptions()
  if (!queryKey) throw new Error('queryKey was not provided to useQuery')
  return 'value' in (queryKey as object)
    ? (queryKey as { value: readonly unknown[] }).value
    : (queryKey as readonly unknown[])
}

async function resolveEnabled(): Promise<boolean> {
  const { enabled } = await resolveQueryOptions()
  if (!enabled) throw new Error('enabled was not provided to useQuery')
  return (enabled as { value: boolean }).value
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useAdminRolesQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPermissionCodes.value = ['read:Role']
    mockCurrentTenantId.value = 'tenant-1'
  })

  it('returns role options mapped from getPaginated response', async () => {
    const { useQuery } = await import('@tanstack/vue-query')
    vi.mocked(rolesApi.getPaginated).mockResolvedValue({
      data: [
        { id: 'role-1', name: 'Admin' },
        { id: 'role-2', name: 'Cashier' },
      ],
      pagination: {
        pageIndex: 0,
        pageSize: 10,
        totalCount: 2,
        pageCount: 1,
      },
    } as never)

    vi.mocked(useQuery).mockReturnValue({
      data: ref({
        data: [
          { id: 'role-1', name: 'Admin' },
          { id: 'role-2', name: 'Cashier' },
        ],
        pagination: {
          pageIndex: 0,
          pageSize: 10,
          totalCount: 2,
          pageCount: 1,
        },
      }),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    } as never)

    const { roleOptions } = useAdminRolesQuery(() => 'tenant-1')

    expect(roleOptions.value).toEqual([
      { value: 'role-1', label: 'Admin' },
      { value: 'role-2', label: 'Cashier' },
    ])
  })

  it('returns an empty array when query data is null', async () => {
    const { useQuery } = await import('@tanstack/vue-query')

    vi.mocked(useQuery).mockReturnValue({
      data: ref(null),
      isLoading: ref(true),
      isError: ref(false),
      error: ref(null),
    } as never)

    const { roleOptions } = useAdminRolesQuery(() => 'tenant-1')

    expect(roleOptions.value).toEqual([])
  })

  it('exposes loading and error flags from useQuery', async () => {
    const { useQuery } = await import('@tanstack/vue-query')

    vi.mocked(useQuery).mockReturnValue({
      data: ref(null),
      isLoading: ref(true),
      isError: ref(false),
      error: ref(null),
    } as never)

    const { isLoading, isError } = useAdminRolesQuery(() => 'tenant-1')

    expect(isLoading.value).toBe(true)
    expect(isError.value).toBe(false)
  })

  it('uses adminRoleQueryKeys.paginated(tenantId) as the picker cache key', async () => {
    const { useQuery } = await import('@tanstack/vue-query')

    vi.mocked(useQuery).mockReturnValue({
      data: ref(null),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    } as never)

    useAdminRolesQuery(() => 'tenant-abc')

    // The picker uses the paginated BASE key (no serverParams suffix). This is
    // intentionally NOT the same cache entry as the AdminRolesView table query,
    // which appends serverParams to the same base via useServerTable.
    expect(await resolveQueryKey()).toEqual(['admin', 'roles', 'tenant-abc', 'paginated'])
  })

  it('calls rolesApi.getPaginated to fetch roles from GET /admin/roles', async () => {
    const { useQuery } = await import('@tanstack/vue-query')

    vi.mocked(useQuery).mockReturnValue({
      data: ref(null),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    } as never)

    useAdminRolesQuery(() => 'tenant-1')

    const { queryFn } = await resolveQueryOptions()
    await queryFn!()

    expect(rolesApi.getPaginated).toHaveBeenCalledTimes(1)
  })

  it('requests pageSize 1000 to fetch all roles for the picker in one call', async () => {
    const { useQuery } = await import('@tanstack/vue-query')

    vi.mocked(useQuery).mockReturnValue({
      data: ref(null),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    } as never)

    useAdminRolesQuery(() => 'tenant-1')

    const { queryFn } = await resolveQueryOptions()
    await queryFn!()

    expect(rolesApi.getPaginated).toHaveBeenCalledWith({
      pageIndex: 0,
      pageSize: 1000,
    })
  })

  // ─── enabled gate ──────────────────────────────────────────────────────────

  describe('enabled gate', () => {
    it('is disabled when tenantId is empty', async () => {
      const { useQuery } = await import('@tanstack/vue-query')
      mockCurrentTenantId.value = ''
      vi.mocked(useQuery).mockReturnValue({
        data: ref(null),
        isLoading: ref(false),
        isError: ref(false),
        error: ref(null),
      } as never)

      useAdminRolesQuery(() => mockCurrentTenantId.value)

      expect(await resolveEnabled()).toBe(false)
    })

    it('is disabled when user lacks read:Role permission', async () => {
      const { useQuery } = await import('@tanstack/vue-query')
      mockPermissionCodes.value = [] // no permissions at all
      vi.mocked(useQuery).mockReturnValue({
        data: ref(null),
        isLoading: ref(false),
        isError: ref(false),
        error: ref(null),
      } as never)

      useAdminRolesQuery(() => 'tenant-1')

      expect(await resolveEnabled()).toBe(false)
    })

    it('is enabled when tenantId is present AND user has read:Role permission', async () => {
      const { useQuery } = await import('@tanstack/vue-query')
      vi.mocked(useQuery).mockReturnValue({
        data: ref(null),
        isLoading: ref(false),
        isError: ref(false),
        error: ref(null),
      } as never)

      useAdminRolesQuery(() => 'tenant-1')

      expect(await resolveEnabled()).toBe(true)
    })

    it('re-checks the gate when userCan is called from the enabled computed (no cache)', async () => {
      // Each reactivity tick of the enabled computed must consult the current
      // permission codes — not capture a stale boolean at composable-call time.
      const { useQuery } = await import('@tanstack/vue-query')
      vi.mocked(useQuery).mockReturnValue({
        data: ref(null),
        isLoading: ref(false),
        isError: ref(false),
        error: ref(null),
      } as never)

      useAdminRolesQuery(() => 'tenant-1')

      // Baseline: enabled, canRead=true (default mock has 'read:Role')
      expect(await resolveEnabled()).toBe(true)

      // Now flip the permission codes off — the reactive signal triggers the
      // computed to re-read userCan() with the new codes
      mockPermissionCodes.value = []
      expect(await resolveEnabled()).toBe(false)
    })
  })

  // ─── reactivity ────────────────────────────────────────────────────────────

  describe('reactivity', () => {
    it('updates the query key when tenantId changes', async () => {
      const { useQuery } = await import('@tanstack/vue-query')
      vi.mocked(useQuery).mockReturnValue({
        data: ref(null),
        isLoading: ref(false),
        isError: ref(false),
        error: ref(null),
      } as never)

      const tenantId = ref('tenant-A')
      useAdminRolesQuery(tenantId)

      expect(await resolveQueryKey()).toEqual(['admin', 'roles', 'tenant-A', 'paginated'])

      tenantId.value = 'tenant-B'
      expect(await resolveQueryKey()).toEqual(['admin', 'roles', 'tenant-B', 'paginated'])
    })

    it('flips the enabled gate when tenantId changes from empty to set', async () => {
      const { useQuery } = await import('@tanstack/vue-query')
      vi.mocked(useQuery).mockReturnValue({
        data: ref(null),
        isLoading: ref(false),
        isError: ref(false),
        error: ref(null),
      } as never)

      const tenantId = ref('')
      useAdminRolesQuery(tenantId)

      expect(await resolveEnabled()).toBe(false)

      tenantId.value = 'tenant-X'
      expect(await resolveEnabled()).toBe(true)
    })
  })
})
