import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useMembershipOptions } from '../useMembershipOptions'

vi.mock('@/features/admin/users/api/users.api', () => ({
  usersApi: {
    getPaginated: vi.fn(),
  },
}))

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

describe('useMembershipOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters only active users not already in memberships', async () => {
    const { useQuery } = await import('@tanstack/vue-query')

    vi.mocked(useQuery)
      .mockReturnValueOnce({
        data: ref({
          data: [
            { id: 'u-1', name: 'Ana', email: 'ana@test.com', isActive: true },
            { id: 'u-2', name: 'Luis', email: 'luis@test.com', isActive: false },
            { id: 'u-3', name: 'Mora', email: 'mora@test.com', isActive: true },
          ],
        }),
        isLoading: ref(false),
      } as never)
      .mockReturnValueOnce({
        data: ref({ data: [{ id: 'r-1', name: 'Admin' }] }),
        isLoading: ref(false),
      } as never)
      .mockReturnValueOnce({
        data: ref({ data: [{ userId: 'u-3' }] }),
        isLoading: ref(false),
      } as never)

    const { userOptions, roleOptions } = useMembershipOptions(() => 'tenant-1')

    expect(userOptions.value).toEqual([{ value: 'u-1', label: 'Ana · ana@test.com' }])
    expect(roleOptions.value).toEqual([{ value: 'r-1', label: 'Admin' }])
  })

  it('loads users in pages with backend-safe limit', async () => {
    const { useQuery } = await import('@tanstack/vue-query')
    const { usersApi } = await import('@/features/admin/users/api/users.api')

    vi.mocked(usersApi.getPaginated)
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, idx) => ({
          id: `u-${idx + 1}`,
          name: `User ${idx + 1}`,
          email: `user${idx + 1}@test.com`,
          isActive: true,
        })),
        pagination: { pageIndex: 0, pageSize: 100, totalCount: 101, pageCount: 2 },
      } as never)
      .mockResolvedValueOnce({
        data: [{ id: 'u-101', name: 'User 101', email: 'user101@test.com', isActive: true }],
        pagination: { pageIndex: 1, pageSize: 100, totalCount: 101, pageCount: 2 },
      } as never)

    const mockedUseQuery = vi.mocked(useQuery)
    mockedUseQuery.mockReturnValue({
      data: ref({ data: [] }),
      isLoading: ref(false),
    } as never)

    useMembershipOptions(() => 'tenant-1')

    const usersQueryConfig = mockedUseQuery.mock.calls[0]?.[0] as unknown as {
      queryFn: () => Promise<unknown>
    }
    await usersQueryConfig.queryFn()

    expect(usersApi.getPaginated).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ pageIndex: 0, pageSize: 100 }),
    )
    expect(usersApi.getPaginated).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pageIndex: 1, pageSize: 100 }),
    )
  })

  it('stops pagination after first non-full page', async () => {
    const { useQuery } = await import('@tanstack/vue-query')
    const { usersApi } = await import('@/features/admin/users/api/users.api')

    vi.mocked(usersApi.getPaginated).mockResolvedValueOnce({
      data: [{ id: 'u-1', name: 'User 1', email: 'user1@test.com', isActive: true }],
      pagination: { pageIndex: 0, pageSize: 100, totalCount: 1, pageCount: 1 },
    } as never)

    const mockedUseQuery = vi.mocked(useQuery)
    mockedUseQuery.mockReturnValue({
      data: ref({ data: [] }),
      isLoading: ref(false),
    } as never)

    useMembershipOptions(() => 'tenant-1')

    const usersQueryConfig = mockedUseQuery.mock.calls[0]?.[0] as unknown as {
      queryFn: () => Promise<unknown>
    }
    await usersQueryConfig.queryFn()

    expect(usersApi.getPaginated).toHaveBeenCalledTimes(1)
    expect(usersApi.getPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 0, pageSize: 100 }),
    )
  })
})
