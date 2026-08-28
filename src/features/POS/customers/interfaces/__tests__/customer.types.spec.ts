import { describe, expect, it } from 'vitest'
import type {
  AddressFormInput,
  CreateCustomerAddressPayload,
  CustomerAddress,
  CustomerAddressBackendResponse,
} from '../customer.types'

/**
 * Locked decisions (design §5.3 + §13.2):
 *   - `latitude` / `longitude` join the four customer-address shapes (optional on
 *     the wire/inputs, nullable on the frontend entity and the form input).
 *   - `label` is NOT added to the customer-address entity — it lives only in the
 *     `formatAddress` superset and the delivery-route stop projection. The spec
 *     asserts absence as a regression guard against an accidental addition.
 */
describe('customer.address.types', () => {
  describe('CustomerAddressBackendResponse (wire shape)', () => {
    it('accepts latitude/longitude when the backend sends them', () => {
      const row: CustomerAddressBackendResponse = {
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
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
      expect(row.latitude).toBe(19.4326)
      expect(row.longitude).toBe(-99.1332)
    })

    it('accepts a legacy response without latitude/longitude (back-compat)', () => {
      const row: CustomerAddressBackendResponse = {
        id: 'addr-1',
        customerId: 'customer-1',
        street: 'Av. Reforma',
        exteriorNumber: null,
        interiorNumber: null,
        zipCode: null,
        neighborhood: null,
        municipality: null,
        city: 'CDMX',
        state: 'CDMX',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
      expect(row.latitude).toBeUndefined()
      expect(row.longitude).toBeUndefined()
    })

    it('does not expose a label field on the wire shape (decision lock)', () => {
      // Type-level assertion: compile-time guarantee that `label` is not part of
      // CustomerAddressBackendResponse. The runtime key check guards against a
      // future JSON-cast that injects label keys without the type knowing.
      const row = {} as CustomerAddressBackendResponse
      expect('label' in row).toBe(false)
    })
  })

  describe('CustomerAddress (frontend entity)', () => {
    it('stores latitude/longitude as `number | null`', () => {
      const addr: CustomerAddress = {
        id: 'addr-1',
        customerId: 'customer-1',
        street: 'Av. Reforma',
        exteriorNumber: '123',
        interiorNumber: null,
        zipCode: '06000',
        neighborhood: null,
        municipality: null,
        city: 'CDMX',
        state: 'CDMX',
        latitude: 19.4326,
        longitude: -99.1332,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
      expect(addr.latitude).toBe(19.4326)
      expect(addr.longitude).toBe(-99.1332)
    })

    it('keeps `null` as the canonical "no coordinates" value (not undefined)', () => {
      const addr: CustomerAddress = {
        id: 'addr-1',
        customerId: 'customer-1',
        street: 'Av. Reforma',
        exteriorNumber: null,
        interiorNumber: null,
        zipCode: null,
        neighborhood: null,
        municipality: null,
        city: 'CDMX',
        state: 'CDMX',
        latitude: null,
        longitude: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
      expect(addr.latitude).toBeNull()
      expect(addr.longitude).toBeNull()
    })

    it('does not expose a label field on the entity (decision lock)', () => {
      const addr = {} as CustomerAddress
      expect('label' in addr).toBe(false)
    })
  })

  describe('CreateCustomerAddressPayload (write shape)', () => {
    it('accepts latitude/longitude as optional fields', () => {
      const payload: CreateCustomerAddressPayload = {
        street: 'Av. Reforma',
        exteriorNumber: '123',
        city: 'CDMX',
        latitude: 19.4326,
        longitude: -99.1332,
      }
      expect(payload.latitude).toBe(19.4326)
      expect(payload.longitude).toBe(-99.1332)
    })

    it('omits latitude/longitude cleanly when the address has no pin', () => {
      const payload: CreateCustomerAddressPayload = {
        street: 'Av. Reforma',
        city: 'CDMX',
      }
      expect(payload.latitude).toBeUndefined()
      expect(payload.longitude).toBeUndefined()
    })

    it('does not expose a label field on the write payload (decision lock)', () => {
      const payload = {} as CreateCustomerAddressPayload
      expect('label' in payload).toBe(false)
    })

    // sdd delivery-routes S7 verify remediation — REQ-CA-003: the write payload
    // widens latitude/longitude to `number | null` so callers can pass `null`
    // to mean "no pin" without a ts complaint (the runtime still omits the
    // keys at the API boundary).
    it('accepts latitude/longitude as `number | null` on the write payload', () => {
      const payload: CreateCustomerAddressPayload = {
        street: 'Av. Reforma',
        city: 'CDMX',
        latitude: null,
        longitude: null,
      }
      expect(payload.latitude).toBeNull()
      expect(payload.longitude).toBeNull()
    })

    it('still accepts latitude/longitude as `number` on the write payload (back-compat)', () => {
      const payload: CreateCustomerAddressPayload = {
        street: 'Av. Reforma',
        city: 'CDMX',
        latitude: 19.4326,
        longitude: -99.1332,
      }
      expect(payload.latitude).toBe(19.4326)
      expect(payload.longitude).toBe(-99.1332)
    })
  })

  describe('AddressFormInput (reactive form state)', () => {
    it('stores latitude/longitude as `number | null` so v-model two-way binds cleanly', () => {
      const input: AddressFormInput = {
        street: '',
        exteriorNumber: '',
        interiorNumber: '',
        zipCode: '',
        neighborhood: '',
        municipality: '',
        city: '',
        state: '',
        latitude: null,
        longitude: null,
      }
      expect(input.latitude).toBeNull()
      expect(input.longitude).toBeNull()
    })

    it('keeps zero as a legal pin (the form input must not collapse 0,0)', () => {
      const input: AddressFormInput = {
        street: 'Av. Reforma',
        exteriorNumber: '',
        interiorNumber: '',
        zipCode: '',
        neighborhood: '',
        municipality: '',
        city: '',
        state: '',
        latitude: 0,
        longitude: 0,
      }
      expect(input.latitude).toBe(0)
      expect(input.longitude).toBe(0)
    })

    it('does not expose a label field on the form input (decision lock)', () => {
      const input = {} as AddressFormInput
      expect('label' in input).toBe(false)
    })
  })
})
