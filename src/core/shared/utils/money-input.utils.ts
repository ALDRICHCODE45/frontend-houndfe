// The one rule for reading a typed amount (money or a decimal like a percent).
//
// Spaces, NBSP and `$` are dropped. A dot is the decimal separator. A comma is
// a thousands separator only in full groups of three (`1,234.50`, `12,345`); a
// single comma followed by one or two digits and no dot is a decimal comma
// (`70,55` → 70.55, `70,5` → 70.50). Any other comma is rejected, never
// guessed: reading `70,55` as thousands once settled 100× the amount. Signs,
// exponents, hex and letters are rejected, and so is a fraction digit beyond
// the allowed ones (never rounded). Cents come from the digits themselves, so
// no float multiplication ever happens.

import { formatCentsMXN } from './currency.utils'

export type MoneyInputErrorCode = 'empty' | 'comma' | 'format' | 'fraction' | 'range'

export type MoneyInputResult = { cents: number } | { error: string; code: MoneyInputErrorCode }

export type DecimalInputResult =
  | { text: string; scaled: number }
  | { error: string; code: MoneyInputErrorCode }

export const MONEY_INPUT_ERRORS = {
  empty: 'Escribe el monto.',
  comma: 'Escribe el monto con punto para los centavos, por ejemplo 70.55.',
  format: 'Escribe solo el monto en números, por ejemplo 70.55.',
  fraction: 'Usa como máximo dos decimales, por ejemplo 70.55.',
  range: 'El monto es demasiado grande.',
} as const satisfies Record<MoneyInputErrorCode, string>

const DECIMAL_INPUT_ERRORS = {
  empty: 'Escribe un número.',
  comma: 'Escribe el número con punto para los decimales, por ejemplo 12.5.',
  format: 'Escribe solo números, por ejemplo 12.5.',
  range: 'El número es demasiado grande.',
} as const

const IGNORED = /[\s\u00A0\u202F$]/g
const ALLOWED = /^[\d.,]+$/
const THOUSANDS = /^[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/
const DECIMAL_COMMA = /^\d+,\d{1,2}$/
const PLAIN = /^(0|[1-9]\d*)(?:\.(\d+))?$/

type Digits = { whole: string; fraction: string } | { code: Exclude<MoneyInputErrorCode, 'range'> }

function readDigits(text: string, maxFractionDigits: number): Digits {
  let compact = String(text ?? '').replace(IGNORED, '')
  if (compact === '') return { code: 'empty' }
  if (!ALLOWED.test(compact)) return { code: 'format' }
  if (compact.includes(',')) {
    if (THOUSANDS.test(compact)) compact = compact.replace(/,/g, '')
    else if (DECIMAL_COMMA.test(compact)) compact = compact.replace(',', '.')
    else return { code: 'comma' }
  }
  const match = PLAIN.exec(compact)
  if (!match) return { code: 'format' }
  const fraction = match[2] ?? ''
  if (fraction.length > maxFractionDigits) return { code: 'fraction' }
  return { whole: match[1]!, fraction }
}

/** Integer `whole.fraction × 10^digits`, or null when it is not a safe integer. */
function scale(whole: string, fraction: string, digits: number): number | null {
  const scaled = Number(whole + fraction.padEnd(digits, '0'))
  return Number.isSafeInteger(scaled) ? scaled : null
}

/**
 * A typed MXN amount as integer cents: `70.55`, `70,55` and `$1,234.50` read
 * as 7055, 7055 and 123450. Bounds are inclusive, in cents.
 */
export function parseMoneyInput(
  text: string,
  bounds: { minCents?: number; maxCents?: number } = {},
): MoneyInputResult {
  const digits = readDigits(text, 2)
  if ('code' in digits) return { error: MONEY_INPUT_ERRORS[digits.code], code: digits.code }
  const cents = scale(digits.whole, digits.fraction, 2)
  if (cents === null) return { error: MONEY_INPUT_ERRORS.range, code: 'range' }
  if (bounds.minCents != null && cents < bounds.minCents) {
    return { error: `El monto mínimo es ${formatCentsMXN(bounds.minCents)}.`, code: 'range' }
  }
  if (bounds.maxCents != null && cents > bounds.maxCents) {
    return { error: `El monto máximo es ${formatCentsMXN(bounds.maxCents)}.`, code: 'range' }
  }
  return { cents }
}

/**
 * A typed decimal such as a percent, under the same comma rule. `text` is the
 * plain canonical decimal (`12,5` → `12.5`), safe for `Number()`; `scaled` is
 * the exact integer `value × 10^maxFractionDigits` (`12.5`, 2 digits → 1250).
 */
export function parseDecimalInput(
  text: string,
  options: { maxFractionDigits: number },
): DecimalInputResult {
  const { maxFractionDigits } = options
  const digits = readDigits(text, maxFractionDigits)
  if ('code' in digits) {
    const error = digits.code === 'fraction'
      ? maxFractionDigits === 0 ? 'Escribe un número entero.' : `Usa como máximo ${maxFractionDigits} decimales.`
      : DECIMAL_INPUT_ERRORS[digits.code]
    return { error, code: digits.code }
  }
  const scaled = scale(digits.whole, digits.fraction, maxFractionDigits)
  if (scaled === null) return { error: DECIMAL_INPUT_ERRORS.range, code: 'range' }
  return { text: digits.fraction ? `${digits.whole}.${digits.fraction}` : digits.whole, scaled }
}

/** Integer cents as the plain text a money input shows: 123450 → `1234.50`. */
export function centsToMoneyInput(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error(`Not a cents amount: ${cents}`)
  const fraction = cents % 100
  return `${(cents - fraction) / 100}.${String(fraction).padStart(2, '0')}`
}
