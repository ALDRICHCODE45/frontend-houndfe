import { describe, expect, it, vi } from 'vitest'
import type { CustomerAddressBackendResponse } from '../../interfaces/customer.types'

/**
 * `mapAddress` is a module-internal helper. We can't import it directly, so the
 * spec mounts the public `customerApi.createAddress` contract (the one caller of
 * `mapAddress` after the S3b normalization) and asserts the round-trip shape.
 *
 * The HTTP client is mocked so the assertion isolates the mapper; the assertion
 * is what S3b commits to the wire (the lat/lng propagation is purely a
 * mapper concern — `createAddress` is a thin pass-through).
 */
const httpPost = vi.fn()

vi.mock('@/core/shared/api/http', () => ({
  http: {
    post: (...args: unknown[]) => httpPost(...args),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

// Import after the mock is registered.
const { customerApi } = await import('../customer.api')

function makeBackendAddress(overrides: Partial<CustomerAddressBackendResponse> = {}): CustomerAddressBackendResponse {
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
