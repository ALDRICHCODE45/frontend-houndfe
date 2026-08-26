import { describe, it, expect } from 'vitest'
import {
  promotionQueryKeys,
  saleQueryKeys,
  adminTenantQueryKeys,
  adminTenantMembershipQueryKeys,
  notificationConfigQueryKeys,
  quotationQueryKeys,
} from '../query-keys'

describe('promotionQueryKeys', () => {
  it('paginated() returns a tuple starting with "promotions"', () => {
    const key = promotionQueryKeys.paginated('tenant-1')
    expect(key[0]).toBe('promotions')
    expect(key[1]).toBe('tenant-1')
    expect(key[2]).toBe('paginated')
  })

  it('paginated() returns a different key each call (same reference via as const)', () => {
    const key1 = promotionQueryKeys.paginated('tenant-1')
    const key2 = promotionQueryKeys.paginated('tenant-1')
    expect(key1).toEqual(key2)
  })

  it('detail(id) includes the id in the key', () => {
    const id = 'some-uuid'
    const key = promotionQueryKeys.detail('tenant-1', id)
    expect(key).toContain(id)
    expect(key).toContain('detail')
    expect(key[0]).toBe('promotions')
    expect(key[1]).toBe('tenant-1')
  })

  it('detail with different ids produce different keys', () => {
    const key1 = promotionQueryKeys.detail('tenant-1', 'uuid-1')
    const key2 = promotionQueryKeys.detail('tenant-1', 'uuid-2')
    expect(key1).not.toEqual(key2)
  })

  it('includes tenant id so different tenants use isolated cache keys', () => {
    const key1 = promotionQueryKeys.paginated('tenant-1')
    const key2 = promotionQueryKeys.paginated('tenant-2')
    expect(key1).not.toEqual(key2)
  })

  describe('available', () => {
    it('returns the exact tuple shape ["promotions", tenantId, "available", method]', () => {
      const key = promotionQueryKeys.available('tenant-abc', 'MANUAL')
      expect(key).toEqual(['promotions', 'tenant-abc', 'available', 'MANUAL'])
    })

    it('produces different keys for MANUAL vs AUTOMATIC within the same tenant', () => {
      const manual = promotionQueryKeys.available('tenant-1', 'MANUAL')
      const automatic = promotionQueryKeys.available('tenant-1', 'AUTOMATIC')
      expect(manual).not.toEqual(automatic)
    })

    it('produces different keys for different tenants so cache is isolated', () => {
      const key1 = promotionQueryKeys.available('tenant-1', 'MANUAL')
      const key2 = promotionQueryKeys.available('tenant-2', 'MANUAL')
      expect(key1).not.toEqual(key2)
    })

    it('returns the same key tuple on repeated calls with identical args', () => {
      const key1 = promotionQueryKeys.available('tenant-1', 'MANUAL')
      const key2 = promotionQueryKeys.available('tenant-1', 'MANUAL')
      expect(key1).toEqual(key2)
    })

    it('invalidating by tenantId prefix catches available keys (TanStack pattern)', () => {
      const key = promotionQueryKeys.available('tenant-1', 'AUTOMATIC')
      const prefix = ['promotions', 'tenant-1']
      expect(key.slice(0, 2)).toEqual(prefix)
    })
  })
})

