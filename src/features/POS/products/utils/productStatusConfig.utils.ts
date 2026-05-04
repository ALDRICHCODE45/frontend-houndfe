import type { AppBadgeTone } from '@/core/shared/utils/badge.utils'

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
