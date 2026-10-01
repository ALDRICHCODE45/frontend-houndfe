import { describe, expect, it } from 'vitest'
import {
  EXPIRATION_TEXT_MAX_LENGTH,
  validateExpirationText,
  type ExpirationTextValidationResult,
} from '../expirationText'

/**
 * HD-EXP-01a (frontend mirror) — pure `expirationText` normalization contract.
 * Fixed order: require string; NFC; reject C0/C1/DEL BEFORE collapsing; collapse
 * Unicode whitespace runs to one ASCII space and trim; require 1..500 UTF-16 code
 * units AFTER normalization, rejecting (never truncating) longer values. Failures
 * are a discriminated, value-free `{ ok:false, reason }` with no echoed input.
 */
describe('validateExpirationText', () => {
  it('accepts and NFC-normalizes a plain string', () => {
    expect(validateExpirationText('Vence en marzo')).toEqual({ ok: true, value: 'Vence en marzo' })
    expect(validateExpirationText('Cafe\u0301 vence')).toEqual({ ok: true, value: 'Café vence' })
    expect(validateExpirationText('😀 vence')).toEqual({ ok: true, value: '😀 vence' })
  })

  it('collapses Unicode whitespace runs to one ASCII space and trims', () => {
    expect(validateExpirationText('a\u00a0\u00a0\u2028b')).toEqual({ ok: true, value: 'a b' })
    expect(validateExpirationText('   \u00a0Vence hoy\u2028  ')).toEqual({
      ok: true,
      value: 'Vence hoy',
    })
  })

  it('accepts exactly the 500-unit maximum (including emoji pairs)', () => {
    const ascii = 'a'.repeat(EXPIRATION_TEXT_MAX_LENGTH)
    expect(validateExpirationText(ascii)).toEqual({ ok: true, value: ascii })
    const emoji = '😀'.repeat(250)
    expect(emoji.length).toBe(500)
    expect(validateExpirationText(emoji)).toEqual({ ok: true, value: emoji })
  })

  it('rejects 501 units instead of truncating', () => {
    const ascii = 'a'.repeat(EXPIRATION_TEXT_MAX_LENGTH + 1)
    expect(validateExpirationText(ascii)).toEqual({ ok: false, reason: 'TOO_LONG' })
    const emoji = '😀'.repeat(250) + 'a'
    expect(emoji.length).toBe(501)
    expect(validateExpirationText(emoji)).toEqual({ ok: false, reason: 'TOO_LONG' })
  })

  it('rejects non-string input without coercion', () => {
    for (const input of [undefined, null, 42, true, {}, [], Symbol('x'), () => 'x']) {
      expect(validateExpirationText(input)).toEqual({ ok: false, reason: 'NOT_A_STRING' })
    }
  })

  it('rejects empty and whitespace-only strings', () => {
    expect(validateExpirationText('')).toEqual({ ok: false, reason: 'EMPTY' })
    expect(validateExpirationText('   \u00a0\u2028 ')).toEqual({ ok: false, reason: 'EMPTY' })
  })

  it('rejects C0 controls (tab/newline/CR/NUL/US) before collapsing', () => {
    for (const control of ['\t', '\n', '\r', '\u0000', '\u001f']) {
      expect(validateExpirationText(`a${control}b`)).toEqual({
        ok: false,
        reason: 'CONTROL_CHARACTER',
      })
    }
    expect(validateExpirationText('\t')).toEqual({ ok: false, reason: 'CONTROL_CHARACTER' })
  })

  it('rejects DEL and C1 controls, including NEL that JS whitespace matches', () => {
    for (const control of ['\u007f', '\u0080', '\u0085', '\u009f']) {
      expect(validateExpirationText(`a${control}b`)).toEqual({
        ok: false,
        reason: 'CONTROL_CHARACTER',
      })
    }
  })

  it('is pure: never mutates the source', () => {
    const source = '  Cafe\u0301 \u00a0 vence  '
    const snapshot = String(source)
    validateExpirationText(source)
    expect(source).toBe(snapshot)
    const object = Object.freeze({ text: 'secret' })
    validateExpirationText(object)
    expect(object).toEqual({ text: 'secret' })
  })

  it('is value-free: a failure result never echoes the raw input', () => {
    const raw = `SENSITIVE-${'x'.repeat(EXPIRATION_TEXT_MAX_LENGTH)}`
    const result: ExpirationTextValidationResult = validateExpirationText(raw)
    expect(result.ok).toBe(false)
    expect(Object.keys(result)).toEqual(['ok', 'reason'])
    expect(JSON.stringify(result)).not.toContain('SENSITIVE')
  })
})