describe('saleQueryKeys', () => {
  it('drafts() returns a tuple starting with "sales"', () => {
    const key = saleQueryKeys.drafts('tenant-1')
    expect(key[0]).toBe('sales')
    expect(key[1]).toBe('tenant-1')
    expect(key[2]).toBe('drafts')
  })

  it('drafts() returns same structure on multiple calls', () => {
    const key1 = saleQueryKeys.drafts('tenant-1')
    const key2 = saleQueryKeys.drafts('tenant-1')
    expect(key1).toEqual(key2)
  })

  describe('posCatalog', () => {
    it('should return tuple with sales and pos-catalog prefix', () => {
      const key = saleQueryKeys.posCatalog('tenant-1', {})
      expect(key[0]).toBe('sales')
      expect(key[1]).toBe('tenant-1')
      expect(key[2]).toBe('pos-catalog')
    })

    it('should include all params with defaults when empty object provided', () => {
      const key = saleQueryKeys.posCatalog('tenant-1', {})
      expect(key).toEqual(['sales', 'tenant-1', 'pos-catalog', '', 25, 0, null, null])
    })

    it('should include query string in key', () => {
      const key = saleQueryKeys.posCatalog('tenant-1', { q: 'aspirina' })
      expect(key[3]).toBe('aspirina')
    })

    it('should include custom limit and offset', () => {
      const key = saleQueryKeys.posCatalog('tenant-1', { limit: 50, offset: 25 })
      expect(key[4]).toBe(50)
      expect(key[5]).toBe(25)
    })

    it('should include categoryId and brandId when provided', () => {
      const key = saleQueryKeys.posCatalog('tenant-1', {
        categoryId: 'cat-uuid',
        brandId: 'brand-uuid',
      })
      expect(key[6]).toBe('cat-uuid')
      expect(key[7]).toBe('brand-uuid')
    })

    it('should produce different keys for different queries', () => {
      const key1 = saleQueryKeys.posCatalog('tenant-1', { q: 'aspirina' })
      const key2 = saleQueryKeys.posCatalog('tenant-1', { q: 'paracetamol' })
      expect(key1).not.toEqual(key2)
    })

    it('should produce different keys for different pagination', () => {
      const key1 = saleQueryKeys.posCatalog('tenant-1', { offset: 0 })
      const key2 = saleQueryKeys.posCatalog('tenant-1', { offset: 25 })
      expect(key1).not.toEqual(key2)
    })

    it('should produce different keys for different tenants', () => {
      const key1 = saleQueryKeys.posCatalog('tenant-1', { q: 'aspirina' })
      const key2 = saleQueryKeys.posCatalog('tenant-2', { q: 'aspirina' })
      expect(key1).not.toEqual(key2)
    })
  })

  describe('confirmed', () => {
    it('returns a stable key tuple for confirmed sales list params', () => {
      const key = saleQueryKeys.confirmed('tenant-1', {
        page: 1,
        limit: 20,
        sortBy: 'confirmedAt',
        sortOrder: 'desc',
        q: 'jean',
      })

      expect(key[0]).toBe('sales')
      expect(key[1]).toBe('tenant-1')
      expect(key[2]).toBe('confirmed')
      expect(key[3]).toEqual({
        page: 1,
        limit: 20,
        sortBy: 'confirmedAt',
        sortOrder: 'desc',
        q: 'jean',
      })
    })

    it('uses defaults when params are omitted', () => {
      const key = saleQueryKeys.confirmed('tenant-1')
      expect(key[3]).toEqual({})
    })
  })

  describe('detail', () => {
    it('returns a detail key tuple including sale id', () => {
      const key = saleQueryKeys.detail('tenant-1', 'sale-123')
      expect(key).toEqual(['sales', 'tenant-1', 'detail', 'sale-123'])
    })

    it('produces different keys for different sale ids', () => {
      const key1 = saleQueryKeys.detail('tenant-1', 'sale-123')
      const key2 = saleQueryKeys.detail('tenant-1', 'sale-999')
      expect(key1).not.toEqual(key2)
    })
  })
})

describe('adminTenantQueryKeys', () => {
  describe('list', () => {
    it('returns tuple starting with admin and tenants', () => {
      const key = adminTenantQueryKeys.list(false)
      expect(key[0]).toBe('admin')
      expect(key[1]).toBe('tenants')
    })

    it('includes includeInactive flag in key structure', () => {
      const key = adminTenantQueryKeys.list(true)
      expect(key).toEqual(['admin', 'tenants', { includeInactive: true }])
    })

    it('produces different keys for different includeInactive values', () => {
      const key1 = adminTenantQueryKeys.list(true)
      const key2 = adminTenantQueryKeys.list(false)
      expect(key1).not.toEqual(key2)
    })

    it('does NOT include tenantId in key (tenants are global)', () => {
      const key = adminTenantQueryKeys.list(false)
      // Key should be ['admin', 'tenants', { includeInactive: false }]
      // NOT ['admin', 'tenants', 'some-tenant-id', ...]
      expect(key).toEqual(['admin', 'tenants', { includeInactive: false }])
    })
  })

  describe('detail', () => {
    it('returns tuple with admin, tenants, detail, and tenantId', () => {
      const key = adminTenantQueryKeys.detail('tenant-uuid-1')
      expect(key[0]).toBe('admin')
      expect(key[1]).toBe('tenants')
      expect(key[2]).toBe('detail')
      expect(key[3]).toBe('tenant-uuid-1')
    })

    it('produces different keys for different tenant IDs', () => {
      const key1 = adminTenantQueryKeys.detail('tenant-1')
      const key2 = adminTenantQueryKeys.detail('tenant-2')
      expect(key1).not.toEqual(key2)
    })

    it('does NOT prefix with current tenantId (tenants are global resources)', () => {
      const key = adminTenantQueryKeys.detail('target-tenant')
      // Should be ['admin', 'tenants', 'detail', 'target-tenant']
      // NOT ['admin', 'tenants', 'current-tenant', 'detail', 'target-tenant']
      expect(key).toEqual(['admin', 'tenants', 'detail', 'target-tenant'])
    })
  })
})

