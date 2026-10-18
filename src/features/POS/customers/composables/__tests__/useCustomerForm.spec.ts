import { describe, expect, it } from 'vitest'
import {
  COUNTRY_CODES,
  COUNTRY_CODE_OPTIONS,
  customerToFormInput,
  toCreatePayload,
  toUpdatePayload,
  useCustomerForm,
} from '../useCustomerForm'
import type { CustomerDetail } from '../../interfaces/customer.types'

function makeCustomer(phoneCountryCode: string | null): CustomerDetail {
  return {
    id: 'customer-1',
    firstName: 'Ana',
    lastName: null,
    fullName: 'Ana',
    phoneCountryCode,
    phone: '5585876245',
    email: null,
    globalPriceListId: null,
    globalPriceListName: null,
    comments: null,
    businessName: null,
    fiscalZipCode: null,
    rfc: null,
    fiscalRegime: null,
    billingStreet: null,
    billingExteriorNumber: null,
    billingInteriorNumber: null,
    billingZipCode: null,
    billingNeighborhood: null,
    billingMunicipality: null,
    billingCity: null,
    billingState: null,
    addresses: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('customer phone country code form boundary', () => {
  it.each(['52', '+52', '++52', ' + 52 ', null, '', '   '])(
    'loads %j into the existing México select option',
    (code) => {
      const { state, setState } = useCustomerForm()
      setState(customerToFormInput(makeCustomer(code)))
      expect(state.phoneCountryCode).toBe('+52')
      expect(
        COUNTRY_CODE_OPTIONS.find((option) => option.value === state.phoneCountryCode),
      ).toEqual({ label: '🇲🇽 +52', value: '+52' })
      expect(
        COUNTRY_CODES.find((country) => country.dialCode === state.phoneCountryCode)?.name,
      ).toBe('México')
    },
  )

  it('keeps +52 and the phone unchanged in both outgoing payloads', () => {
    const { state } = useCustomerForm()
    state.firstName = 'Ana'
    state.phone = '5585876245'
    expect(toCreatePayload(state)).toEqual({
      firstName: 'Ana',
      phoneCountryCode: '+52',
      phone: '5585876245',
    })
    expect(toUpdatePayload(state)).toEqual({
      firstName: 'Ana',
      phoneCountryCode: '+52',
      phone: '5585876245',
      globalPriceListId: undefined,
    })
    expect(state.phoneCountryCode).toBe('+52')
  })
})
