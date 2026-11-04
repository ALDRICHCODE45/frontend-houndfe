import { describe, expect, it } from 'vitest'
import {
  DRAFT_STATE_KEYS,
  PAYMENT_METHOD_KEYS,
  findNonNeutralTones,
  scanToneMapSource,
} from '../neutralToneGuard.utils'

describe('findNonNeutralTones (runtime maps)', () => {
  it('passes a draft that maps to neutral, in any casing or alias', () => {
    expect(findNonNeutralTones({ DRAFT: 'neutral', SENT: 'success' }, DRAFT_STATE_KEYS)).toEqual([])
    expect(findNonNeutralTones({ draft: 'manual' }, DRAFT_STATE_KEYS)).toEqual([])
    expect(findNonNeutralTones({ Borrador: 'type' }, DRAFT_STATE_KEYS)).toEqual([])
  })

  it('flags a draft that maps to any other tone', () => {
    expect(findNonNeutralTones({ DRAFT: 'warning', CONFIRMED: 'success' }, DRAFT_STATE_KEYS)).toEqual(['DRAFT: warning'])
    expect(findNonNeutralTones({ DRAFT: 'info' }, DRAFT_STATE_KEYS)).toEqual(['DRAFT: info'])
    expect(findNonNeutralTones({ BORRADOR: 'error' }, DRAFT_STATE_KEYS)).toEqual(['BORRADOR: error'])
  })

  it('ignores keys that are not drafts', () => {
    expect(findNonNeutralTones({ SENT: 'success', CANCELLED: 'error' }, DRAFT_STATE_KEYS)).toEqual([])
  })

  it('treats payment methods as neutral chips, because they are not states', () => {
    expect(findNonNeutralTones({ CASH: 'neutral', TRANSFER: 'neutral', CARD_DEBIT: 'neutral' }, PAYMENT_METHOD_KEYS)).toEqual([])
    expect(findNonNeutralTones({ CASH: 'success', CARD_CREDIT: 'info', TRANSFER: 'warning' }, PAYMENT_METHOD_KEYS)).toEqual([
      'CASH: success',
      'CARD_CREDIT: info',
      'TRANSFER: warning',
    ])
  })

  it('flags a tone that is not part of the StatusBadge vocabulary (primary)', () => {
    expect(findNonNeutralTones({ CARD_DEBIT: 'primary' }, PAYMENT_METHOD_KEYS)).toEqual(['CARD_DEBIT: primary'])
  })
})

describe('scanToneMapSource (source text)', () => {
  it('finds a draft mapped to a tone, with quoted or bare keys', () => {
    expect(scanToneMapSource("export const t = { DRAFT: 'warning', DONE: 'success' } as const")).toEqual([
      'DRAFT: warning',
    ])
    expect(scanToneMapSource('const t = { "draft": "info" }')).toEqual(['draft: info'])
  })

  it('ignores a draft whose value is a label, an enum or a neutral tone', () => {
    expect(scanToneMapSource("const labels = { DRAFT: 'Borrador', SENT: 'Enviada' }")).toEqual([])
    expect(scanToneMapSource("const s = { DRAFT: 'DRAFT' }")).toEqual([])
    expect(scanToneMapSource("const t = { DRAFT: 'neutral' }")).toEqual([])
  })

  it('finds payment-method chips that carry a colour', () => {
    const source = "const colors = { CASH: 'success', CARD_CREDIT: 'info', TRANSFER: 'warning', CARD_DEBIT: 'primary' }"
    expect(scanToneMapSource(source)).toEqual([
      'CASH: success',
      'CARD_CREDIT: info',
      'TRANSFER: warning',
      'CARD_DEBIT: primary',
    ])
  })

  it('leaves a payment state alone: CREDIT ("A crédito") is not a method chip', () => {
    expect(scanToneMapSource("const tones = { PAID: 'success', PARTIAL: 'warning', CREDIT: 'info' }")).toEqual([])
  })

  it('skips comments', () => {
    expect(scanToneMapSource("// DRAFT: 'warning'\n/* CASH: 'success' */")).toEqual([])
  })
})
