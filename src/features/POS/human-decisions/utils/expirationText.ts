/**
 * EXPIRATION WU1 — pure `expirationText` normalization (mirrors backend
 * HD-EXP-01a). Fixed order: require string; NFC; reject C0/C1/DEL BEFORE any
 * collapsing; collapse remaining Unicode whitespace runs to one ASCII space and
 * trim; require 1..500 UTF-16 code units (`String.length`) AFTER normalization,
 * rejecting (never truncating) a longer value. Failures are a discriminated,
 * value-free `{ ok:false, reason }` with no echoed input. Pure; no dependency.
 */

/** Maximum normalized `expirationText` length in UTF-16 code units. */
export const EXPIRATION_TEXT_MAX_LENGTH = 500

/** Stable, value-free failure codes; safe to branch on for UI copy. */
export type ExpirationTextValidationReason =
  | 'NOT_A_STRING'
  | 'CONTROL_CHARACTER'
  | 'EMPTY'
  | 'TOO_LONG'

/** Discriminated validation result: a normalized value or a stable reason. */
export type ExpirationTextValidationResult =
  | { ok: true; value: string }
  | { ok: false; reason: ExpirationTextValidationReason }

/** Runs of Unicode whitespace (spaces, NBSP, line/paragraph separators, ...). */
const WHITESPACE_RUN = /\s+/gu

/** True when the string contains a C0, DEL or C1 control character. */
function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}

/**
 * Validate and normalize operator-provided `expirationText`. Pure,
 * non-mutating and value-free: the rejected input is never echoed.
 */
export function validateExpirationText(value: unknown): ExpirationTextValidationResult {
  if (typeof value !== 'string') return { ok: false, reason: 'NOT_A_STRING' }

  const decomposed = value.normalize('NFC')
  if (hasControlCharacter(decomposed)) return { ok: false, reason: 'CONTROL_CHARACTER' }

  const collapsed = decomposed.replace(WHITESPACE_RUN, ' ').trim()
  if (collapsed.length === 0) return { ok: false, reason: 'EMPTY' }
  if (collapsed.length > EXPIRATION_TEXT_MAX_LENGTH) return { ok: false, reason: 'TOO_LONG' }

  return { ok: true, value: collapsed }
}
