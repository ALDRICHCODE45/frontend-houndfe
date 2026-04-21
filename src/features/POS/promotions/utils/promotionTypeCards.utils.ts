import type { PromotionType } from '../interfaces/promotion.types'

// ── Type card config ───────────────────────────────────────────────────────────

export interface PromotionTypeCard {
  type: PromotionType
  icon: string
  title: string
  description: string
  example: string
}

export const PROMOTION_TYPE_CARDS: PromotionTypeCard[] = [
  {
    type: 'PRODUCT_DISCOUNT',
    icon: 'i-lucide-tag',
    title: 'Descuento en productos',
    description: 'Aplica un descuento porcentual o fijo a productos específicos.',
    example: 'Ej.: 30% off en zapatos',
  },
  {
    type: 'ORDER_DISCOUNT',
    icon: 'i-lucide-receipt',
    title: 'Descuento en el total del pedido',
    description: 'Reduce el total del pedido cuando se cumplen ciertas condiciones.',
    example: 'Ej.: 10% off en compras mayores a $1,000',
  },
  {
    type: 'BUY_X_GET_Y',
    icon: 'i-lucide-gift',
    title: '2x1, 3x2 o similares',
    description: 'El cliente lleva unidades extra al comprar una cantidad mínima.',
    example: 'Ej.: 2×1 en playeras',
  },
  {
    type: 'ADVANCED',
    icon: 'i-lucide-settings-2',
    title: 'Promoción avanzada',
    description: 'Compra productos de un grupo y obtené productos de otro con descuento.',
    example: 'Ej.: Compra short → Gorra gratis',
  },
]

// ── Pure helper — build create route ──────────────────────────────────────────

export function getPromotionCreateRoute(type: PromotionType): string {
  return `/pos/promociones/crear/${type}`
}
