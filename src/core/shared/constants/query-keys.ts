// Centralized query keys — ALL module query keys defined here
// NEVER define query keys locally in hooks/composables

import type { PosCatalogSearchParams } from '@/features/POS/sales/interfaces/sale.types'

export const productQueryKeys = {
  paginated: (tenantId: string) => ['products', tenantId, 'paginated'] as const,
  detail: (tenantId: string, productId: string) => ['products', tenantId, 'detail', productId] as const,
  categories: (tenantId: string) => ['products', tenantId, 'categories'] as const,
  brands: (tenantId: string) => ['products', tenantId, 'brands'] as const,
  variants: (tenantId: string, productId: string) => ['products', tenantId, 'variants', productId] as const,
  lots: (tenantId: string, productId: string) => ['products', tenantId, 'lots', productId] as const,
  globalPriceLists: () => ['price-lists', 'global'] as const,
  priceLists: (tenantId: string, productId: string) => ['products', tenantId, 'price-lists', productId] as const,
  images: (tenantId: string, productId: string) => ['products', tenantId, 'images', productId] as const,
  variantPrices: (tenantId: string, productId: string, variantId: string) =>
    ['products', tenantId, 'variant-prices', productId, variantId] as const,
}

export const orderQueryKeys = {
  paginated: (tenantId: string) => ['orders', tenantId, 'paginated'] as const,
  detail: (tenantId: string, orderId: string) => ['orders', tenantId, 'detail', orderId] as const,
}

export const authQueryKeys = {
  me: () => ['auth', 'me'] as const,
}

export const adminUserQueryKeys = {
  paginated: (tenantId: string) => ['admin', 'users', tenantId, 'paginated'] as const,
  detail: (tenantId: string, userId: string) => ['admin', 'users', tenantId, 'detail', userId] as const,
}

export const adminRoleQueryKeys = {
  paginated: (tenantId: string) => ['admin', 'roles', tenantId, 'paginated'] as const,
  detail: (tenantId: string, roleId: string) => ['admin', 'roles', tenantId, 'detail', roleId] as const,
  permissions: () => ['admin', 'permissions', 'grouped'] as const,
}

export const customerQueryKeys = {
  paginated: (tenantId: string) => ['customers', tenantId, 'paginated'] as const,
  detail: (tenantId: string, customerId: string) => ['customers', tenantId, 'detail', customerId] as const,
  addresses: (tenantId: string, customerId: string) => ['customers', tenantId, 'addresses', customerId] as const,
}

export const promotionQueryKeys = {
  paginated: (tenantId: string) => ['promotions', tenantId, 'paginated'] as const,
  detail: (tenantId: string, promotionId: string) => ['promotions', tenantId, 'detail', promotionId] as const,
}

export const saleQueryKeys = {
  drafts: (tenantId: string) => ['sales', tenantId, 'drafts'] as const,
  posCatalog: (tenantId: string, p: PosCatalogSearchParams = {}) =>
    [
      'sales',
      tenantId,
      'pos-catalog',
      p.q ?? '',
      p.limit ?? 25,
      p.offset ?? 0,
      p.categoryId ?? null,
      p.brandId ?? null,
    ] as const,
}

export const adminTenantQueryKeys = {
  list: (includeInactive: boolean) => ['admin', 'tenants', { includeInactive }] as const,
  detail: (tenantId: string) => ['admin', 'tenants', 'detail', tenantId] as const,
}
