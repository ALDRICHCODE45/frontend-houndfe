/**
 * customers-module T5 (handoff 32 §4): «Cliente de confianza» travels only on PATCH, as a strict
 * boolean. POST answers 400 when it is sent, and an unknown value (the response did not carry it)
 * is never sent as `false`.
 */
import { describe, expect, it } from 'vitest'
import {
  customerFormSnapshot,
  customerToFormInput,
  toCreatePayload,
  toUpdatePayload,
  useCustomerForm,
  type CustomerFormValues,
} from '../useCustomerForm'
import type { CustomerDetail } from '../../interfaces/customer.types'

function customer(overrides: Partial<CustomerDetail> = {}): CustomerDetail {
  return {
    id: 'c-1', firstName: 'Ana', lastName: null, fullName: 'Ana', phoneCountryCode: '+52', phone: null,
    email: null, globalPriceListId: null, globalPriceListName: null, comments: null, businessName: null,
    fiscalZipCode: null, rfc: null, fiscalRegime: null, billingStreet: null, billingExteriorNumber: null,
    billingInteriorNumber: null, billingZipCode: null, billingNeighborhood: null, billingMunicipality: null,
    billingCity: null, billingState: null, addresses: [], createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z', ...overrides,
  }
}

describe('isTrusted in the customer form', () => {
  it('a new form has no trust value and create never sends it, whatever the state says', () => {
    const { state, schema } = useCustomerForm()
    expect(state.isTrusted).toBeNull()
    state.firstName = 'Ana'
    state.isTrusted = true
    const values = schema.parse(state) as CustomerFormValues
    expect(toCreatePayload(values)).not.toHaveProperty('isTrusted')
  })

  it('loads the customer value and PATCH sends it as a strict boolean', () => {
    const trusted = customerToFormInput(customer({ isTrusted: true }))
    expect(trusted.isTrusted).toBe(true)
    expect(toUpdatePayload(trusted)).toMatchObject({ isTrusted: true })

    const notTrusted = customerToFormInput(customer({ isTrusted: false }))
    expect(toUpdatePayload(notTrusted).isTrusted).toBe(false)
  })

  it('survives the schema (UForm submits the parsed data)', () => {
    const { schema } = useCustomerForm()
    const parsed = schema.parse(customerToFormInput(customer({ isTrusted: true })))
    expect(parsed.isTrusted).toBe(true)
  })

  it('an unknown value (not in the response) is never sent', () => {
    const input = customerToFormInput(customer())
    expect(input.isTrusted).toBeNull()
    expect(toUpdatePayload(input)).not.toHaveProperty('isTrusted')
  })

  it('switching it makes the edit form dirty', () => {
    const loaded = customerToFormInput(customer({ isTrusted: false }))
    expect(customerFormSnapshot({ ...loaded, isTrusted: true })).not.toBe(customerFormSnapshot(loaded))
  })
})