describe('adminTenantMembershipQueryKeys', () => {
  describe('list', () => {
    it('returns tuple starting with admin, tenant-memberships, and tenantId', () => {
      const key = adminTenantMembershipQueryKeys.list('tenant-1')
      expect(key[0]).toBe('admin')
      expect(key[1]).toBe('tenant-memberships')
      expect(key[2]).toBe('tenant-1')
      expect(key[3]).toBe('list')
    })

    it('produces different keys for different tenant IDs', () => {
      const key1 = adminTenantMembershipQueryKeys.list('tenant-1')
      const key2 = adminTenantMembershipQueryKeys.list('tenant-2')
      expect(key1).not.toEqual(key2)
    })

    it('returns same structure on multiple calls with same tenant', () => {
      const key1 = adminTenantMembershipQueryKeys.list('tenant-1')
      const key2 = adminTenantMembershipQueryKeys.list('tenant-1')
      expect(key1).toEqual(key2)
    })

    it('invalidating by tenantId prefix works correctly', () => {
      const key = adminTenantMembershipQueryKeys.list('tenant-1')
      const prefix = ['admin', 'tenant-memberships', 'tenant-1']
      // Verify key starts with prefix (TanStack Query invalidation pattern)
      expect(key.slice(0, 3)).toEqual(prefix)
    })
  })

  describe('detail', () => {
    it('returns tuple with admin, tenant-memberships, tenantId, detail, and membershipId', () => {
      const key = adminTenantMembershipQueryKeys.detail('tenant-1', 'membership-uuid')
      expect(key[0]).toBe('admin')
      expect(key[1]).toBe('tenant-memberships')
      expect(key[2]).toBe('tenant-1')
      expect(key[3]).toBe('detail')
      expect(key[4]).toBe('membership-uuid')
    })

    it('produces different keys for different membership IDs within same tenant', () => {
      const key1 = adminTenantMembershipQueryKeys.detail('tenant-1', 'membership-1')
      const key2 = adminTenantMembershipQueryKeys.detail('tenant-1', 'membership-2')
      expect(key1).not.toEqual(key2)
    })

    it('produces different keys for different tenants with same membershipId', () => {
      const key1 = adminTenantMembershipQueryKeys.detail('tenant-1', 'membership-1')
      const key2 = adminTenantMembershipQueryKeys.detail('tenant-2', 'membership-1')
      expect(key1).not.toEqual(key2)
    })

    it('invalidating by tenantId prefix affects detail keys', () => {
      const key = adminTenantMembershipQueryKeys.detail('tenant-1', 'membership-1')
      const prefix = ['admin', 'tenant-memberships', 'tenant-1']
      expect(key.slice(0, 3)).toEqual(prefix)
    })
  })
})

describe('notificationConfigQueryKeys', () => {
  describe('config', () => {
    it('returns a tuple starting with "notification-config" and including tenantId', () => {
      const key = notificationConfigQueryKeys.config('tenant-1')
      expect(key[0]).toBe('notification-config')
      expect(key[1]).toBe('tenant-1')
    })

    it('returns the same key tuple on repeated calls with same tenantId', () => {
      const key1 = notificationConfigQueryKeys.config('tenant-1')
      const key2 = notificationConfigQueryKeys.config('tenant-1')
      expect(key1).toEqual(key2)
    })

    it('produces different keys for different tenants so cache is isolated', () => {
      const key1 = notificationConfigQueryKeys.config('tenant-1')
      const key2 = notificationConfigQueryKeys.config('tenant-2')
      expect(key1).not.toEqual(key2)
    })

    it('exact tuple shape includes tenantId as second segment', () => {
      const key = notificationConfigQueryKeys.config('tenant-abc')
      expect(key).toEqual(['notification-config', 'tenant-abc'])
    })
  })
})

