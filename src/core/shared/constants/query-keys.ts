// Centralized query keys — ALL module query keys defined here
// NEVER define query keys locally in hooks/composables

import type { PosCatalogSearchParams, ListSalesParams } from '@/features/POS/sales/interfaces/sale.types'

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

/**
 * SAT c_ClaveProdServ catalog query keys.
 * Search term lives in the key (trimmed) so TanStack auto-aborts
 * stale in-flight requests when the user keeps typing.
 * Detail keys never include tenant — backend resolves tenant from the JWT.
 */
export const satKeyQueryKeys = {
  search: (term: string) => ['sat-keys', 'search', term] as const,
  detail: (key: string) => ['sat-keys', 'detail', key] as const,
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
  confirmed: (tenantId: string, params: ListSalesParams = {}) =>
    ['sales', tenantId, 'confirmed', params] as const,
  detail: (tenantId: string, saleId: string) => ['sales', tenantId, 'detail', saleId] as const,
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

export const usersQueryKeys = {
  assignable: () => ['users', 'assignable'] as const,
}

export const adminTenantQueryKeys = {
  list: (includeInactive: boolean) => ['admin', 'tenants', { includeInactive }] as const,
  detail: (tenantId: string) => ['admin', 'tenants', 'detail', tenantId] as const,
}

export const adminTenantMembershipQueryKeys = {
  list: (tenantId: string) => ['admin', 'tenant-memberships', tenantId, 'list'] as const,
  detail: (tenantId: string, membershipId: string) =>
    ['admin', 'tenant-memberships', tenantId, 'detail', membershipId] as const,
  roles: (tenantId: string) => ['admin', 'tenant-memberships', tenantId, 'roles'] as const,
  eligible: (tenantId: string, params: { search?: string; page?: number } = {}) =>
    [
      'admin',
      'tenant-memberships',
      tenantId,
      'eligible',
      { search: params.search ?? '', page: params.page ?? 1 },
    ] as const,
}

// ─── Employees module query keys ──────────────────────────────────────────────

export const employeeQueryKeys = {
  paginated: (tenantId: string) => ['employees', tenantId, 'paginated'] as const,
  detail: (tenantId: string, id: string) => ['employees', tenantId, 'detail', id] as const,
  managerChain: (tenantId: string, id: string) =>
    ['employees', tenantId, 'manager-chain', id] as const,
  subordinates: (tenantId: string, id: string) =>
    ['employees', tenantId, 'subordinates', id] as const,
  activeForPicker: (tenantId: string, search: string) =>
    ['employees', tenantId, 'picker', search] as const,
}

export const employeeSalaryQueryKeys = {
  history: (tenantId: string, employeeId: string) =>
    ['employees', tenantId, 'salary-history', employeeId] as const,
}

export const employeeDocumentQueryKeys = {
  list: (tenantId: string, employeeId: string) =>
    ['employees', tenantId, 'documents', employeeId] as const,
  expiring: (tenantId: string, days: 30 | 60 | 90) =>
    ['employees', tenantId, 'documents-expiring', days] as const,
}

export const employeeTimeOffQueryKeys = {
  list: (tenantId: string, employeeId: string, year: number, status?: string) =>
    ['employees', tenantId, 'time-off', employeeId, { year, status }] as const,
  balance: (tenantId: string, employeeId: string, year: number) =>
    ['employees', tenantId, 'time-off-balance', employeeId, year] as const,
  /**
   * Pending approvals for the currently-logged-in user. Backend resolves the
   * Employee from the JWT, so no managerId is part of the key — the cache is
   * scoped per tenant + per user (the JWT user is implicit in the http layer).
   */
  pending: (tenantId: string) =>
    ['employees', tenantId, 'time-off-pending'] as const,
  /**
   * Admin/HR variant: pending approvals for a specific manager Employee.id.
   * Used only by the admin "by-manager" view, not by the personal dashboard.
   */
  pendingByManager: (tenantId: string, managerId: string) =>
    ['employees', tenantId, 'time-off-pending-by-manager', managerId] as const,
}

export const employeeEmergencyContactQueryKeys = {
  list: (tenantId: string, employeeId: string) =>
    ['employees', tenantId, 'emergency-contacts', employeeId] as const,
}

export const employeePositionQueryKeys = {
  history: (tenantId: string, employeeId: string) =>
    ['employees', tenantId, 'position-history', employeeId] as const,
}
