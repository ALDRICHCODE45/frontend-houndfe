import { describe, expect, it } from 'vitest'
import { formatPhoneCountryCode } from '../phone.utils'

describe('formatPhoneCountryCode', () => {
  it.each([
    ['52', '+52'],
    ['+52', '+52'],
    ['++52', '+52'],
    [' +++52 ', '+52'],
    [null, ''],
    [undefined, ''],
    ['', ''],
    [' \t\n ', ''],
    [' 52 ', '+52'],
    ['5 2', '+52'],
    ['+ 5 2', '+52'],
    ['+ + 52', '+52'],
    ['+ ', ''],
    ['unknown', 'unknown'],
    ['52-1', '52-1'],
  ])('formats %j as %j without applying country rules', (code, expected) => {
    expect(formatPhoneCountryCode(code)).toBe(expected)
  })
})
