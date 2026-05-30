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
