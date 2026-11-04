interface QuantityRow {
  quantity: number
}

export interface ProductStockTotalInput {
  type: 'PRODUCT' | 'SERVICE'
  useStock: boolean
  hasVariants: boolean
  useLotsAndExpirations: boolean
  isCreateMode: boolean
  formQuantity: number
  pendingVariants: QuantityRow[]
  variants: QuantityRow[]
  variantStockTotal?: number
  pendingLots: QuantityRow[]
  lots: QuantityRow[]
  /** Saved product total from the server: the untracked portion plus every lot. */
  savedQuantity?: number
}

const sum = (rows: QuantityRow[]) => rows.reduce((total, row) => total + row.quantity, 0)

/**
 * Stock shown in the product summary. A saved lots product shows the server total, because the
 * lots alone leave out the untracked portion (inventory journal O1).
 */
export function productStockTotal(input: ProductStockTotalInput): number | null {
  if (input.type === 'SERVICE' || !input.useStock) return null

  if (input.hasVariants) {
    if (input.isCreateMode) return sum(input.pendingVariants)
    if (input.variants.length > 0) return sum(input.variants)
    return input.variantStockTotal ?? 0
  }

  if (input.useLotsAndExpirations) {
    if (input.isCreateMode) return sum(input.pendingLots)
    return input.savedQuantity ?? sum(input.lots)
  }

  return input.formQuantity
}
