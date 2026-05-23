import { describe, expect, it } from 'vitest'
import { mapListingErrorToFilterField } from '../errorMapping'

describe('mapListingErrorToFilterField', () => {
  it('maps invalid enum code', () => {
    expect(mapListingErrorToFilterField({ code: 'LISTING_INVALID_ENUM_VALUE', field: 'paymentStatus' })).toEqual({
      filterId: 'paymentStatus',
      message: 'Valor inválido en paymentStatus',
    })
  })

  it('maps invalid uuid code', () => {
    expect(mapListingErrorToFilterField({ code: 'LISTING_INVALID_UUID', field: 'customerId' })).toEqual({
      filterId: 'customerId',
      message: 'Identificador inválido en customerId',
    })
  })

  it('maps invalid date code', () => {
    expect(mapListingErrorToFilterField({ code: 'LISTING_INVALID_DATE', field: 'confirmedAt' })).toEqual({
      filterId: 'confirmedAt',
      message: 'Fecha inválida en confirmedAt',
    })
  })

  it('maps invalid number code', () => {
    expect(mapListingErrorToFilterField({ code: 'LISTING_INVALID_NUMBER', field: 'totalCents' })).toEqual({
      filterId: 'totalCents',
      message: 'Valor numérico inválido en totalCents',
    })
  })

  it('maps inverted range code', () => {
    expect(mapListingErrorToFilterField({ code: 'LISTING_INVERTED_RANGE', field: 'debtCents' })).toEqual({
      filterId: 'debtCents',
      message: 'El rango está invertido en debtCents',
    })
  })

  it('maps too many values code', () => {
    expect(mapListingErrorToFilterField({ code: 'LISTING_TOO_MANY_VALUES', field: 'folio' })).toEqual({
      filterId: 'folio',
      message: 'Demasiados valores seleccionados en folio',
    })
  })

  it('returns null for unknown code', () => {
    expect(mapListingErrorToFilterField({ code: 'UNKNOWN', field: 'paymentStatus' })).toBeNull()
  })

  it('returns null for missing payload', () => {
    expect(mapListingErrorToFilterField(null)).toBeNull()
  })
})
