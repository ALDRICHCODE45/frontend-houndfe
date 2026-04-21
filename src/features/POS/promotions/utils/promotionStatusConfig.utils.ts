import type { PromotionMethod, PromotionStatus, PromotionType } from '../interfaces/promotion.types'

// ── Status config ─────────────────────────────────────────────────────────────

export interface StatusBadgeConfig {
  label: string
  color: 'success' | 'info' | 'neutral'
  variant: 'subtle'
  icon: string
}

export const PROMOTION_STATUS_CONFIG: Record<PromotionStatus, StatusBadgeConfig> = {
  ACTIVE: {
    label: 'Activa',
    color: 'success',
    variant: 'subtle',
    icon: 'i-lucide-circle-check',
  },
  SCHEDULED: {
    label: 'Programada',
    color: 'info',
    variant: 'subtle',
    icon: 'i-lucide-clock',
  },
  ENDED: {
    label: 'Finalizada',
    color: 'neutral',
    variant: 'subtle',
    icon: 'i-lucide-circle-x',
  },
}

export function getStatusConfig(status: PromotionStatus): StatusBadgeConfig {
  return PROMOTION_STATUS_CONFIG[status]
}

// ── Type config ───────────────────────────────────────────────────────────────

export interface TypeBadgeConfig {
  label: string
  color: 'warning' | 'primary' | 'success' | 'secondary'
  variant: 'subtle'
  icon: string
}

export const PROMOTION_TYPE_CONFIG: Record<PromotionType, TypeBadgeConfig> = {
  PRODUCT_DISCOUNT: {
    label: 'Descuento en productos',
    color: 'warning',
    variant: 'subtle',
    icon: 'i-lucide-tag',
  },
  ORDER_DISCOUNT: {
    label: 'Descuento en pedido',
    color: 'primary',
    variant: 'subtle',
    icon: 'i-lucide-receipt',
  },
  BUY_X_GET_Y: {
    label: '2x1, 3x2...',
    color: 'success',
    variant: 'subtle',
    icon: 'i-lucide-gift',
  },
  ADVANCED: {
    label: 'Avanzada',
    color: 'secondary',
    variant: 'subtle',
    icon: 'i-lucide-settings-2',
  },
}

export function getTypeConfig(type: PromotionType): TypeBadgeConfig {
  return PROMOTION_TYPE_CONFIG[type]
}

// ── Method config ──────────────────────────────────────────────────────────────

export interface MethodBadgeConfig {
  label: string
  color: 'info' | 'neutral'
  variant: 'outline'
  icon?: string
}

export const PROMOTION_METHOD_CONFIG: Record<PromotionMethod, MethodBadgeConfig> = {
  AUTOMATIC: {
    label: 'Automático',
    color: 'info',
    variant: 'outline',
  },
  MANUAL: {
    label: 'Manual',
    color: 'neutral',
    variant: 'outline',
  },
}

export function getMethodConfig(method: PromotionMethod): MethodBadgeConfig {
  return PROMOTION_METHOD_CONFIG[method]
}
