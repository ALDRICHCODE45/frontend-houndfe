import type { AppBadgeTone, StatusBadgeTone } from '@/core/shared/utils/badge.utils'
import type { Product, ProductType as ProductTypeAlias } from '../interfaces/product.types'

/** Product status → StatusBadge tone: archived-like states are neutral, never red. */
export const productStatusConfig = {
  active: { tone: 'success' as StatusBadgeTone, label: 'Activo' },
  inactive: { tone: 'neutral' as StatusBadgeTone, label: 'Inactivo' },
  out_of_stock: { tone: 'danger' as StatusBadgeTone, label: 'Sin stock' },
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

/** "1 unidad", "24 unidades": the noun agrees in number. */
const unitsLabel = (count: number): string => `${count} ${count === 1 ? 'unidad' : 'unidades'}`

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
      label: `${unitsLabel(product.variantStockTotal)} en ${product.variantCount} ${variantWord}`,
      tone: getProductStockTone(product),
    }
  }

  if (product.hasVariants) {
    return { label: 'En variantes', tone: getProductStockTone(product) }
  }

  return {
    label: unitsLabel(product.quantity),
    tone: getProductStockTone(product),
  }
}

/**
 * Short stock label for a mobile card footer: the unit total only, with no
 * variant count, so "$249.00 · 24 unidades" stays on one line.
 */
export const getProductStockCompactLabel = (product: Product): string => {
  if (product.hasVariants) {
    return product.variantStockTotal != null ? unitsLabel(product.variantStockTotal) : 'En variantes'
  }
  return unitsLabel(product.quantity)
}

/** Only low or empty stock earns a badge; healthy stock reads as plain text. */
export const stockNeedsAttention = (product: Product): boolean => {
  const tone = getProductStockTone(product)
  return tone === 'warning' || tone === 'error'
}
