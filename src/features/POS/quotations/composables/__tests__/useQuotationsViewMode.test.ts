import { describe, expect, it } from 'vitest'
import { isQuotationViewMode } from '../useQuotationsViewMode'

describe('isQuotationViewMode', () => {
  it('accepts the valid quotation view modes', () => {
    expect(isQuotationViewMode('table')).toBe(true)
    expect(isQuotationViewMode('card')).toBe(true)
  })

  it('rejects unknown or plural values', () => {
    expect(isQuotationViewMode('cards')).toBe(false)
    expect(isQuotationViewMode('grid')).toBe(false)
    expect(isQuotationViewMode('')).toBe(false)
  })
})
