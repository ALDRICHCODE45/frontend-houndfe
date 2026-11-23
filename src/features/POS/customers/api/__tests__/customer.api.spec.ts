import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomerAddressBackendResponse } from '../../interfaces/customer.types'

// Mocked transport proves wire bodies and response hydration, not SQL persistence.
const httpPost = vi.fn()
const httpGet = vi.fn()
const httpPatch = vi.fn()
beforeEach(() => vi.clearAllMocks())

vi.mock('@/core/shared/api/http', () => ({
  http: {
    post: (...args: unknown[]) => httpPost(...args),
    get: (...args: unknown[]) => httpGet(...args),
    patch: (...args: unknown[]) => httpPatch(...args),
    delete: vi.fn(),
  },
}))

// Import after the mock is registered.
const { customerApi } = await import('../customer.api')

function makeBackendAddress(
  overrides: Partial<CustomerAddressBackendResponse> = {},
): CustomerAddressBackendResponse {
  return {
    id: 'addr-1',
    customerId: 'customer-1',
    street: 'Av. Reforma',
    exteriorNumber: '123',
    interiorNumber: null,
    zipCode: '06000',
    neighborhood: 'Centro',
    municipality: 'Cuauhtémoc',
    city: 'CDMX',
    state: 'CDMX',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('customer.api coordinate wire contract', () => {
  const precisePin = { latitude: 0, longitude: -99.1332123456789 }
  const noPin = { latitude: null, longitude: null }
  const customer = { id: 'customer-1', firstName: 'Test', createdAt: '', updatedAt: '' }
  const pairs: Pick<CustomerAddressBackendResponse, 'latitude' | 'longitude'>[] = [
    {},
    precisePin,
    noPin,
  ]

  it.each(pairs)(
    'passes inline and individual address create bodies verbatim: %j',
    async (pair) => {
      const address = { street: 'Test street', ...pair }
      const returnedPair = 'latitude' in pair ? pair : noPin
      const responseAddress = makeBackendAddress(returnedPair)
      httpPost.mockResolvedValueOnce({ data: { ...customer, addresses: [responseAddress] } })
      const created = await customerApi.create({ firstName: 'Test', addresses: [address] })
      expect(httpPost).toHaveBeenNthCalledWith(1, '/customers', {
        firstName: 'Test',
        addresses: [address],
      })
      expect(created.addresses[0]).toMatchObject(returnedPair)
      httpPost.mockResolvedValueOnce({ data: responseAddress })
      const result = await customerApi.createAddress('customer-1', address)
      expect(httpPost).toHaveBeenNthCalledWith(2, '/customers/customer-1/addresses', address)
      expect(result).toMatchObject(returnedPair)
    },
  )

  it.each([
    { name: 'set', body: precisePin, response: precisePin },
    { name: 'preserve', body: { street: 'Edited street' }, response: precisePin },
    { name: 'clear', body: noPin, response: noPin },
  ])('PATCH $name preserves the exact pair intent', async ({ body, response }) => {
    httpPatch.mockResolvedValueOnce({ data: makeBackendAddress(response) })
    const result = await customerApi.updateAddress('customer-1', 'addr-1', body)
    expect(httpPatch).toHaveBeenCalledExactlyOnceWith(
      '/customers/customer-1/addresses/addr-1',
      body,
    )
    expect(result).toMatchObject(response)
  })

  it.each(pairs)('hydrates GET customer and both address-list shapes: %j', async (pair) => {
    const address = makeBackendAddress(pair)
    const expected = 'latitude' in pair ? pair : noPin
    httpGet.mockResolvedValueOnce({ data: { ...customer, addresses: [address] } })
    const detail = await customerApi.getById('customer-1')
    expect(httpGet).toHaveBeenNthCalledWith(1, '/customers/customer-1')
    expect(detail.addresses[0]).toMatchObject(expected)
    for (const data of [[address], { data: [address] }]) {
      httpGet.mockResolvedValueOnce({ data })
      expect((await customerApi.getAddresses('customer-1'))[0]).toMatchObject(expected)
      expect(httpGet).toHaveBeenLastCalledWith('/customers/customer-1/addresses')
    }
  })
})

describe('customer.api mapAddress — latitude/longitude normalization', () => {
  it('propagates latitude/longitude from the backend response into the frontend entity', async () => {
    httpPost.mockResolvedValueOnce({
      data: makeBackendAddress({ latitude: 19.4326, longitude: -99.1332 }),
    })

    const result = await customerApi.createAddress('customer-1', {
      street: 'Av. Reforma',
      city: 'CDMX',
    })

    expect(result.latitude).toBe(19.4326)
    expect(result.longitude).toBe(-99.1332)
  })

  it('normalizes a missing latitude to null (legacy backend responses without coords)', async () => {
    httpPost.mockResolvedValueOnce({
      data: makeBackendAddress(),
    })

    const result = await customerApi.createAddress('customer-1', {
      street: 'Av. Reforma',
      city: 'CDMX',
    })

    expect(result.latitude).toBeNull()
    expect(result.longitude).toBeNull()
  })

  it('normalizes an explicit backend null to null on the entity', async () => {
    httpPost.mockResolvedValueOnce({
      data: makeBackendAddress({ latitude: null, longitude: null }),
    })

    const result = await customerApi.createAddress('customer-1', {
      street: 'Av. Reforma',
      city: 'CDMX',
    })

    expect(result.latitude).toBeNull()
    expect(result.longitude).toBeNull()
  })

  it('keeps the other address fields intact while normalizing coordinates', async () => {
    httpPost.mockResolvedValueOnce({
      data: makeBackendAddress({ latitude: 19.4326, longitude: -99.1332 }),
    })

    const result = await customerApi.createAddress('customer-1', {
      street: 'Av. Reforma',
      city: 'CDMX',
    })

    expect(result).toMatchObject({
      id: 'addr-1',
      customerId: 'customer-1',
      street: 'Av. Reforma',
      exteriorNumber: '123',
      interiorNumber: null,
      zipCode: '06000',
      neighborhood: 'Centro',
      municipality: 'Cuauhtémoc',
      city: 'CDMX',
      state: 'CDMX',
      latitude: 19.4326,
      longitude: -99.1332,
    })
  })
})

// Handoff 27 §4: `GET /customers?search=` (server-side, pets included),
// `matchedPetName` on list items and `activePetsCount` on the detail.
describe('customer.api search, matchedPetName and activePetsCount (handoff 27 §4)', () => {
  const row = (id: string, firstName: string, extra: Record<string, unknown> = {}) => ({
    id,
    firstName,
    lastName: 'Pérez',
    createdAt: '',
    updatedAt: '',
    ...extra,
  })

  it('sends the trimmed term as `search` and nothing else for it', async () => {
    httpGet.mockResolvedValueOnce({ data: [] })
    await customerApi.getPaginated({ pageIndex: 0, pageSize: 20, globalFilter: '  bruno  ' })
    expect(httpGet).toHaveBeenCalledWith('/customers', {
      params: { page: 1, limit: 20, search: 'bruno' },
    })
  })

  it.each([undefined, '', '   '])('omits `search` for an empty term (%j)', async (globalFilter) => {
    httpGet.mockResolvedValueOnce({ data: [] })
    await customerApi.getPaginated({ pageIndex: 0, pageSize: 100, globalFilter })
    expect(httpGet).toHaveBeenCalledWith('/customers', { params: { page: 1, limit: 100 } })
  })

  it('keeps every row the server matched, including customers matched only through a pet', async () => {
    httpGet.mockResolvedValueOnce({
      data: [
        row('c-1', 'Ana', { matchedPetName: 'Bruno' }),
        row('c-2', 'Bruno', { matchedPetName: null }),
      ],
    })
    const result = await customerApi.getPaginated({
      pageIndex: 0,
      pageSize: 20,
      globalFilter: 'bruno',
    })
    expect(result.data.map((customer) => customer.id)).toEqual(['c-1', 'c-2'])
    expect(result.pagination.totalCount).toBe(2)
  })

  it('maps matchedPetName on list items, null when the backend sends null or omits it', async () => {
    httpGet.mockResolvedValueOnce({
      data: [
        row('c-1', 'Ana', { matchedPetName: 'Bruno' }),
        row('c-2', 'Luis', { matchedPetName: null }),
        row('c-3', 'Eva'),
      ],
    })
    const result = await customerApi.getPaginated({ pageIndex: 0, pageSize: 20, globalFilter: 'x' })
    expect(result.data.map((customer) => customer.matchedPetName)).toEqual(['Bruno', null, null])
  })

  it('maps activePetsCount from GET /customers/:id and leaves it undefined when absent', async () => {
    httpGet.mockResolvedValueOnce({ data: row('c-1', 'Ana', { activePetsCount: 3 }) })
    expect((await customerApi.getById('c-1')).activePetsCount).toBe(3)
    httpGet.mockResolvedValueOnce({ data: row('c-1', 'Ana', { activePetsCount: 0 }) })
    expect((await customerApi.getById('c-1')).activePetsCount).toBe(0)
    // Create/update responses do not carry it (§4.1): unknown, never a fake 0.
    httpPatch.mockResolvedValueOnce({ data: row('c-1', 'Ana') })
    expect((await customerApi.update('c-1', { firstName: 'Ana' })).activePetsCount).toBeUndefined()
  })

  // Differential check (Risk item 3): the exact inputs of every other caller.
  const backendRows = [
    row('c-1', 'Zoe', { email: 'z@x.com' }),
    row('c-2', 'Ana', { phone: '5512' }),
  ]

  it.each([
    [
      'SalesListView / QuotationsListView',
      { pageIndex: 0, pageSize: 100, sorting: [], globalFilter: '' },
    ],
    ['AssignCustomerSlideover (no term)', { pageIndex: 0, pageSize: 100, globalFilter: '' }],
  ])(
    '%s: empty term keeps the same params and every row in server order',
    async (_caller, params) => {
      httpGet.mockResolvedValueOnce({ data: backendRows })
      const result = await customerApi.getPaginated(params)
      expect(httpGet).toHaveBeenCalledWith('/customers', { params: { page: 1, limit: 100 } })
      expect(result.data.map((customer) => customer.id)).toEqual(['c-1', 'c-2'])
      expect(result.pagination).toEqual({
        pageIndex: 0,
        pageSize: 100,
        totalCount: 2,
        pageCount: 1,
      })
    },
  )

  it('PromotionConditionsSection: term goes to `search`, sorting params and local sort still apply', async () => {
    httpGet.mockResolvedValueOnce({ data: backendRows })
    const result = await customerApi.getPaginated({
      pageIndex: 0,
      pageSize: 20,
      sorting: [{ id: 'firstName', desc: false }],
      globalFilter: 'a',
    })
    expect(httpGet).toHaveBeenCalledWith('/customers', {
      params: { page: 1, limit: 20, search: 'a', sortBy: 'firstName', sortOrder: 'asc' },
    })
    expect(result.data.map((customer) => customer.firstName)).toEqual(['Ana', 'Zoe'])
  })

  it('a paginated {data, meta} response is still passed through and mapped', async () => {
    httpGet.mockResolvedValueOnce({
      data: {
        data: [row('c-1', 'Ana', { matchedPetName: 'Bruno' })],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    })
    const result = await customerApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      globalFilter: 'bruno',
    })
    expect(result.data[0]!.matchedPetName).toBe('Bruno')
    expect(result.pagination).toEqual({ pageIndex: 0, pageSize: 10, totalCount: 1, pageCount: 1 })
  })
})
