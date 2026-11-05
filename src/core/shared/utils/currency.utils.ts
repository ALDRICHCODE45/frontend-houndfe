// Canonical currency utilities for the app.
//
// This module is the single source of truth for currency formatting and
// for cents <-> major-unit conversions. All features (POS sales, POS
// products, data-table filters, etc.) import from here. Typed amounts are
// read with `parseMoneyInput` (money-input.utils.ts), the one input rule.
// Module-specific re-exports (e.g. `features/POS/sales/utils/currency.utils.ts`) exist
// only for ergonomic short paths and MUST NOT redefine these helpers.
//
// Locale and currency are fixed to Mexico (es-MX / MXN). If the product
// goes multi-tenant in other countries, replace these constants with a
// tenant-resolved value and accept the locale/currency as parameters
// rather than hardcoding them at the call site.

const LOCALE = 'es-MX'
const CURRENCY = 'MXN'

/**
 * Pre-built MXN formatter for amounts already expressed in major units
 * (pesos). Use this when you have a decimal like `1234.5` and want it
 * displayed as "$1,234.50". For amounts stored in cents, prefer
 * `formatCentsMXN`.
 */
export const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const DECIMAL_STRING = /^-?\d+(\.\d+)?$/
const decimalFormatters = new Map<string, Intl.NumberFormat>()

function formatDecimal(amount: string, currency: string, minimum: number, maximum: number): string {
  const key = `${currency}:${minimum}:${maximum}`
  try {
    let formatter = decimalFormatters.get(key)
    if (!formatter) {
      formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency, minimumFractionDigits: minimum, maximumFractionDigits: maximum })
      decimalFormatters.set(key, formatter)
    }
    // SAFETY: callers admit only plain decimals, which Intl (ES2023) formats exactly from
    // the string; the lib typings of this tsconfig predate that overload.
    return (formatter as unknown as { format(value: string): string }).format(amount)
  } catch {
    return amount
  }
}

/**
 * Display-only formatting of a canonical decimal string from the server
 * ("780.5" -> "$780.50"): exactly 2 fraction digits, extra precision rounded
 * half-up for the screen ("128.125" -> "$128.13"). The wire string is never
 * changed; `formatDecimalMoneyExact` and `decimalMoneyTitle` give the exact value
 * for hover text. Anything that is not a plain decimal, or a currency Intl
 * rejects, is returned unchanged.
 */
export function formatDecimalMoney(amount: string, currency: string = CURRENCY): string {
  return DECIMAL_STRING.test(amount) ? formatDecimal(amount, currency, 2, 2) : amount
}

/**
 * The exact value of a server decimal string: at least 2 and up to 4 fraction
 * digits, more only when the server sent more significant ones ("128.125" ->
 * "$128.125"). Use it for tooltips and data, not for the visible amount.
 */
export function formatDecimalMoneyExact(amount: string, currency: string = CURRENCY): string {
  if (!DECIMAL_STRING.test(amount)) return amount
  const significant = (amount.match(/\.(\d+)/)?.[1] ?? '').replace(/0+$/, '').length
  return formatDecimal(amount, currency, 2, Math.min(Math.max(4, significant), 20))
}

/** The exact amount for a `title` attribute, only where the displayed amount was rounded; otherwise undefined. */
export function decimalMoneyTitle(amount: string, currency: string = CURRENCY): string | undefined {
  const exact = formatDecimalMoneyExact(amount, currency)
  return exact === formatDecimalMoney(amount, currency) ? undefined : exact
}

/** Format integer cents as MXN string. 4998 -> "$49.98". */
export function formatCentsMXN(cents: number): string {
  return currencyFormatter.format(cents / 100)
}

/** Single item line total in cents. */
export function lineCents(unitPriceCents: number, quantity: number): number {
  return unitPriceCents * quantity
}

/** Sum line totals in integer cents. */
export function sumLineCents(
  items: ReadonlyArray<{ unitPriceCents: number; quantity: number }>,
): number {
  return items.reduce((acc, it) => acc + it.unitPriceCents * it.quantity, 0)
}

/**
 * Currency configuration constants exposed so non-formatter consumers
 * (e.g. `Intl.NumberFormat` inside a Vue component with custom format
 * options) can stay consistent without duplicating the literal strings.
 */
export const CURRENCY_CONFIG = {
  locale: LOCALE,
  currency: CURRENCY,
} as const
