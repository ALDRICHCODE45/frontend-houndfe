export const productStatusConfig = {
  active: { color: 'success' as const, label: 'Activo' },
  inactive: { color: 'neutral' as const, label: 'Inactivo' },
  out_of_stock: { color: 'error' as const, label: 'Sin Stock' },
} as const

export const getStockColor = (stock: number, minQuantity = 10) => {
  if (stock === 0) return 'error' as const
  if (stock <= minQuantity) return 'warning' as const
  return 'success' as const
}