describe('saleQueryKeys.applicablePromotions (promotions-in-sale A.3)', () => {
  it('returns a tuple starting with "sales" then tenantId then "applicable-promotions" then draftId', () => {
    const key = saleQueryKeys.applicablePromotions('tenant-1', 'sale-abc')
    expect(key[0]).toBe('sales')
    expect(key[1]).toBe('tenant-1')
    expect(key[2]).toBe('applicable-promotions')
    expect(key[3]).toBe('sale-abc')
    expect(key).toHaveLength(4)
  })

  it('returns the same key tuple on repeated calls with same tenantId + draftId', () => {
    const key1 = saleQueryKeys.applicablePromotions('tenant-1', 'sale-abc')
    const key2 = saleQueryKeys.applicablePromotions('tenant-1', 'sale-abc')
    expect(key1).toEqual(key2)
  })

  it('produces different keys for different draftIds within the same tenant', () => {
    const key1 = saleQueryKeys.applicablePromotions('tenant-1', 'sale-abc')
    const key2 = saleQueryKeys.applicablePromotions('tenant-1', 'sale-xyz')
    expect(key1).not.toEqual(key2)
  })

  it('produces different keys for different tenants so cache is isolated', () => {
    const key1 = saleQueryKeys.applicablePromotions('tenant-1', 'sale-abc')
    const key2 = saleQueryKeys.applicablePromotions('tenant-2', 'sale-abc')
    expect(key1).not.toEqual(key2)
  })

  it('exact tuple shape deep-equals ["sales", tenantId, "applicable-promotions", draftId]', () => {
    const key = saleQueryKeys.applicablePromotions('tenant-abc', 'sale-123')
    expect(key).toEqual(['sales', 'tenant-abc', 'applicable-promotions', 'sale-123'])
  })

  it('invalidating by tenantId prefix catches applicablePromotions keys (TanStack pattern)', () => {
    const key = saleQueryKeys.applicablePromotions('tenant-1', 'sale-abc')
    const prefix = ['sales', 'tenant-1']
    expect(key.slice(0, 2)).toEqual(prefix)
  })
})

// ── sdd-quotations-crud S1: quotationQueryKeys (REQ-QTN-015) ─────────────────
//
// Cache contract: `list(tenantId, params)` for the paginated list and
// `detail(tenantId, id)` for the single quotation. Both are tenant-scoped so
// switching tenants does not bleed the cache. params is the QuotationListParams
// object (filter + pagination snapshot), so two calls with the same params
// return the same key tuple.

describe('quotationQueryKeys (sdd-quotations-crud S1, REQ-QTN-015)', () => {
  describe('list', () => {
    it('returns a tuple starting with "quotations" then tenantId then "list"', () => {
      const key = quotationQueryKeys.list('tenant-1')
      expect(key[0]).toBe('quotations')
      expect(key[1]).toBe('tenant-1')
      expect(key[2]).toBe('list')
    })

    it('uses empty params by default so the key stays stable for unfiltered lists', () => {
      const key = quotationQueryKeys.list('tenant-1')
      expect(key[3]).toEqual({})
    })

    it('encodes the filter snapshot as the last segment so distinct filter sets produce distinct keys', () => {
      const paramsA = { page: 1, status: 'DRAFT' as const }
      const paramsB = { page: 2, status: 'DRAFT' as const }

      const keyA = quotationQueryKeys.list('tenant-1', paramsA)
      const keyB = quotationQueryKeys.list('tenant-1', paramsB)

      expect(keyA[3]).toEqual(paramsA)
      expect(keyB[3]).toEqual(paramsB)
      expect(keyA).not.toEqual(keyB)
    })

    it('produces different keys for different tenants (cache isolation)', () => {
      const keyA = quotationQueryKeys.list('tenant-1')
      const keyB = quotationQueryKeys.list('tenant-2')

      expect(keyA).not.toEqual(keyB)
    })

    it('returns the same key tuple on repeated calls with identical args', () => {
      const params = { page: 1, limit: 20 }
      const key1 = quotationQueryKeys.list('tenant-1', params)
      const key2 = quotationQueryKeys.list('tenant-1', params)

      expect(key1).toEqual(key2)
    })

    it('invalidating by tenantId prefix catches list keys (TanStack pattern)', () => {
      const key = quotationQueryKeys.list('tenant-1', { page: 1 })
      const prefix = ['quotations', 'tenant-1']
      expect(key.slice(0, 2)).toEqual(prefix)
    })
  })

  describe('detail', () => {
    it('returns the exact tuple shape ["quotations", tenantId, "detail", id]', () => {
      const key = quotationQueryKeys.detail('tenant-abc', 'qtn-1')

      expect(key).toEqual(['quotations', 'tenant-abc', 'detail', 'qtn-1'])
    })

    it('produces different keys for different quotation ids within the same tenant', () => {
      const keyA = quotationQueryKeys.detail('tenant-1', 'qtn-1')
      const keyB = quotationQueryKeys.detail('tenant-1', 'qtn-2')

      expect(keyA).not.toEqual(keyB)
    })

    it('produces different keys for different tenants with the same quotation id', () => {
      const keyA = quotationQueryKeys.detail('tenant-1', 'qtn-1')
      const keyB = quotationQueryKeys.detail('tenant-2', 'qtn-1')

      expect(keyA).not.toEqual(keyB)
    })

    it('returns the same key tuple on repeated calls with identical args', () => {
      const key1 = quotationQueryKeys.detail('tenant-1', 'qtn-1')
      const key2 = quotationQueryKeys.detail('tenant-1', 'qtn-1')

      expect(key1).toEqual(key2)
    })

    it('invalidating by tenantId prefix catches detail keys (TanStack pattern)', () => {
      const key = quotationQueryKeys.detail('tenant-1', 'qtn-1')
      const prefix = ['quotations', 'tenant-1']
      expect(key.slice(0, 2)).toEqual(prefix)
    })
  })
})

