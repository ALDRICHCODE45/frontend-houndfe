// mobile-tables T3 (S4): on a phone a table with nothing remembered starts at 10 rows; a stored size
// and a size in the URL still win, and desktop keeps each table's own default.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { ServerTableConfig, ServerTableParams } from '../../types/table.types'
import { useServerTable } from '../useServerTable'
import { initialPageSize, pageSizeStorageKey, useTablePageSize } from '../useTablePageSize'
import { MOBILE_DEFAULT_PAGE_SIZE } from '../../constants/table-page-size'

const route = { query: {} as Record<string, string> }
const replace = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ replace }),
}))

type Row = { id: string }
const clients: QueryClient[] = []

function setPhone(phone: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: phone && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

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

const originalMatchMedia = window.matchMedia

describe('mobile default page size', () => {
  beforeEach(() => {
    localStorage.clear()
    route.query = {}
    replace.mockClear()
  })
  afterEach(() => {
    while (clients.length) clients.pop()!.clear()
    window.matchMedia = originalMatchMedia
  })

  it('is 10', () => {
    expect(MOBILE_DEFAULT_PAGE_SIZE).toBe(10)
  })

  it('starts a phone at 10 when nothing is stored, and the first request asks for 10', async () => {
    setPhone(true)
    const { table, queryFn } = mountTable({ persistKey: 'customers', defaultPageSize: 50 })
    expect(table.pagination.value.pageSize).toBe(10)
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalled())
    expect(queryFn.mock.calls[0]![0]).toMatchObject({ pageSize: 10 })
    // Neither remembered nor written to the URL: it is the phone's default, not a choice.
    await nextTick()
    expect(localStorage.getItem(pageSizeStorageKey('customers'))).toBeNull()
    expect(replace).not.toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ pageSize: '10' }) }))
  })

  it('lets the stored per-table size win on a phone', () => {
    setPhone(true)
    localStorage.setItem(pageSizeStorageKey('customers'), '35')
    expect(mountTable({ persistKey: 'customers', defaultPageSize: 50 }).table.pagination.value.pageSize).toBe(35)
  })

  it('lets a size in the URL win on a phone', () => {
    setPhone(true)
    route.query = { pageSize: '25' }
    expect(mountTable({ persistKey: 'customers', defaultPageSize: 50 }).table.pagination.value.pageSize).toBe(25)
  })

  it('keeps the table default on desktop', () => {
    setPhone(false)
    expect(mountTable({ persistKey: 'customers', defaultPageSize: 50 }).table.pagination.value.pageSize).toBe(50)
    expect(mountTable({ persistKey: 'sales', defaultPageSize: 20 }).table.pagination.value.pageSize).toBe(20)
  })

  it('keeps the desktop default where matchMedia does not exist', () => {
    // @ts-expect-error — jsdom without matchMedia
    window.matchMedia = undefined
    expect(initialPageSize({ persistKey: 'x', defaultPageSize: 20 })).toBe(20)
  })

  it('applies to tables that keep their own pagination (useTablePageSize)', () => {
    setPhone(true)
    expect(useTablePageSize({ persistKey: 'own', defaultPageSize: 20 }).pageSize.value).toBe(10)
    setPhone(false)
    expect(useTablePageSize({ persistKey: 'own', defaultPageSize: 20 }).pageSize.value).toBe(20)
  })
})
