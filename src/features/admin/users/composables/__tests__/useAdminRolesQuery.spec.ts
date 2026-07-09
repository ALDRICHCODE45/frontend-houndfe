import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useAdminRolesQuery } from '../useAdminRolesQuery'
import { rolesApi } from '../../../roles/api/roles.api'

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

describe('useAdminRolesQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('uses adminRoleQueryKeys.paginated as the cache key for shared cache with the roles table', async () => {
    const { useQuery } = await import('@tanstack/vue-query')

    vi.mocked(useQuery).mockReturnValue({
      data: ref(null),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    } as never)

    useAdminRolesQuery(() => 'tenant-abc')

    // vue-query may receive a MaybeRefOrGetter<options>; unwrap if needed.
    const raw = vi.mocked(useQuery).mock.calls[0]?.[0] as unknown
    const options = (typeof raw === 'function' ? (raw as () => unknown)() : raw) as {
      queryKey?: { value?: readonly unknown[] } | readonly unknown[]
    }
    const key = options.queryKey as { value?: readonly unknown[] } | readonly unknown[]
    const resolved = 'value' in (key as object) ? (key as { value: readonly unknown[] }).value : key
    expect(resolved).toEqual(['admin', 'roles', 'tenant-abc', 'paginated'])
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

    // vue-query may receive a MaybeRefOrGetter<options>; unwrap if needed.
    const raw = vi.mocked(useQuery).mock.calls[0]?.[0] as unknown
    const options = (typeof raw === 'function' ? (raw as () => unknown)() : raw) as {
      queryFn?: () => Promise<unknown>
    }

    await options.queryFn!()

    expect(rolesApi.getPaginated).toHaveBeenCalledTimes(1)
  })
})