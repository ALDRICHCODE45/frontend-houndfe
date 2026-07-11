// useServerTable.test.ts — RED-first tests for the shared server table
// composable. Verifies it surfaces TanStack Query error state to consumers
// so views can distinguish "request failed" from "0 results".

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useServerTable } from '../useServerTable'

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    refDebounced: <T>(source: { value: T }) => source,
  }
})

type Row = { id: string; name: string }

const EMPTY_PAGINATION = { pageIndex: 0, pageSize: 10, totalCount: 0, pageCount: 0 }

describe('useServerTable - error state surfacing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes isError=false and error=null when the query is successful', async () => {
    const { useQuery } = await import('@tanstack/vue-query')
    vi.mocked(useQuery).mockReturnValue({
      data: ref({
        data: [{ id: 'a', name: 'Alpha' }],
        pagination: { pageIndex: 0, pageSize: 10, totalCount: 1, pageCount: 1 },
      }),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    } as never)

    const table = useServerTable<Row>({
      queryKey: ['test'],
      queryFn: () =>
        Promise.resolve({ data: [], pagination: EMPTY_PAGINATION }),
      urlSync: false,
    })

    expect(table.isError.value).toBe(false)
    expect(table.error.value).toBeNull()
  })

  it('exposes isError=true and error=<err> when the query rejects', async () => {
    const { useQuery } = await import('@tanstack/vue-query')
    const networkError = new Error('boom')
    vi.mocked(useQuery).mockReturnValue({
      data: ref(null),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(true),
      error: ref(networkError),
      refetch: vi.fn(),
    } as never)

    const table = useServerTable<Row>({
      queryKey: ['test'],
      queryFn: () =>
        Promise.resolve({ data: [], pagination: EMPTY_PAGINATION }),
      urlSync: false,
    })

    expect(table.isError.value).toBe(true)
    expect(table.error.value).toBe(networkError)
  })

  it('returns data as [] and totalCount as 0 when the query has errored', async () => {
    const { useQuery } = await import('@tanstack/vue-query')
    vi.mocked(useQuery).mockReturnValue({
      data: ref(null),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(true),
      error: ref(new Error('boom')),
      refetch: vi.fn(),
    } as never)

    const table = useServerTable<Row>({
      queryKey: ['test'],
      queryFn: () =>
        Promise.resolve({ data: [], pagination: EMPTY_PAGINATION }),
      urlSync: false,
    })

    expect(table.data.value).toEqual([])
    expect(table.totalCount.value).toBe(0)
    expect(table.pageCount.value).toBe(0)
  })
})