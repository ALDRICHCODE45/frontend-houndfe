import type { AppBadgeTone } from '@/core/shared/utils/badge.utils'
import type { Product } from '../interfaces/product.types'

export const productStatusConfig = {
  active: { tone: 'active' as AppBadgeTone, label: 'Activo' },
  inactive: { tone: 'inactive' as AppBadgeTone, label: 'Inactivo' },
  out_of_stock: { tone: 'error' as AppBadgeTone, label: 'Sin Stock' },
} as const

export const getStockTone = (stock: number, minQuantity = 10): AppBadgeTone => {
  if (stock === 0) return 'error'
  if (stock <= minQuantity) return 'warning'
  return 'success'
}

export interface ProductStockDisplay {
  label: string
  tone: AppBadgeTone
}

/**
 * Single source of truth for a product's stock TONE (the business rule:
 * out-of-stock / low-stock / healthy). Shared by the products table and the
 * product cards so the stock-level semantics never drift between views.
 */
export const getProductStockTone = (product: Product): AppBadgeTone => {
  if (product.hasVariants) {
    return product.variantStockTotal != null ? getStockTone(product.variantStockTotal) : 'info'
  }

  return getStockTone(product.quantity, product.minQuantity)
}

/**
 * Card-oriented stock display (verbose label + shared tone).
 * The table renders its own compact label but reuses getProductStockTone,
 * so only the presentation differs, never the stock-level rule.
 */
export const getProductStockDisplay = (product: Product): ProductStockDisplay => {
  if (product.hasVariants && product.variantStockTotal != null) {
    const variantWord = product.variantCount === 1 ? 'variante' : 'variantes'
    return {
      label: `${product.variantStockTotal} unidades en ${product.variantCount} ${variantWord}`,
      tone: getProductStockTone(product),
    }
  }

  if (product.hasVariants) {
    return { label: 'En variantes', tone: getProductStockTone(product) }
  }

  return {
    label: `${product.quantity} unidades`,
    tone: getProductStockTone(product),
  }
}
