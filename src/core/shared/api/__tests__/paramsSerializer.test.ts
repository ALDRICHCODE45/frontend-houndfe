import { describe, expect, it } from 'vitest'
import { csvParamsSerializer } from '../paramsSerializer'

describe('csvParamsSerializer', () => {
  it('serializes arrays as CSV under one key', () => {
    const query = csvParamsSerializer({
      paymentStatus: ['PAID', 'PARTIAL'],
      page: 1,
    })

    expect(query).toBe('paymentStatus=PAID%2CPARTIAL&page=1')
  })

  it('serializes booleans as true/false literals', () => {
    const query = csvParamsSerializer({
      customerIncludeNull: true,
      paymentMethodIncludeNull: false,
    })

    expect(query).toBe('customerIncludeNull=true&paymentMethodIncludeNull=false')
  })

  it('omits undefined, null and empty arrays', () => {
    const query = csvParamsSerializer({
      paymentStatus: [],
      totalMin: undefined,
      totalMax: null,
      page: 1,
    })

    expect(query).toBe('page=1')
  })
})
