import type { AppBadgeTone, StatusBadgeTone } from '@/core/shared/utils/badge.utils'
import type { Product, ProductType as ProductTypeAlias } from '../interfaces/product.types'

/** Product status → StatusBadge tone: archived-like states are neutral, never red. */
export const productStatusConfig = {
  active: { tone: 'success' as StatusBadgeTone, label: 'Activo' },
  inactive: { tone: 'neutral' as StatusBadgeTone, label: 'Inactivo' },
  out_of_stock: { tone: 'danger' as StatusBadgeTone, label: 'Sin Stock' },
} as const

/** Label and icon of the product type; the type is a category, not a status, so it has no tone. */
export function getProductTypeBadge(type: ProductTypeAlias): {
  label: string
  icon: string
} {
  return type === 'SERVICE'
    ? { label: 'Servicio', icon: 'i-lucide-clock' }
    : { label: 'Producto', icon: 'i-lucide-package' }
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
 * out-of-stock / low-stock / healthy). Shared by the table and the mobile
 * cards so the stock-level semantics never drift between layouts.
 */
export const getProductStockTone = (product: Product): AppBadgeTone => {
  if (product.hasVariants) {
    return product.variantStockTotal != null ? getStockTone(product.variantStockTotal) : 'info'
  }

  return getStockTone(product.quantity, product.minQuantity)
}

/**
 * Stock display (verbose label + shared tone) used by BOTH the table and the
 * mobile cards. Centralizes the label so the two layouts never drift; the
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

/** Only low or empty stock earns a badge; healthy stock reads as plain text. */
export const stockNeedsAttention = (product: Product): boolean => {
  const tone = getProductStockTone(product)
  return tone === 'warning' || tone === 'error'
}
