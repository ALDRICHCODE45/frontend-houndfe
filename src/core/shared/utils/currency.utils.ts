// Canonical currency utilities for the app.
//
// This module is the single source of truth for currency formatting and
// for cents <-> major-unit conversions. All features (POS sales, POS
// products, data-table filters, etc.) import from here. Module-specific
// re-exports (e.g. `features/POS/sales/utils/currency.utils.ts`) exist
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

/**
 * Display-only formatting of a canonical decimal string from the server
 * ("780.5" -> "$780.50"). The string goes to Intl untouched, so it is never
 * recalculated or rounded: at least 2 and up to 4 fraction digits, more only
 * when the server sent more significant ones. Anything that is not a plain
 * decimal, or a currency Intl rejects, is returned unchanged.
 */
export function formatDecimalMoney(amount: string, currency: string = CURRENCY): string {
  if (!DECIMAL_STRING.test(amount)) return amount
  const significant = (amount.match(/\.(\d+)/)?.[1] ?? '').replace(/0+$/, '').length
  const digits = Math.min(Math.max(4, significant), 20)
  const key = `${currency}:${digits}`
  try {
    let formatter = decimalFormatters.get(key)
    if (!formatter) {
      formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: digits })
      decimalFormatters.set(key, formatter)
    }
    // SAFETY: the regex above admits only plain decimals, which Intl (ES2023) formats
    // exactly from the string; the lib typings of this tsconfig predate that overload.
    return (formatter as unknown as { format(value: string): string }).format(amount)
  } catch {
    return amount
  }
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

/** Normalizes decimal input to dot notation. "50,5" -> "50.5". */
export function normalizeDecimalInput(value: string): string {
  return String(value ?? '').replace(',', '.').trim()
}

/** Converts major currency units to integer cents. */
export function currencyToCents(amount: number): number {
  return Math.round(amount * 100)
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
