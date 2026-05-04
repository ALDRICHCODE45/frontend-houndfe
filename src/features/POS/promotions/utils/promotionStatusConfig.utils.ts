import type { PromotionMethod, PromotionStatus, PromotionType } from '../interfaces/promotion.types'
import type { AppBadgeTone } from '@/core/shared/utils/badge.utils'

// ── Status config ─────────────────────────────────────────────────────────────

export interface StatusBadgeConfig {
  label: string
  tone: AppBadgeTone
  icon: string
}

export const PROMOTION_STATUS_CONFIG: Record<PromotionStatus, StatusBadgeConfig> = {
  ACTIVE: {
    label: 'Activa',
    tone: 'active',
    icon: 'i-lucide-circle-check',
  },
  SCHEDULED: {
    label: 'Programada',
    tone: 'pending',
    icon: 'i-lucide-clock',
  },
  ENDED: {
    label: 'Finalizada',
    tone: 'inactive',
    icon: 'i-lucide-circle-x',
  },
}

export function getStatusConfig(status: PromotionStatus): StatusBadgeConfig {
  return PROMOTION_STATUS_CONFIG[status]
}

// ── Type config ───────────────────────────────────────────────────────────────

export interface TypeBadgeConfig {
  label: string
  tone: AppBadgeTone
  icon: string
}

export const PROMOTION_TYPE_CONFIG: Record<PromotionType, TypeBadgeConfig> = {
  PRODUCT_DISCOUNT: {
    label: 'Descuento en productos',
    tone: 'type',
    icon: 'i-lucide-tag',
  },
  ORDER_DISCOUNT: {
    label: 'Descuento en pedido',
    tone: 'type',
    icon: 'i-lucide-receipt',
  },
  BUY_X_GET_Y: {
    label: '2x1, 3x2...',
    tone: 'type',
    icon: 'i-lucide-gift',
  },
  ADVANCED: {
    label: 'Avanzada',
    tone: 'type',
    icon: 'i-lucide-settings-2',
  },
}

export function getTypeConfig(type: PromotionType): TypeBadgeConfig {
  return PROMOTION_TYPE_CONFIG[type]
}

// ── Method config ──────────────────────────────────────────────────────────────

export interface MethodBadgeConfig {
  label: string
  tone: AppBadgeTone
  icon?: string
}

export const PROMOTION_METHOD_CONFIG: Record<PromotionMethod, MethodBadgeConfig> = {
  AUTOMATIC: {
    label: 'Automático',
    tone: 'automatic',
  },
  MANUAL: {
    label: 'Manual',
    tone: 'manual',
  },
}

export function getMethodConfig(method: PromotionMethod): MethodBadgeConfig {
  return PROMOTION_METHOD_CONFIG[method]
}
