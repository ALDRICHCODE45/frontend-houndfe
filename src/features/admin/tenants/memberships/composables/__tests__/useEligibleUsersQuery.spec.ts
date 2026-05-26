import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useEligibleUsersQuery } from '../useEligibleUsersQuery'

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

describe('useEligibleUsersQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function setupQueryReturn() {
    const { useQuery } = await import('@tanstack/vue-query')
    vi.mocked(useQuery).mockReturnValue({
      data: ref({ data: [] }),
      isLoading: ref(false),
      isError: ref(false),
      error: ref(null),
    } as never)
  }

  it('disables query when search length is 1', async () => {
    await setupQueryReturn()
    const search = ref('a')

    useEligibleUsersQuery(() => 'tenant-1', search)

    const { useQuery } = await import('@tanstack/vue-query')
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as { enabled: { value: boolean } }
    expect(callArgs.enabled.value).toBe(false)
  })

  it('enables query when search is empty', async () => {
    await setupQueryReturn()
    const search = ref('')

    useEligibleUsersQuery(() => 'tenant-1', search)

    const { useQuery } = await import('@tanstack/vue-query')
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as { enabled: { value: boolean } }
    expect(callArgs.enabled.value).toBe(true)
  })

  it('enables query when search length is 2 or more', async () => {
    await setupQueryReturn()
    const search = ref('jo')

    useEligibleUsersQuery(() => 'tenant-1', search)

    const { useQuery } = await import('@tanstack/vue-query')
    const callArgs = vi.mocked(useQuery).mock.calls[0]?.[0] as { enabled: { value: boolean } }
    expect(callArgs.enabled.value).toBe(true)
  })
})
