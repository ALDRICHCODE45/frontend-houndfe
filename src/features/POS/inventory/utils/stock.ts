import type { AdjustmentDialogTarget, KardexFilterOption, StockSnapshot } from '../interfaces/inventory.types'

export interface BucketRow {
  kind: 'untracked' | 'lot' | 'variant'
  // The product id is never needed: the untracked bucket is the product itself.
  id?: string
  label: string
  quantity: number
  version: number
  expired: boolean
  expiration: string | null
}

// Calendar date to short Spanish text. The parts are used as they are, so no
// time zone can move the day.
export function formatExpirationDate(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!match) return '—'
  const [, year, month, day] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (date.getUTCDate() !== Number(day)) return '—'
  const text = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
  return text.replace(/\./g, '').replace(/ de /g, ' ')
}

// The server sends lots in FEFO order (expiration, then id): keep it.
export function bucketRows(stock: StockSnapshot): BucketRow[] {
  if (!stock.product.useStock) return []
  if (stock.variants.length) {
    return stock.variants.map(variant => ({
      kind: 'variant', id: variant.id, label: variant.label, quantity: variant.quantity, version: variant.version,
      expired: false, expiration: null,
    }))
  }
  return [
    {
      kind: 'untracked', label: 'Sin lote', quantity: stock.product.untracked.quantity,
      version: stock.product.untracked.version, expired: false, expiration: null,
    },
    ...stock.lots.map((lot): BucketRow => ({
      kind: 'lot', id: lot.id, label: `Lote ${lot.lotNumber}`, quantity: lot.quantity, version: lot.version,
      expired: lot.expired, expiration: formatExpirationDate(lot.expirationDate),
    })),
  ]
}

// Always read from the current snapshot, so a reload hands the open dialog the
// new quantity and version.
export function adjustmentTargetFor(stock: StockSnapshot, row: BucketRow): AdjustmentDialogTarget | null {
  const base = { productId: stock.product.id, productName: stock.product.name }
  if (row.kind === 'untracked') {
    const { quantity, version } = stock.product.untracked
    return { ...base, bucketLabel: row.label, quantity, version }
  }
  if (row.kind === 'lot') {
    const lot = stock.lots.find(item => item.id === row.id)
    if (!lot) return null
    return { ...base, lotId: lot.id, bucketLabel: `Lote ${lot.lotNumber}`, quantity: lot.quantity, version: lot.version }
  }
  const variant = stock.variants.find(item => item.id === row.id)
  if (!variant) return null
  return { ...base, variantId: variant.id, bucketLabel: variant.label, quantity: variant.quantity, version: variant.version }
}

export function kardexFilters(stock: StockSnapshot): KardexFilterOption[] {
  if (stock.variants.length) return stock.variants.map(variant => ({ kind: 'variant', id: variant.id, label: variant.label }))
  return stock.lots.map(lot => ({ kind: 'lot', id: lot.id, label: `Lote ${lot.lotNumber}` }))
}
