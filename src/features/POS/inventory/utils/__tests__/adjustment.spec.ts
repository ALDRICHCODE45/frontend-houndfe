import { describe, expect, it } from 'vitest'
import type { AdjustmentInput } from '../../interfaces/inventory.types'
import {
  ADJUSTMENT_REASONS, MAX_QUANTITY, NOTE_MAX, adjustmentErrorCopy, adjustmentIssueCopy, countDelta, normalizeNote,
  signedDelta, validateAdjustment,
} from '../adjustment'

const base = (patch: Partial<AdjustmentInput> = {}): AdjustmentInput => ({
  target: { productId: 'p1', lotId: 'l1' }, expectedVersion: 1, delta: -3, reason: 'DAMAGE', ...patch,
})

describe('adjustment reasons', () => {
  it('lists the six fixed reasons with their Spanish labels in contract order', () => {
    expect(ADJUSTMENT_REASONS).toEqual([
      { value: 'PHYSICAL_COUNT', label: 'Conteo físico' },
      { value: 'DAMAGE', label: 'Merma/daño' },
      { value: 'EXPIRED', label: 'Caducado' },
      { value: 'THEFT_LOSS', label: 'Robo/pérdida' },
      { value: 'DATA_ENTRY_CORRECTION', label: 'Corrección de captura' },
      { value: 'OTHER', label: 'Otro' },
    ])
    expect(NOTE_MAX).toBe(500)
  })
})

describe('delta arithmetic', () => {
  it('signs the typed amount by direction', () => {
    expect(signedDelta('add', 4)).toBe(4)
    expect(signedDelta('remove', 4)).toBe(-4)
  })
  it('computes the physical-count delta as counted minus the shown quantity', () => {
    expect(countDelta(10, 14)).toBe(-4)
    expect(countDelta(20, 14)).toBe(6)
    expect(countDelta(14, 14)).toBe(0)
    expect(countDelta(0, 14)).toBe(-14)
  })
})

describe('validateAdjustment', () => {
  it('accepts a well-formed adjustment', () => {
    expect(validateAdjustment(base())).toBeNull()
    expect(validateAdjustment(base({ target: { productId: 'p1' }, delta: 5 }))).toBeNull()
    expect(validateAdjustment(base({ target: { productId: 'p1', variantId: 'v1' } }))).toBeNull()
  })
  it.each([
    ['a zero delta', { delta: 0 }, 'DELTA_ZERO'],
    ['a fractional delta', { delta: 1.5 }, 'DELTA_INVALID'],
    ['NaN', { delta: Number.NaN }, 'DELTA_INVALID'],
    ['a delta above 1,000,000,000', { delta: 1_000_000_001 }, 'DELTA_TOO_LARGE'],
    ['a delta below -1,000,000,000', { delta: -1_000_000_001 }, 'DELTA_TOO_LARGE'],
    ['a negative version', { expectedVersion: -1 }, 'VERSION_INVALID'],
    ['a fractional version', { expectedVersion: 1.2 }, 'VERSION_INVALID'],
    ['OTHER without a note', { reason: 'OTHER' }, 'NOTE_REQUIRED'],
    ['OTHER with a blank note', { reason: 'OTHER', note: '   ' }, 'NOTE_REQUIRED'],
    ['a note over 500 characters', { reason: 'DAMAGE', note: 'x'.repeat(501) }, 'NOTE_TOO_LONG'],
    ['an OTHER note over 500 characters', { reason: 'OTHER', note: 'x'.repeat(501) }, 'NOTE_TOO_LONG'],
    ['lot and variant together', { target: { productId: 'p1', lotId: 'l1', variantId: 'v1' } }, 'TARGET_AMBIGUOUS'],
    ['an unknown reason', { reason: 'BAD' as never }, 'REASON_INVALID'],
  ] as const)('rejects %s as %s', (_name, patch, issue) => {
    expect(validateAdjustment(base(patch as Partial<AdjustmentInput>))).toBe(issue)
  })
  it('measures the note after trimming and accepts exactly 500 characters', () => {
    expect(validateAdjustment(base({ note: 'x'.repeat(500) }))).toBeNull()
    expect(validateAdjustment(base({ note: ' ' + 'x'.repeat(500) + ' ' }))).toBeNull()
    expect(validateAdjustment(base({ reason: 'OTHER', note: ' motivo ' }))).toBeNull()
  })
  it('blocks a result below zero when the shown quantity is known (no negative stock)', () => {
    expect(validateAdjustment(base({ delta: -15 }), 14)).toBe('RESULT_NEGATIVE')
    expect(validateAdjustment(base({ delta: -14 }), 14)).toBeNull()
  })
  it('blocks a result above the 32-bit quantity limit', () => {
    expect(validateAdjustment(base({ delta: 2 }), MAX_QUANTITY - 1)).toBe('RESULT_TOO_LARGE')
    expect(validateAdjustment(base({ delta: 1 }), MAX_QUANTITY - 1)).toBeNull()
  })
})

