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
