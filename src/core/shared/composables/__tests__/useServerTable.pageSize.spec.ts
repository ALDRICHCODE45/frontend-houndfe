// Page size memory (odd/tasks/page-size-memory.md T1, S1-S3): the shared options and the size
// remembered per persistKey, requested on the very first fetch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { ServerTableConfig, ServerTableParams } from '../../types/table.types'
import { useServerTable } from '../useServerTable'
import { pageSizeStorageKey } from '../useTablePageSize'

const route = { query: {} as Record<string, string> }
const replace = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ replace }),
}))

type Row = { id: string }

const clients: QueryClient[] = []

function mountTable(config: Partial<ServerTableConfig<Row>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  const queryFn = vi.fn(async (params: ServerTableParams) => ({
    data: [{ id: 'row' }],
    pagination: { pageIndex: params.pageIndex, pageSize: params.pageSize, totalCount: 200, pageCount: 4 },
  }))
  let table!: ReturnType<typeof useServerTable<Row>>
  const wrapper = mount(
    defineComponent({
      setup() {
        table = useServerTable<Row>({ queryKey: ['rows', config.persistKey], queryFn, ...config })
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  )
  return { table, queryFn, wrapper }
}

describe('useServerTable — page size options and memory', () => {
  beforeEach(() => {
    localStorage.clear()
    route.query = {}
    replace.mockClear()
  })
  afterEach(() => {
    while (clients.length) clients.pop()!.clear()
  })

  it('offers 5 to 50 in steps of 5 by default', () => {
    const { table } = mountTable({ urlSync: false })
    expect(table.pageSizeOptions).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50])
  })

  it('remembers a chosen size: a remount requests it on its first and only first fetch', async () => {
    const first = mountTable({ persistKey: 'orders', urlSync: false })
    await vi.waitFor(() => expect(first.queryFn).toHaveBeenCalled())
    first.table.pagination.value = { pageIndex: 0, pageSize: 35 }
    await nextTick()
    expect(localStorage.getItem(pageSizeStorageKey('orders'))).toBe('35')
    first.wrapper.unmount()

    const second = mountTable({ persistKey: 'orders', urlSync: false })
    expect(second.table.pagination.value).toEqual({ pageIndex: 0, pageSize: 35 })
    await vi.waitFor(() => expect(second.queryFn).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(second.queryFn).toHaveBeenCalledTimes(1)
    expect(second.queryFn.mock.calls[0]![0]).toMatchObject({ pageIndex: 0, pageSize: 35 })
  })

  it('falls back to the default for an invalid stored size', async () => {
    localStorage.setItem(pageSizeStorageKey('orders'), '7')
    const { table, queryFn } = mountTable({ persistKey: 'orders', defaultPageSize: 20, urlSync: false })
    expect(table.pagination.value.pageSize).toBe(20)
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalled())
    expect(queryFn.mock.calls[0]![0]).toMatchObject({ pageSize: 20 })
  })

  it('lets a page size in the URL win over the stored one, without overwriting it', async () => {
    localStorage.setItem(pageSizeStorageKey('orders'), '35')
    route.query = { pageSize: '15' }
    const { table, queryFn } = mountTable({ persistKey: 'orders' })
    expect(table.pagination.value.pageSize).toBe(15)
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalled())
    expect(queryFn.mock.calls[0]![0]).toMatchObject({ pageSize: 15 })
    expect(localStorage.getItem(pageSizeStorageKey('orders'))).toBe('35')
  })

  it('keeps two tables independent', async () => {
    const a = mountTable({ persistKey: 'a', urlSync: false })
    const b = mountTable({ persistKey: 'b', urlSync: false })
    a.table.pagination.value = { pageIndex: 0, pageSize: 35 }
    b.table.pagination.value = { pageIndex: 0, pageSize: 15 }
    await nextTick()
    a.wrapper.unmount()
    b.wrapper.unmount()
    expect(mountTable({ persistKey: 'a', urlSync: false }).table.pagination.value.pageSize).toBe(35)
    expect(mountTable({ persistKey: 'b', urlSync: false }).table.pagination.value.pageSize).toBe(15)
  })

  it('keeps the chosen size when the filters are cleared', async () => {
    const { table } = mountTable({ persistKey: 'orders', urlSync: false })
    table.pagination.value = { pageIndex: 2, pageSize: 35 }
    await nextTick()
    table.resetFilters()
    expect(table.pagination.value).toEqual({ pageIndex: 0, pageSize: 35 })
    expect(localStorage.getItem(pageSizeStorageKey('orders'))).toBe('35')
  })

  it('rounds a default that is not an option to the nearest one', () => {
    const { table } = mountTable({ defaultPageSize: 12, urlSync: false })
    expect(table.pagination.value.pageSize).toBe(10)
  })

  it('validates the stored size against a table with its own options', () => {
    localStorage.setItem(pageSizeStorageKey('customers'), '100')
    const { table } = mountTable({
      persistKey: 'customers',
      defaultPageSize: 50,
      pageSizeOptions: [20, 50, 100],
      urlSync: false,
    })
    expect(table.pagination.value.pageSize).toBe(100)
  })

  it('does not remember anything without a persistKey', async () => {
    const { table } = mountTable({ urlSync: false })
    table.pagination.value = { pageIndex: 0, pageSize: 35 }
    await nextTick()
    expect(Object.keys(localStorage).filter((key) => key.startsWith('table-page-size'))).toEqual([])
  })
})
