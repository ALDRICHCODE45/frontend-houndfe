// Centralized query keys — ALL module query keys defined here
// NEVER define query keys locally in hooks/composables

import type { PosCatalogSearchParams } from '@/features/POS/sales/interfaces/sale.types'

export const productQueryKeys = {
  paginated: () => ['products', 'paginated'] as const,
  detail: (productId: string) => ['products', 'detail', productId] as const,
  categories: () => ['products', 'categories'] as const,
  brands: () => ['products', 'brands'] as const,
  variants: (productId: string) => ['products', 'variants', productId] as const,
  lots: (productId: string) => ['products', 'lots', productId] as const,
  globalPriceLists: () => ['price-lists', 'global'] as const,
  priceLists: (productId: string) => ['products', 'price-lists', productId] as const,
  images: (productId: string) => ['products', 'images', productId] as const,
  variantPrices: (productId: string, variantId: string) =>
    ['products', 'variant-prices', productId, variantId] as const,
}

export const orderQueryKeys = {
  paginated: () => ['orders', 'paginated'] as const,
  detail: (orderId: string) => ['orders', 'detail', orderId] as const,
}

export const authQueryKeys = {
  me: () => ['auth', 'me'] as const,
}

export const adminUserQueryKeys = {
  paginated: () => ['admin', 'users', 'paginated'] as const,
  detail: (userId: string) => ['admin', 'users', 'detail', userId] as const,
}

export const adminRoleQueryKeys = {
  paginated: () => ['admin', 'roles', 'paginated'] as const,
  detail: (roleId: string) => ['admin', 'roles', 'detail', roleId] as const,
  permissions: () => ['admin', 'permissions', 'grouped'] as const,
}

export const customerQueryKeys = {
  paginated: () => ['customers', 'paginated'] as const,
  detail: (customerId: string) => ['customers', 'detail', customerId] as const,
  addresses: (customerId: string) => ['customers', 'addresses', customerId] as const,
}

export const promotionQueryKeys = {
  paginated: () => ['promotions', 'paginated'] as const,
  detail: (promotionId: string) => ['promotions', 'detail', promotionId] as const,
}

export const saleQueryKeys = {
  drafts: () => ['sales', 'drafts'] as const,
  posCatalog: (p: PosCatalogSearchParams = {}) =>
    [
      'sales',
      'pos-catalog',
      p.q ?? '',
      p.limit ?? 25,
      p.offset ?? 0,
      p.categoryId ?? null,
      p.brandId ?? null,
    ] as const,
}
