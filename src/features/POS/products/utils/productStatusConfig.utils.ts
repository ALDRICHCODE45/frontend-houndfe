import type { Product } from '../interfaces/product.types'

export const productStatusConfig = {
  active: { color: 'success' as const, label: 'Activo' },
  inactive: { color: 'neutral' as const, label: 'Inactivo' },
  out_of_stock: { color: 'error' as const, label: 'Sin Stock' },
} as const

export const getStockColor = (stock: number) => {
  if (stock === 0) return 'error' as const
  if (stock < 10) return 'warning' as const
  return 'success' as const
}

interface ProductRowPermissions {
  canUpdate: boolean
  canDelete: boolean
}

export function getProductRowItems(product: Product, permissions: ProductRowPermissions) {
  const mainActions = [
    ...(permissions.canUpdate
      ? [{ label: 'Editar', onSelect: () => console.log('edit', product.id) }]
      : []),
  ]

  const destructiveActions = [
    ...(permissions.canDelete
      ? [
          {
            label: 'Eliminar',
            color: 'error' as const,
            onSelect: () => console.log('delete', product.id),
          },
        ]
      : []),
  ]

  return [mainActions, destructiveActions].filter((section) => section.length > 0)
}
