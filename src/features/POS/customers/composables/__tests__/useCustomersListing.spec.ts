import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type { ServerTableConfig, ServerTableParams } from '@/core/shared/types/table.types'
import type { CustomerListingPage, CustomerListingRow } from '../../interfaces/customer-listing.types'

const listCustomersListing = vi.fn()
vi.mock('../../api/customer.api', () => ({
  customerApi: { listCustomersListing: (...args: unknown[]) => listCustomersListing(...args) },
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

let capturedConfig: ServerTableConfig<CustomerListingRow> | undefined
const response = ref<CustomerListingPage | undefined>(undefined)
vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: (config: ServerTableConfig<CustomerListingRow>) => {
    capturedConfig = config
    return { response, pagination: ref({ pageIndex: 3, pageSize: 50 }) }
  },
}))

const {
  CUSTOMERS_LISTING_LIMIT,
  buildCustomersListingParams,
  customersFilterTotals,
  mapCustomersSort,
  useCustomersListing,
} = await import('../useCustomersListing')

const base: ServerTableParams = { pageIndex: 0, pageSize: 50 }
const ctx = { queryKey: [] as readonly unknown[] }

beforeEach(() => {
  vi.clearAllMocks()
  capturedConfig = undefined
  response.value = undefined
})

describe('mapCustomersSort (handoff 32 §2.5)', () => {
  it.each([
    ['name', false, 'name', 'asc'],
    ['createdAt', true, 'createdAt', 'desc'],
    ['openDebt', true, 'openDebt', 'desc'],
    ['oldestOverdue', false, 'oldestOverdue', 'asc'],
    ['lastPurchaseAt', true, 'lastPurchaseAt', 'desc'],
    ['totalSold', true, 'totalSold', 'desc'],
    ['salesCount', false, 'salesCount', 'asc'],
    ['averageTicket', true, 'averageTicket', 'desc'],
  ])('column %s (desc %s) → sortBy %s %s', (id, desc, sortBy, sortOrder) => {
    expect(mapCustomersSort([{ id, desc }], { canReadSales: true })).toEqual({ sortBy, sortOrder })
  })

  it('falls back to name A–Z with no sort or a column the backend cannot order by', () => {
    expect(mapCustomersSort(undefined, { canReadSales: true })).toEqual({ sortBy: 'name', sortOrder: 'asc' })
    expect(mapCustomersSort([{ id: 'email', desc: true }], { canReadSales: true })).toEqual({
      sortBy: 'name',
      sortOrder: 'asc',
    })
  })

  it('never sends a money sort without read:Sale', () => {
    for (const id of ['openDebt', 'oldestOverdue', 'lastPurchaseAt', 'totalSold', 'salesCount', 'averageTicket']) {
      expect(mapCustomersSort([{ id, desc: true }], { canReadSales: false })).toEqual({
        sortBy: 'name',
        sortOrder: 'asc',
      })
    }
    expect(mapCustomersSort([{ id: 'createdAt', desc: true }], { canReadSales: false })).toEqual({
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })
  })
})

