import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomerListingBackendRow } from '../../interfaces/customer-listing.types'

// customers-module T6: GET /customers/listing and /customers/listing/options (handoff 32).
const httpGet = vi.fn()
beforeEach(() => vi.clearAllMocks())

vi.mock('@/core/shared/api/http', () => ({
  http: {
    post: vi.fn(),
    get: (...args: unknown[]) => httpGet(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const { customerApi } = await import('../customer.api')

function backendRow(overrides: Partial<CustomerListingBackendRow> = {}): CustomerListingBackendRow {
  return {
    id: 'c-1',
    firstName: 'Ana',
    lastName: 'López',
    businessName: null,
    phoneCountryCode: '52',
    phone: '5512345678',
    email: 'ana@example.com',
    globalPriceList: { id: 'pl-1', name: 'Mayoreo' },
    rfc: 'LOAA800101XXX',
    fiscalRegime: '612',
    preferredPaymentMethod: 'transferencia',
    isTrusted: false,
    createdAt: '2026-03-02T17:04:11.000Z',
    primaryAddress: {
      id: 'a-1',
      neighborhood: 'Del Valle',
      municipality: 'Benito Juárez',
      city: 'Ciudad de México',
      state: 'Ciudad de México',
      zipCode: '03100',
    },
    activePetsCount: 2,
    petSpecies: ['DOG', 'CAT'],
    matchedPetName: null,
    metrics: {
      openDebtCents: 78500,
      overdueDebtCents: 30000,
      overdueCount: 1,
      oldestOverdueDueDate: '2026-11-01',
      salesCount: 14,
      totalSoldCents: 1250000,
      averageTicketCents: 89286,
      lastPurchaseAt: '2026-11-20T19:31:02.000Z',
    },
    ...overrides,
  }
}

describe('customerApi.listCustomersListing', () => {
  it('GETs /customers/listing with the params as given and maps the page, rows and filter summary', async () => {
    httpGet.mockResolvedValue({
      data: {
        data: [backendRow()],
        pagination: { page: 2, limit: 50, total: 51, totalPages: 2 },
        filterSummary: { count: 51, openDebtCents: 78500, overdueDebtCents: 30000 },
      },
    })

    const page = await customerApi.listCustomersListing({
      page: 2,
      limit: 50,
      sortBy: 'openDebt',
      sortOrder: 'desc',
      search: 'ana',
      hasDebt: 'true',
      openDebtMin: '150000',
    })

    expect(httpGet).toHaveBeenCalledWith('/customers/listing', {
      params: {
        page: 2,
        limit: 50,
        sortBy: 'openDebt',
        sortOrder: 'desc',
        search: 'ana',
        hasDebt: 'true',
        openDebtMin: '150000',
      },
    })
    expect(page.pagination).toEqual({ pageIndex: 1, pageSize: 50, totalCount: 51, pageCount: 2 })
    expect(page.filterSummary).toEqual({ count: 51, openDebtCents: 78500, overdueDebtCents: 30000 })
    const [row] = page.data
    expect(row).toMatchObject({
      id: 'c-1',
      fullName: 'Ana López',
      globalPriceListName: 'Mayoreo',
      petSpecies: ['DOG', 'CAT'],
      activePetsCount: 2,
      primaryAddress: { neighborhood: 'Del Valle', city: 'Ciudad de México' },
      metrics: { openDebtCents: 78500, overdueCount: 1, oldestOverdueDueDate: '2026-11-01' },
    })
  })

  it('keeps rows without read:Sale free of metrics (the key is absent, never zeros)', async () => {
    const { metrics: _metrics, ...withoutMetrics } = backendRow()
    httpGet.mockResolvedValue({
      data: {
        data: [withoutMetrics],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        filterSummary: { count: 1 },
      },
    })
    const page = await customerApi.listCustomersListing({ page: 1, limit: 50 })
    expect(page.data[0]!.metrics).toBeUndefined()
    expect('metrics' in page.data[0]!).toBe(false)
    expect(page.filterSummary).toEqual({ count: 1 })
  })

  it('names a business without a person name, and normalizes missing optional fields', async () => {
    httpGet.mockResolvedValue({
      data: {
        data: [
          backendRow({
            firstName: '',
            lastName: null,
            businessName: 'Veterinaria Sol',
            globalPriceList: null,
            primaryAddress: null,
            petSpecies: undefined as unknown as [],
            matchedAddressId: 'a-9',
          }),
        ],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        filterSummary: { count: 1 },
      },
    })
    const [row] = (await customerApi.listCustomersListing({ page: 1, limit: 50 })).data
    expect(row).toMatchObject({
      fullName: 'Veterinaria Sol',
      globalPriceListName: null,
      primaryAddress: null,
      petSpecies: [],
      matchedAddressId: 'a-9',
    })
  })
})

describe('customerApi.listCustomerListingOptions', () => {
  it('GETs the distinct values of a field with their customer count', async () => {
    httpGet.mockResolvedValue({
      data: { field: 'neighborhood', data: [{ value: 'Del Valle', customersCount: 41 }] },
    })
    const options = await customerApi.listCustomerListingOptions('neighborhood', ' del ')
    expect(httpGet).toHaveBeenCalledWith('/customers/listing/options', {
      params: { field: 'neighborhood', q: 'del', limit: 200 },
    })
    expect(options).toEqual([{ value: 'Del Valle', customersCount: 41 }])
  })

  it('omits a blank term', async () => {
    httpGet.mockResolvedValue({ data: { field: 'city', data: [] } })
    await customerApi.listCustomerListingOptions('city')
    expect(httpGet).toHaveBeenCalledWith('/customers/listing/options', {
      params: { field: 'city', limit: 200 },
    })
  })
})

describe('GET /customers stays the POS selector array', () => {
  it('getPaginated still calls /customers, not the listing', async () => {
    httpGet.mockResolvedValue({ data: [] })
    await customerApi.getPaginated({ pageIndex: 0, pageSize: 100, sorting: [], globalFilter: '' })
    expect(httpGet.mock.calls[0]![0]).toBe('/customers')
  })
})
