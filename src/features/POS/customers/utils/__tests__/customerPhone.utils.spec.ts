import { describe, expect, it } from 'vitest'
import { formatCustomerPhone } from '../customerPhone.utils'

describe('formatCustomerPhone', () => {
  it('groups a 10-digit national number as 55 1234 5678 behind its country code', () => {
    expect(formatCustomerPhone('+52', '5512345678')).toBe('+52 55 1234 5678')
  })

  it('normalizes a code without the plus and ignores separators already in the number', () => {
    expect(formatCustomerPhone('52', '55-1234 5678')).toBe('+52 55 1234 5678')
  })

  it('leaves a number that is not 10 digits as stored, so nothing is invented', () => {
    expect(formatCustomerPhone('+1', '4155550100123')).toBe('+1 4155550100123')
    expect(formatCustomerPhone('+52', '12345')).toBe('+52 12345')
  })

  it('shows the number alone when there is no country code', () => {
    expect(formatCustomerPhone(null, '5512345678')).toBe('55 1234 5678')
  })

  it('reads — when the customer has no phone', () => {
    expect(formatCustomerPhone('+52', null)).toBe('—')
    expect(formatCustomerPhone('+52', '  ')).toBe('—')
  })
})