describe('buildCustomersListingParams', () => {
  it('sends page, limit 50, the trimmed search, the sort and the filters', () => {
    expect(CUSTOMERS_LISTING_LIMIT).toBe(50)
    expect(
      buildCustomersListingParams(
        { pageIndex: 2, pageSize: 50, globalFilter: '  bruno ', sorting: [{ id: 'totalSold', desc: true }] },
        { hasOverdue: 'true', petSpecies: 'DOG,CAT', openDebtMin: '150000' },
        { canReadSales: true },
      ),
    ).toEqual({
      page: 3,
      limit: 50,
      search: 'bruno',
      sortBy: 'totalSold',
      sortOrder: 'desc',
      hasOverdue: 'true',
      petSpecies: 'DOG,CAT',
      openDebtMin: '150000',
    })
  })

  it('omits a blank search and caps the page size at the backend maximum (100)', () => {
    const params = buildCustomersListingParams({ ...base, pageSize: 500, globalFilter: '   ' }, {}, { canReadSales: true })
    expect(params).toEqual({ page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' })
  })

  it('drops every metric filter without read:Sale (a stale view or URL never reaches the server)', () => {
    const params = buildCustomersListingParams(
      base,
      {
        hasDebt: 'false',
        openDebtMin: '1',
        openDebtMax: '2',
        hasOverdue: 'true',
        overdueMoreThanDays: '30',
        oldestOverdueFrom: 'a',
        oldestOverdueTo: 'b',
        totalSoldMin: '1',
        totalSoldMax: '2',
        salesCountMin: '1',
        salesCountMax: '2',
        averageTicketMin: '1',
        averageTicketMax: '2',
        lastPurchaseFrom: 'a',
        lastPurchaseTo: 'b',
        noPurchaseMoreThanDays: '90',
        createdFrom: '2026-11-01T06:00:00.000Z',
        petSpecies: 'DOG',
      },
      { canReadSales: false },
    )
    expect(params).toEqual({
      page: 1,
      limit: 50,
      sortBy: 'name',
      sortOrder: 'asc',
      createdFrom: '2026-11-01T06:00:00.000Z',
      petSpecies: 'DOG',
    })
  })
})

describe('customersFilterTotals («N clientes · Deuda $X (vencida $Y)»)', () => {
  it('keys the count on the Cliente column and the debt of the whole filter on Deuda', () => {
    expect(
      customersFilterTotals({ count: 38, openDebtCents: 4821550, overdueDebtCents: 3194000 }, { canReadSales: true }),
    ).toEqual({ name: 38, openDebt: '$48,215.50 (vencida $31,940.00)' })
  })

  it('has only the count without read:Sale, and nothing before the first page', () => {
    expect(customersFilterTotals({ count: 5 }, { canReadSales: false })).toEqual({ name: 5 })
    expect(customersFilterTotals({ count: 5, openDebtCents: 10, overdueDebtCents: 0 }, { canReadSales: false })).toEqual({
      name: 5,
    })
    expect(customersFilterTotals(undefined, { canReadSales: true })).toBeUndefined()
  })
})

describe('useCustomersListing', () => {
  function run(filters = ref<Record<string, string>>({}), canReadSales = ref(true)) {
    const scope = effectScope()
    const result = scope.run(() => useCustomersListing({ filters, canReadSales }))!
    return { result, scope, filters }
  }

  it('leaves the URL to the filters adapter: no table URL sync, as in Ventas (T8, L14)', () => {
    run()
    expect(capturedConfig?.urlSync).toBe(false)
  })

  it('reads GET /customers/listing with the mapped params and returns the page with its summary', async () => {
    const page: CustomerListingPage = {
      data: [],
      pagination: { pageIndex: 0, pageSize: 50, totalCount: 0, pageCount: 0 },
      filterSummary: { count: 0, openDebtCents: 0, overdueDebtCents: 0 },
    }
    listCustomersListing.mockResolvedValue(page)
    const { result } = run(ref({ hasDebt: 'true' }))
    expect(capturedConfig).toMatchObject({ defaultPageSize: 50, persistKey: 'pos-customers-listing' })
    const returned = await capturedConfig!.queryFn({ pageIndex: 0, pageSize: 50, sorting: [{ id: 'openDebt', desc: true }] }, ctx)
    expect(listCustomersListing).toHaveBeenCalledWith({
      page: 1,
      limit: 50,
      sortBy: 'openDebt',
      sortOrder: 'desc',
      hasDebt: 'true',
    })
    expect(returned).toBe(page)
    expect(result.filterErrors.value).toEqual({})
  })

  it('keys the query under the customers list key so every customer write refreshes it', () => {
    run(ref({ petSpecies: 'DOG' }))
    const key = (capturedConfig!.queryKey as () => readonly unknown[])()
    expect(key.slice(0, 3)).toEqual(['customers', 'tenant-1', 'paginated'])
    expect(key).toContainEqual({ petSpecies: 'DOG' })
  })

  it('maps a listing 400 to the filter it names and to a table message, then rethrows', async () => {
    listCustomersListing.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { statusCode: 400, code: 'LISTING_INVERTED_RANGE', field: 'openDebt', message: 'x' } },
    })
    const { result } = run()
    await expect(capturedConfig!.queryFn(base, ctx)).rejects.toBeTruthy()
    expect(result.filterErrors.value).toEqual({
      openDebt: 'Monto de deuda: el inicio del rango es mayor que el final.',
    })
    expect(result.listingErrorMessage.value).toBe('Monto de deuda: el inicio del rango es mayor que el final.')
  })

  it('exposes the server totals of the current page response', () => {
    const { result } = run()
    expect(result.filterTotals.value).toBeUndefined()
    response.value = {
      data: [],
      pagination: { pageIndex: 0, pageSize: 50, totalCount: 2, pageCount: 1 },
      filterSummary: { count: 2, openDebtCents: 100, overdueDebtCents: 0 },
    }
    expect(result.filterTotals.value).toEqual({ name: 2, openDebt: '$1.00 (vencida $0.00)' })
  })
})