// ── sdd payment-details-admin S1: adminPaymentDetailQueryKeys (REQ-PD-007) ──────
//
// Cache contract: tenant-scoped list + detail keys. Mutations invalidate the
// list base prefix so all page/filter/sort cache slots refetch (TanStack
// prefix-matches array keys).

import { adminPaymentDetailQueryKeys } from '../query-keys'

describe('adminPaymentDetailQueryKeys (sdd payment-details-admin S1, REQ-PD-007)', () => {
  describe('list', () => {
    it('returns a tuple starting with "admin" then "payment-details" then tenantId then "list"', () => {
      const key = adminPaymentDetailQueryKeys.list('tenant-1')
      expect(key[0]).toBe('admin')
      expect(key[1]).toBe('payment-details')
      expect(key[2]).toBe('tenant-1')
      expect(key[3]).toBe('list')
    })

    it('returns the same key tuple on repeated calls with the same tenantId', () => {
      const key1 = adminPaymentDetailQueryKeys.list('tenant-1')
      const key2 = adminPaymentDetailQueryKeys.list('tenant-1')
      expect(key1).toEqual(key2)
    })

    it('produces different keys for different tenants (cache isolation)', () => {
      const key1 = adminPaymentDetailQueryKeys.list('tenant-1')
      const key2 = adminPaymentDetailQueryKeys.list('tenant-2')
      expect(key1).not.toEqual(key2)
    })

    it('exact tuple shape: ["admin", "payment-details", tenantId, "list"]', () => {
      const key = adminPaymentDetailQueryKeys.list('tenant-abc')
      expect(key).toEqual(['admin', 'payment-details', 'tenant-abc', 'list'])
    })

    it('list base prefix can invalidate all paginated cache slots (TanStack pattern)', () => {
      const key = adminPaymentDetailQueryKeys.list('tenant-1')
      // Mutations call: invalidateQueries({ queryKey: adminPaymentDetailQueryKeys.list(tenantId) })
      // which prefix-matches all [...list, { ... }] variants in the cache.
      expect(key.slice(0, 4)).toEqual(['admin', 'payment-details', 'tenant-1', 'list'])
    })
  })

  describe('detail', () => {
    it('returns the exact tuple shape ["admin", "payment-details", tenantId, "detail", id]', () => {
      const key = adminPaymentDetailQueryKeys.detail('tenant-abc', 'pd-1')
      expect(key).toEqual(['admin', 'payment-details', 'tenant-abc', 'detail', 'pd-1'])
    })

    it('produces different keys for different payment-detail ids within the same tenant', () => {
      const key1 = adminPaymentDetailQueryKeys.detail('tenant-1', 'pd-1')
      const key2 = adminPaymentDetailQueryKeys.detail('tenant-1', 'pd-2')
      expect(key1).not.toEqual(key2)
    })

    it('produces different keys for different tenants with the same id', () => {
      const key1 = adminPaymentDetailQueryKeys.detail('tenant-1', 'pd-1')
      const key2 = adminPaymentDetailQueryKeys.detail('tenant-2', 'pd-1')
      expect(key1).not.toEqual(key2)
    })

    it('returns the same key tuple on repeated calls with identical args', () => {
      const key1 = adminPaymentDetailQueryKeys.detail('tenant-1', 'pd-1')
      const key2 = adminPaymentDetailQueryKeys.detail('tenant-1', 'pd-1')
      expect(key1).toEqual(key2)
    })

    it('list base prefix catches detail keys via TanStack prefix matching', () => {
      // prefix match: ['admin','payment-details','tenant-1',...] — catches both list and detail.
      const detailKey = adminPaymentDetailQueryKeys.detail('tenant-1', 'pd-1')
      const listPrefix = ['admin', 'payment-details', 'tenant-1']
      expect(detailKey.slice(0, 3)).toEqual(listPrefix)
    })
  })
})
