const MXN_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Format integer cents as MXN string. 4998 → "$49.98" */
export function formatCentsMXN(cents: number): string {
  return MXN_FORMATTER.format(cents / 100)
}

/** Sum line totals in integer cents. */
export function sumLineCents(
  items: ReadonlyArray<{ unitPriceCents: number; quantity: number }>,
): number {
  return items.reduce((acc, it) => acc + it.unitPriceCents * it.quantity, 0)
}

/** Single item line total in cents. */
export function lineCents(unitPriceCents: number, quantity: number): number {
  return unitPriceCents * quantity
}
