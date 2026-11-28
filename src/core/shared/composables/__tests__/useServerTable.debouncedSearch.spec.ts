/**
 * customers-bulk-actions T1b (L5): the search the request carries is the debounced one, so a screen
 * that builds another request from the same search (the customers bulk «filter» selection) must read
 * that debounced value — not the raw input — to agree with the listing's N.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { ServerTableParams } from '../../types/table.types'

const queryKeys: unknown[] = []
vi.mock('@tanstack/vue-query', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useQuery: (options: { queryKey: { value: unknown } }) => {
    queryKeys.push(options.queryKey)
    return {
      data: ref(undefined),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    }
  },
}))

const { useServerTable } = await import('../useServerTable')

afterEach(() => {
  vi.useRealTimers()
  queryKeys.length = 0
})

describe('useServerTable — debouncedGlobalFilter', () => {
  it('exposes the debounced search, the same value the query key carries', async () => {
    vi.useFakeTimers()
    const table = useServerTable<{ id: string }>({
      queryKey: ['debounced'],
      queryFn: () => Promise.resolve({ data: [], pagination: { pageIndex: 0, pageSize: 10, totalCount: 0, pageCount: 0 } }),
      urlSync: false,
    })
    const params = () => {
      const key = (queryKeys[0] as { value: unknown[] }).value
      return key[key.length - 1] as ServerTableParams
    }

    table.globalFilter.value = 'ana'
    await nextTick()
    expect(table.debouncedGlobalFilter.value).toBe('')
    expect(params().globalFilter).toBeUndefined()

    vi.advanceTimersByTime(300)
    await nextTick()
    expect(table.debouncedGlobalFilter.value).toBe('ana')
    expect(params().globalFilter).toBe('ana')
  })
})
