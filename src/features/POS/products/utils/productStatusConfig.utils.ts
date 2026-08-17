import { toneToDotClass, type AppBadgeTone } from '@/core/shared/utils/badge.utils'
import type { Product, ProductType as ProductTypeAlias } from '../interfaces/product.types'

export const productStatusConfig = {
  active: { tone: 'active' as AppBadgeTone, label: 'Activo' },
  inactive: { tone: 'inactive' as AppBadgeTone, label: 'Inactivo' },
  out_of_stock: { tone: 'error' as AppBadgeTone, label: 'Sin Stock' },
} as const

/**
 * Single source of truth for the products list type badge (SERVICE = info
 * "Servicio", PRODUCT = neutral "Producto"). Mirrors `productStatusConfig`
 * so the table cell renders the same tone + label as the rest of the column.
 */
export function getProductTypeBadge(type: ProductTypeAlias): {
  tone: AppBadgeTone
  label: string
} {
  return type === 'SERVICE'
    ? { tone: 'info', label: 'Servicio' }
    : { tone: 'neutral', label: 'Producto' }
}

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
 * Dot color class for a product's stock level, derived from its tone.
 * Lets the stock badge use the neutral DotBadge (dot-only color) while
 * keeping the out-of-stock/low/healthy rule as the single source of truth.
 */
export const getProductStockDotClass = (product: Product): string =>
  toneToDotClass(getProductStockTone(product))

/**
 * Stock display (verbose label + shared tone) used by BOTH the products table
 * and the product cards. Centralizes the label so the two surfaces never drift;
 * the dot color is derived separately via getProductStockDotClass, and the
 * stock-level rule always comes from getProductStockTone.
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
