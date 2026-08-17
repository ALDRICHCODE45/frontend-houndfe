import { toneToDotClass, type AppBadgeTone } from '@/core/shared/utils/badge.utils'
import type { Product, ProductType as ProductTypeAlias } from '../interfaces/product.types'

export const productStatusConfig = {
  active: { tone: 'active' as AppBadgeTone, label: 'Activo' },
  inactive: { tone: 'inactive' as AppBadgeTone, label: 'Inactivo' },
  out_of_stock: { tone: 'error' as AppBadgeTone, label: 'Sin Stock' },
} as const

/**
 * Single source of truth for the products list type badge. Mirrors the
 * promotions type-badge convention (`tone: 'type'` violet + icon), so a
 * SERVICE renders as a violet "Servicio" pill with a clock icon and a PRODUCT
 * as a violet "Producto" pill with a package icon — visually consistent with
 * the rest of the system's customized type badges.
 */
export function getProductTypeBadge(type: ProductTypeAlias): {
  tone: AppBadgeTone
  label: string
  icon: string
} {
  return type === 'SERVICE'
    ? { tone: 'type', label: 'Servicio', icon: 'i-lucide-clock' }
    : { tone: 'type', label: 'Producto', icon: 'i-lucide-package' }
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
