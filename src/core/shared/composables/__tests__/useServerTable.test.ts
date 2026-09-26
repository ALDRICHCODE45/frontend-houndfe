// useServerTable.test.ts — RED-first tests for the shared server table
// composable. Verifies it surfaces TanStack Query error state to consumers
// so views can distinguish "request failed" from "0 results".

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { ServerTableParams } from '../../types/table.types'
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

describe('useServerTable - captured query parameters', () => {
  it('refetches inactive keys with their own params for a one-argument callback', async () => {
    const actual =
      await vi.importActual<typeof import('@tanstack/vue-query')>('@tanstack/vue-query')
    const { useQuery } = await import('@tanstack/vue-query')
    vi.mocked(useQuery).mockImplementation(actual.useQuery)
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    const queryFn = vi.fn(async (params: ServerTableParams) => ({
      data: [{ id: JSON.stringify(params), name: 'Captured' }],
      pagination: { ...EMPTY_PAGINATION, ...params },
    }))
    let table!: ReturnType<typeof useServerTable<Row>>
    const wrapper = mount(
      defineComponent({
        setup() {
          table = useServerTable<Row>({ queryKey: ['captured'], queryFn, urlSync: false })
          return () => h('div')
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
    )
    try {
      await vi.waitFor(() => expect(table.data.value).toHaveLength(1))
      table.globalFilter.value = 'food'
      table.sorting.value = [{ id: 'name', desc: true }]
      await nextTick()
      table.pagination.value = { pageIndex: 2, pageSize: 50 }
      await vi.waitFor(() => expect(table.data.value[0]?.id).toContain('"pageIndex":2'))
      const retained = client.getQueryCache().findAll({ queryKey: ['captured'] })
      expect(retained.length).toBeGreaterThan(1)
      queryFn.mockClear()
      await client.refetchQueries({ queryKey: ['captured'] })
      for (const query of retained) {
        const params = query.queryKey[query.queryKey.length - 1] as ServerTableParams
        expect(queryFn.mock.calls.map(([request]) => request)).toContainEqual(params)
        expect(client.getQueryData(query.queryKey)).toMatchObject({
          data: [{ id: JSON.stringify(params) }],
        })
      }
    } finally {
      wrapper.unmount()
      client.clear()
    }
  })
})

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
      queryFn: () => Promise.resolve({ data: [], pagination: EMPTY_PAGINATION }),
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
      queryFn: () => Promise.resolve({ data: [], pagination: EMPTY_PAGINATION }),
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
      queryFn: () => Promise.resolve({ data: [], pagination: EMPTY_PAGINATION }),
      urlSync: false,
    })

    expect(table.data.value).toEqual([])
    expect(table.totalCount.value).toBe(0)
    expect(table.pageCount.value).toBe(0)
  })
})