describe('normalizeNote', () => {
  it('trims and turns a blank note into undefined', () => {
    expect(normalizeNote('  hola ')).toBe('hola')
    expect(normalizeNote('   ')).toBeUndefined()
    expect(normalizeNote(undefined)).toBeUndefined()
    expect(normalizeNote(null)).toBeUndefined()
  })
})

describe('error copy', () => {
  it.each([
    ['STOCK_VERSION_CONFLICT', 'El stock cambió mientras lo ajustabas. Revisa la cantidad actual.'],
    ['INSUFFICIENT_STOCK', 'No hay suficiente stock para restar esa cantidad.'],
    ['STOCK_NOT_TRACKED', 'Este producto no lleva control de stock.'],
    ['IDEMPOTENCY_KEY_CONFLICT', 'Este ajuste ya se había enviado con otros datos. Ábrelo de nuevo para ajustar.'],
    ['IDEMPOTENCY_KEY_IN_FLIGHT', 'El ajuste sigue en proceso. Aún no sabemos si se aplicó.'],
    ['FORBIDDEN', 'No tienes permiso para ajustar el stock.'],
    ['NOT_FOUND', 'El producto, lote o variante ya no existe.'],
    ['MALFORMED', 'Revisa la cantidad, el motivo y la nota.'],
    ['INTERNAL_ERROR', 'No pudimos confirmar si el ajuste se aplicó.'],
  ])('maps %s to its own Spanish sentence', (code, copy) => {
    expect(adjustmentErrorCopy(code)).toBe(copy)
  })
  it('never surfaces a server message and falls back to a neutral sentence', () => {
    expect(adjustmentErrorCopy('SOMETHING_NEW')).toBe('No se pudo ajustar el stock.')
    expect(adjustmentErrorCopy(undefined)).toBe('No pudimos confirmar si el ajuste se aplicó.')
  })
  it('keeps retry text out of messages (Reintentar is the action)', () => {
    const codes = ['STOCK_VERSION_CONFLICT', 'INSUFFICIENT_STOCK', 'STOCK_NOT_TRACKED', 'IDEMPOTENCY_KEY_CONFLICT',
      'IDEMPOTENCY_KEY_IN_FLIGHT', 'FORBIDDEN', 'NOT_FOUND', 'MALFORMED', 'INTERNAL_ERROR', 'X', undefined]
    for (const code of codes) expect(adjustmentErrorCopy(code)).not.toMatch(/Reintenta\.|Reintenta (?:el|para)\b/)
  })
  it('explains each local issue next to the field', () => {
    expect(adjustmentIssueCopy('DELTA_ZERO')).toBe('Escribe una cantidad distinta de cero.')
    expect(adjustmentIssueCopy('RESULT_NEGATIVE')).toBe('El stock no puede quedar en negativo.')
    expect(adjustmentIssueCopy('NOTE_REQUIRED')).toBe('Escribe una nota para el motivo «Otro».')
    expect(adjustmentIssueCopy('NOTE_TOO_LONG')).toBe('La nota admite hasta 500 caracteres.')
  })
})
