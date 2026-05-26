import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useTenantRolesQuery } from '../useTenantRolesQuery'

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

describe('useTenantRolesQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns roles for tenant through useQuery result', async () => {
    const { useQuery } = await import('@tanstack/vue-query')

    vi.mocked(useQuery).mockReturnValue({
      data: ref([{ id: '1', name: 'Admin' }]),
      isLoading: ref(false),
      isError: ref(false),
    } as never)

    const { roles } = useTenantRolesQuery(() => 'tenant-1')

    expect(roles.value).toEqual([{ id: '1', name: 'Admin' }])
  })
})
