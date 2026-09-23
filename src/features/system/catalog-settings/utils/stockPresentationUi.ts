/**
 * stockPresentationUi.ts — single source of truth for the customer-facing
 * stock-presentation copy (labels, honest explanations, and a public preview)
 * shared by the tenant global stock default, the read-only tenant view, and the
 * reusable product/variant override controls.
 *
 * Presentation-only module: it never builds payloads, never rewrites backend
 * enum values, and never changes inheritance semantics. Copy claims are limited
 * to public display policy — operational stock stays the sole sellability
 * authority, so no description promises inventory or fulfillment availability.
 */

import type { OnlineStockPresentationMode } from '../interfaces/catalog-settings.types'

/** Inheritance target of a nullable product/variant stock override. */
export type StockOverrideScope = 'product' | 'variant'

export interface StockPresentationUiCopy {
  /** Customer-facing mode label, used by selects and read-only views. */
  label: string
  /** Honest one-sentence explanation of what the mode does. */
  description: string
  /** Short sample of what the public catalog shows for this mode. */
  preview: string
}

/** Closed four-mode set, in the order the select renders it. */
export const STOCK_PRESENTATION_MODE_ORDER: readonly OnlineStockPresentationMode[] = [
  'SYSTEM_STATUS',
  'ABSTRACT_STATUS',
  'CUSTOM_QUANTITY',
  'HIDDEN',
]

/**
 * Per-mode copy. `SYSTEM_STATUS` mirrors the operational status without
 * publishing quantities; `ABSTRACT_STATUS` collapses it to availability and
 * suppresses low-stock disclosure; `CUSTOM_QUANTITY` is display data only;
 * `HIDDEN` suppresses public stock text while operational validation remains.
 */
export const STOCK_PRESENTATION_COPY: Record<OnlineStockPresentationMode, StockPresentationUiCopy> =
  {
    SYSTEM_STATUS: {
      label: 'Estado detallado',
      description:
        'Muestra Disponible, Pocas piezas o Agotado según las existencias reales, sin publicar cantidades.',
      preview: 'Disponible · Pocas piezas · Agotado',
    },
    ABSTRACT_STATUS: {
      label: 'Solo disponibilidad',
      description: 'Muestra solo Disponible o Agotado, sin revelar cuándo queda poco stock.',
      preview: 'Disponible · Agotado',
    },
    CUSTOM_QUANTITY: {
      label: 'Mostrar cantidad fija',
      description:
        'Muestra siempre la cantidad definida como dato informativo; no cambia las existencias y la venta sigue bloqueada si no hay stock real.',
      preview: 'Mostrar cantidad',
    },
    HIDDEN: {
      label: 'No mostrar stock',
      description:
        'No muestra ningún texto de stock en el catálogo; las validaciones de venta siguen usando las existencias reales.',
      preview: 'Sin texto de stock',
    },
  }

/**
 * Null-override inheritance copy. The product scope inherits from the tenant
 * global configuration; the variant scope inherits from its product.
 */
export const STOCK_OVERRIDE_INHERITANCE_COPY: Record<StockOverrideScope, StockPresentationUiCopy> =
  {
    product: {
      label: 'Usar configuración global',
      description: 'El stock mostrado se toma de la configuración global del catálogo.',
      preview: 'Stock según la configuración global del catálogo',
    },
    variant: {
      label: 'Usar configuración del producto',
      description: 'El stock mostrado se toma de la configuración del producto.',
      preview: 'Stock según la configuración del producto',
    },
  }

export interface StockPresentationModeOption {
  label: string
  value: OnlineStockPresentationMode
}

export interface StockOverrideOption {
  label: string
  value: OnlineStockPresentationMode | null
}

/** Copy for one of the four resolved modes. */
export function getStockPresentationCopy(
  mode: OnlineStockPresentationMode,
): StockPresentationUiCopy {
  return STOCK_PRESENTATION_COPY[mode]
}

/** Copy for the null-override option of the given scope. */
export function getStockOverrideInheritanceCopy(
  scope: StockOverrideScope,
): StockPresentationUiCopy {
  return STOCK_OVERRIDE_INHERITANCE_COPY[scope]
}

/** `Mostrar 0` is meaningful: a literal 0 is display data, not an empty value. */
export function formatCustomQuantityLabel(quantity: number | null | undefined): string {
  return `Mostrar ${quantity ?? 0}`
}

/**
 * Public preview for a resolved (non-null) mode. For `CUSTOM_QUANTITY` it
 * mirrors the storefront wording exactly — `CatalogProductCard` and
 * `CatalogProductDetailModal` both render `` `${customQuantity} unidades` ``,
 * so `0` shows as `0 unidades` rather than the admin-only `Mostrar 0` label.
 */
export function resolveStockPresentationPreview(
  mode: OnlineStockPresentationMode,
  customQuantity: number | null,
): string {
  if (mode === 'CUSTOM_QUANTITY') return `${customQuantity ?? 0} unidades`
  return STOCK_PRESENTATION_COPY[mode].preview
}

/** Public preview for a nullable override; `null` inherits from the given scope. */
export function resolveStockOverridePreview(
  mode: OnlineStockPresentationMode | null,
  customQuantity: number | null,
  scope: StockOverrideScope,
): string {
  if (mode === null) return getStockOverrideInheritanceCopy(scope).preview
  return resolveStockPresentationPreview(mode, customQuantity)
}

/** Select items for the tenant global default (never nullable). */
export function buildStockPresentationModeOptions(): StockPresentationModeOption[] {
  return STOCK_PRESENTATION_MODE_ORDER.map((mode) => ({
    label: STOCK_PRESENTATION_COPY[mode].label,
    value: mode,
  }))
}

/** Select items for a nullable product/variant override, inheritance first. */
export function buildStockOverrideOptions(scope: StockOverrideScope): StockOverrideOption[] {
  return [
    { label: getStockOverrideInheritanceCopy(scope).label, value: null },
    ...buildStockPresentationModeOptions(),
  ]
}
