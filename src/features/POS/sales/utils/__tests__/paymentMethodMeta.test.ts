import { describe, it, expect } from 'vitest'
import { getMethodMeta, paymentMethodDisplayLabel, paymentMethodSubtitleText } from '../paymentMethodMeta'

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
    expect(meta.label).toBe('T. Crédito')
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

describe('paymentMethodDisplayLabel (custom-payment-methods S5B, REQ-CAT-005)', () => {
  it('prefers paymentMethodName over the base label when present', () => {
    const display = paymentMethodDisplayLabel(
      { paymentMethodName: 'Mercado Pago', paymentMethodSubtitle: 'Link' },
      'Transferencia',
    )
    expect(display.label).toBe('Mercado Pago')
    expect(display.subtitle).toBe('Link')
  })

  it('falls back to the base label when paymentMethodName is absent', () => {
    expect(paymentMethodDisplayLabel({}, 'Débito').label).toBe('Débito')
    expect(paymentMethodDisplayLabel({ paymentMethodName: undefined }, 'Débito').label).toBe('Débito')
  })

  it('falls back to the base label without throwing when both name and method are absent (defensive)', () => {
    // REO-CAT-005 defensive fallback: the helper never throws on empty input;
    // the surface's getMethodMeta fallback copy ('Otro') is supplied as baseLabel.
    expect(paymentMethodDisplayLabel({}, 'Otro').label).toBe('Otro')
  })
})

describe('paymentMethodSubtitleText (custom-payment-methods S5B, REQ-CAT-006)', () => {
  it('returns the trimmed subtitle when present', () => {
    expect(paymentMethodSubtitleText({ paymentMethodSubtitle: '  Link  ' })).toBe('Link')
  })

  it('returns null when subtitle is null, undefined, or missing', () => {
    expect(paymentMethodSubtitleText({ paymentMethodSubtitle: null })).toBeNull()
    expect(paymentMethodSubtitleText({ paymentMethodSubtitle: undefined })).toBeNull()
    expect(paymentMethodSubtitleText({})).toBeNull()
  })

  it('returns null for whitespace-only subtitles (no placeholder, no empty sub-line)', () => {
    expect(paymentMethodSubtitleText({ paymentMethodSubtitle: '   ' })).toBeNull()
    expect(paymentMethodSubtitleText({ paymentMethodSubtitle: '\t\n' })).toBeNull()
  })
})
