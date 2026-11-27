// Page size memory of the customers table (odd/tasks/page-size-memory.md T1b, S2-S3), through the
// real useServerTable: the shared 5..50 options, the size remembered under the table's persistKey
// and requested on the very first fetch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { TABLE_PAGE_SIZE_OPTIONS } from '@/core/shared/constants/table-page-size'
import { pageSizeStorageKey } from '@/core/shared/composables/useTablePageSize'
import type { CustomerListingParams } from '../../interfaces/customer-listing.types'

const listCustomersListing = vi.fn(async (params: CustomerListingParams) => ({
  data: [],
  pagination: { pageIndex: params.page - 1, pageSize: params.limit, totalCount: 0, pageCount: 0 },
  filterSummary: { count: 0 },
}))
vi.mock('../../api/customer.api', () => ({
  customerApi: { listCustomersListing: (params: CustomerListingParams) => listCustomersListing(params) },
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))

const { useCustomersListing } = await import('../useCustomersListing')

const KEY = pageSizeStorageKey('pos-customers-listing')
const clients: QueryClient[] = []

function mountListing() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  let table!: ReturnType<typeof useCustomersListing>
  const wrapper = mount(
    defineComponent({
      setup() {
        table = useCustomersListing({ filters: ref({}), canReadSales: ref(true) })
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  )
  return { table, wrapper }
}

describe('customers table — page size options and memory', () => {
  beforeEach(() => {
    localStorage.clear()
    listCustomersListing.mockClear()
  })
  afterEach(() => {
    while (clients.length) clients.pop()!.clear()
  })

  it('offers 5 to 50 in steps of 5 and starts at 50', async () => {
    const { table } = mountListing()
    expect(table.pageSizeOptions).toEqual([...TABLE_PAGE_SIZE_OPTIONS])
    expect(table.pagination.value.pageSize).toBe(50)
    await vi.waitFor(() => expect(listCustomersListing).toHaveBeenCalled())
    expect(listCustomersListing.mock.calls[0]![0]).toMatchObject({ page: 1, limit: 50 })
  })

  it('remembers a chosen size: a remount requests it on its first fetch', async () => {
    const first = mountListing()
    await vi.waitFor(() => expect(listCustomersListing).toHaveBeenCalled())
    first.table.pagination.value = { pageIndex: 0, pageSize: 15 }
    await nextTick()
    expect(localStorage.getItem(KEY)).toBe('15')
    first.wrapper.unmount()
    listCustomersListing.mockClear()

    const second = mountListing()
    expect(second.table.pagination.value.pageSize).toBe(15)
    await vi.waitFor(() => expect(listCustomersListing).toHaveBeenCalled())
    expect(listCustomersListing.mock.calls[0]![0]).toMatchObject({ page: 1, limit: 15 })
  })

  it.each([['100'], ['7'], ['"abc"']])('falls back to 50 for an invalid stored size %s', async (stored) => {
    localStorage.setItem(KEY, stored)
    const { table } = mountListing()
    expect(table.pagination.value.pageSize).toBe(50)
    await vi.waitFor(() => expect(listCustomersListing).toHaveBeenCalled())
    expect(listCustomersListing.mock.calls[0]![0]).toMatchObject({ limit: 50 })
  })
})
