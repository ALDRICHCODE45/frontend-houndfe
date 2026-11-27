/**
 * owner-ideas-batch T1 (S6): page, sort, search and page size live in the URL next to the filters.
 *
 * Real router (memory history) and the real useServerTable, so the URL writes land as in the
 * browser. Only the request is stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, watch } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import type { ServerTableConfig, ServerTableParams } from '../../types/table.types'
import { useServerTable } from '../useServerTable'
import { pageSizeStorageKey } from '../useTablePageSize'

type Row = { id: string }

let router: Router
let client: QueryClient
let wrapper: VueWrapper | undefined

async function openAt(url: string) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/list', component: { template: '<div />' } }],
  })
  await router.push(url)
  await router.isReady()
}

interface MountExtras {
  /** Runs in the same setup after the table, like a saved view reopening or a filter watcher. */
  afterTable?: (table: ReturnType<typeof useServerTable<Row>>) => void
}

function mountTable(config: Partial<ServerTableConfig<Row>> = {}, extras: MountExtras = {}) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const queryFn = vi.fn(async (params: ServerTableParams) => ({
    data: [{ id: 'row' }],
    pagination: { pageIndex: params.pageIndex, pageSize: params.pageSize, totalCount: 500, pageCount: 25 },
  }))
  let table!: ReturnType<typeof useServerTable<Row>>
  wrapper = mount(
    defineComponent({
      setup() {
        table = useServerTable<Row>({ queryKey: ['rows'], queryFn, persistKey: 'rows', ...config })
        extras.afterTable?.(table)
        return () => h('div')
      },
    }),
    { global: { plugins: [router, [VueQueryPlugin, { queryClient: client }]] } },
  )
  return { table, queryFn }
}

/** Lets the debounced search (300 ms), the URL write (100 ms) and the navigations land. */
async function settle() {
  await vi.advanceTimersByTimeAsync(1000)
  await flushPromises()
}

const query = () => router.currentRoute.value.query

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  localStorage.clear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  client?.clear()
  vi.useRealTimers()
})

describe('useTableUrlSync — the table state in the URL (owner-ideas-batch S6)', () => {
  it('writes page, sort and search next to the filter params, which it keeps', async () => {
    await openAt('/list?status=open&tags=a&tags=b')
    const { table } = mountTable({ defaultSorting: [{ id: 'name', desc: false }] })
    await settle()

    table.sorting.value = [{ id: 'total', desc: true }]
    table.globalFilter.value = 'ada'
    await settle()
    table.pagination.value = { ...table.pagination.value, pageIndex: 2 }
    await settle()

    expect(query()).toEqual({ status: 'open', tags: ['a', 'b'], sort: 'total:desc', q: 'ada', page: '3' })
  })

  it('keeps a filter param another writer adds after the table wrote', async () => {
    await openAt('/list')
    const { table } = mountTable()
    table.sorting.value = [{ id: 'total', desc: true }]
    await settle()

    await router.replace({ query: { ...query(), status: 'open' } })
    table.pagination.value = { ...table.pagination.value, pageIndex: 1 }
    await settle()

    expect(query()).toEqual({ status: 'open', sort: 'total:desc', page: '2' })
  })

  it('a shared link with search, sort and page opens the table exactly so', async () => {
    await openAt('/list?q=ada&sort=total:desc&page=3&status=open')
    const { table, queryFn } = mountTable({ defaultSorting: [{ id: 'name', desc: false }] })
    await settle()

    expect(table.globalFilter.value).toBe('ada')
    expect(table.sorting.value).toEqual([{ id: 'total', desc: true }])
    expect(table.pagination.value.pageIndex).toBe(2)
    expect(queryFn).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageIndex: 2, globalFilter: 'ada', sorting: [{ id: 'total', desc: true }] }),
      expect.anything(),
    )
    expect(query()).toEqual({ q: 'ada', sort: 'total:desc', page: '3', status: 'open' })
  })

  it('the link wins over a sort set later in the same setup (a saved view reopening)', async () => {
    await openAt('/list?sort=total:desc&page=3')
    const { table } = mountTable(
      { defaultSorting: [{ id: 'name', desc: false }] },
      { afterTable: (t) => { t.sorting.value = [{ id: 'createdAt', desc: true }] } },
    )
    await settle()

    expect(table.sorting.value).toEqual([{ id: 'total', desc: true }])
    expect(table.pagination.value.pageIndex).toBe(2)
    expect(query()).toEqual({ sort: 'total:desc', page: '3' })
  })

  it('the link page survives the first-load page resets of the view (filters, status tabs)', async () => {
    await openAt('/list?page=4&status=open')
    const status = ref<string | undefined>(undefined)
    const { table } = mountTable({}, {
      afterTable: (t) => {
        watch(status, () => { t.pagination.value = { ...t.pagination.value, pageIndex: 0 } })
        status.value = 'open'
      },
    })
    await settle()

    expect(table.pagination.value.pageIndex).toBe(3)
    expect(query()).toEqual({ page: '4', status: 'open' })
  })

  it('a user change after load still resets the page', async () => {
    await openAt('/list?page=4')
    const { table } = mountTable()
    await settle()

    table.sorting.value = [{ id: 'total', desc: true }]
    await settle()

    expect(table.pagination.value.pageIndex).toBe(0)
    expect(query()).toEqual({ sort: 'total:desc' })
  })

  it('the stored page size applies when the URL has none', async () => {
    localStorage.setItem(pageSizeStorageKey('rows'), '25')
    await openAt('/list?page=2')
    const { table, queryFn } = mountTable({ defaultPageSize: 10 })
    await settle()

    expect(table.pagination.value).toEqual({ pageIndex: 1, pageSize: 25 })
    expect(queryFn).toHaveBeenLastCalledWith(expect.objectContaining({ pageIndex: 1, pageSize: 25 }), expect.anything())
  })

  it('a page size in the URL wins and is not remembered', async () => {
    localStorage.setItem(pageSizeStorageKey('rows'), '25')
    await openAt('/list?pageSize=40')
    const { table } = mountTable({ defaultPageSize: 10 })
    await settle()

    expect(table.pagination.value.pageSize).toBe(40)
    expect(localStorage.getItem(pageSizeStorageKey('rows'))).toBe('25')
    expect(query()).toEqual({ pageSize: '40' })
  })

  it('ignores a page size in the URL that the table does not offer', async () => {
    localStorage.setItem(pageSizeStorageKey('rows'), '25')
    await openAt('/list?pageSize=100000')
    const { table } = mountTable({ defaultPageSize: 10 })
    await settle()

    expect(table.pagination.value.pageSize).toBe(25)
  })
})
