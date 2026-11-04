import { statusBadgeTone, type AppBadgeTone } from './badge.utils'

/**
 * Neutral tone guard (design-system.md, Status badge). A draft is neutral everywhere, and a payment
 * method is a plain chip, not a state, so neither carries a colour. Features keep mapping their own
 * domain states to tones; this only says which maps may not use anything but neutral.
 */

/** Keys that name a draft (`DRAFT`, `Borrador`). */
export const DRAFT_STATE_KEYS = /^(draft|borrador)$/i

/**
 * Keys that name a payment method (`CASH`, `CARD_CREDIT`, `TRANSFER`, `Efectivo`...). A bare `CREDIT`
 * is left out on purpose: it is also a payment *state* ("A crédito"), which may carry a tone.
 */
export const PAYMENT_METHOD_KEYS =
  /^(cash|card_credit|card_debit|transfer|efectivo|tarjeta|transferencia)$/i

/** Every word a feature uses as a tone: the StatusBadge vocabulary plus the colours it must not use. */
const TONE_WORDS = new Set<string>([
  'neutral', 'info', 'success', 'warning', 'error', 'danger',
  'active', 'pending', 'inactive', 'manual', 'automatic', 'type',
  'primary', 'secondary',
])

// `primary` and `secondary` are not StatusBadge tones, so they resolve to nothing and fail the guard.
function isNeutralTone(tone: string): boolean {
  return statusBadgeTone(tone as AppBadgeTone) === 'neutral'
}

/** `KEY: tone` for each entry of a runtime map whose key matches and whose tone is not neutral. */
export function findNonNeutralTones(map: Record<string, string>, keys: RegExp): string[] {
  return Object.entries(map)
    .filter(([key, tone]) => keys.test(key) && !isNeutralTone(tone))
    .map(([key, tone]) => `${key}: ${tone}`)
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/**
 * The same check on source text: `KEY: 'tone'` entries for a draft or a payment method whose value
 * is a tone word other than neutral. A label (`DRAFT: 'Borrador'`) or an enum (`DRAFT: 'DRAFT'`) is
 * not a tone word, so it is ignored.
 */
export function scanToneMapSource(source: string): string[] {
  const entry = /(?<![\w$.])(['"]?)([A-Za-z_]+)\1\s*:\s*(['"])([A-Za-z]+)\3/g
  return [...withoutComments(source).matchAll(entry)]
    .filter(([, , key = '', , tone = '']) => {
      const named = DRAFT_STATE_KEYS.test(key) || PAYMENT_METHOD_KEYS.test(key)
      return named && TONE_WORDS.has(tone) && !isNeutralTone(tone)
    })
    .map(([, , key, , tone]) => `${key}: ${tone}`)
}
