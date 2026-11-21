import type { Sale, SaleItem } from '../interfaces/sale.types'

/**
 * Restock backorders: some units are held for «pedidos por reposición». The wording never says «sin stock»:
 * the stock exists, the counter just cannot sell the held part.
 */

const unitsApartadas = (reserved: number): string =>
  `${reserved} ${reserved === 1 ? 'unidad apartada' : 'unidades apartadas'}`

/** Add-item / quantity notice (non-blocking). */
export function reservedForBackorderWarningMessage(available: number, reserved: number): string {
  return `Hay ${unitsApartadas(reserved)} para pedidos por reposición; solo puedes vender ${available}.`
}

/** Charge 409: the sale stays DRAFT, so tell the cashier what to do next. */
export function reservedForBackorderChargeMessage(
  available: number | undefined,
  reserved: number | undefined,
): string {
  const next = 'La venta sigue abierta: ajusta las cantidades para cobrar.'
  if (typeof available !== 'number' || typeof reserved !== 'number') {
    return `Hay unidades apartadas para pedidos por reposición. ${next}`
  }
  return `${reservedForBackorderWarningMessage(available, reserved)} ${next}`
}

interface StockWarningOfLine {
  item: SaleItem
  available: number
  reserved: number
}

/** The warnings carried by the touched line(s) of an add-item / PATCH response. */
export function stockWarningsOf(sale: Sale): StockWarningOfLine[] {
  return sale.items.flatMap((item) =>
    item.stockWarning?.code === 'STOCK_RESERVED_FOR_BACKORDER'
      ? [{ item, available: item.stockWarning.available, reserved: item.stockWarning.reserved }]
      : [],
  )
}

/** The warning lives only in that response: cached drafts never keep it. Same object when nothing to strip. */
export function withoutStockWarnings(sale: Sale): Sale {
  if (!sale.items.some((item) => 'stockWarning' in item)) return sale
  return {
    ...sale,
    items: sale.items.map((item) => {
      const { stockWarning: _stockWarning, ...rest } = item
      return rest
    }),
  }
}
