/**
 * Product stock errors (O1 S7). The products module keeps its own error body
 * `{ statusCode, error, message, timestamp }`: these four codes are switched on
 * `error`, never on `message`, and each maps to the field or action it blocks.
 */

export type ProductStockErrorField = 'quantity' | 'useStock' | 'lots' | 'type'

export interface ProductStockError {
  code: string
  field: ProductStockErrorField
  message: string
}

const PRODUCT_STOCK_ERRORS: Record<string, Omit<ProductStockError, 'code'>> = {
  STOCK_QUANTITY_READ_ONLY: {
    field: 'quantity',
    message: 'El stock no se edita aquí. Ajústalo desde Inventario.',
  },
  STOCK_TRACKING_HAS_STOCK: {
    field: 'useStock',
    message: 'Hay existencias. Ajusta el stock a 0 antes de desactivar «Usar stock».',
  },
  LOT_HAS_STOCK: {
    field: 'lots',
    message: 'El lote aún tiene existencias. Ajústalas a 0 antes de eliminarlo.',
  },
  PRODUCT_TYPE_CHANGE_BLOCKED: {
    field: 'type',
    message: 'El producto tiene existencias o lotes. Ajusta el stock a 0 antes de cambiar el tipo.',
  },
}

/** The mapped stock error of a failed request, or null when the code is not one of them. */
export function productStockError(error: unknown): ProductStockError | null {
  const data = (error as { response?: { data?: { error?: unknown } } } | null | undefined)?.response
    ?.data
  const code = data?.error
  if (typeof code !== 'string') return null
  const mapped = PRODUCT_STOCK_ERRORS[code]
  return mapped ? { code, ...mapped } : null
}

/** True when a saved product still holds units, directly or through its variants. */
export function hasStockOnHand(
  product: { quantity: number; variantStockTotal?: number | null } | null | undefined,
): boolean {
  if (!product) return false
  return product.quantity > 0 || (product.variantStockTotal ?? 0) > 0
}
