import { describe, it, expect } from 'vitest'
import { getMethodMeta } from '../paymentMethodMeta'

describe('getMethodMeta', () => {
  it('returns success color and banknote icon for CASH', () => {
    const meta = getMethodMeta('CASH')
    expect(meta.label).toBe('Efectivo')
    expect(meta.color).toBe('success')
    expect(meta.icon).toBe('i-lucide-banknote')
  })

  it('returns warning color and credit-card icon for CARD_DEBIT', () => {
    const meta = getMethodMeta('CARD_DEBIT')
    expect(meta.label).toBe('Débito')
    expect(meta.color).toBe('warning')
    expect(meta.icon).toBe('i-lucide-credit-card')
  })

  it('returns warning color and credit-card icon for CARD_CREDIT', () => {
    const meta = getMethodMeta('CARD_CREDIT')
    expect(meta.label).toBe('Crédito')
    expect(meta.color).toBe('warning')
    expect(meta.icon).toBe('i-lucide-credit-card')
  })

  it('returns warning color and arrow-left-right icon for TRANSFER', () => {
    const meta = getMethodMeta('TRANSFER')
    expect(meta.label).toBe('Transferencia')
    expect(meta.color).toBe('warning')
    expect(meta.icon).toBe('i-lucide-arrow-left-right')
  })

  it('returns error color and hand-coins icon for CREDIT', () => {
    const meta = getMethodMeta('CREDIT')
    expect(meta.label).toBe('Crédito')
    expect(meta.color).toBe('error')
    expect(meta.icon).toBe('i-lucide-hand-coins')
  })

  it('falls back to "other" meta for unknown codes', () => {
    const meta = getMethodMeta('UNKNOWN_CODE')
    expect(meta.label).toBe('Otro')
    expect(meta.color).toBe('neutral')
    expect(meta.icon).toBe('i-lucide-circle-help')
  })

  it('always returns a defined object (never undefined)', () => {
    const meta = getMethodMeta('')
    expect(meta).toBeDefined()
    expect(typeof meta.label).toBe('string')
    expect(typeof meta.color).toBe('string')
    expect(typeof meta.icon).toBe('string')
  })
})
