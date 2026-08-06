import { describe, it, expect } from 'vitest'
import type {
  QuotationStatus,
  CancelReason,
  PriceSource,
  QuotationCustomer,
  QuotationItemProduct,
  QuotationItemVariant,
  QuotationItemResponseDto,
  AppliedPromotion,
  QuotationResponseDto,
  QuotationListParams,
  PaginatedQuotations,
  DiscountType,
} from '../quotation.types'

describe('quotation.types', () => {
  describe('QuotationStatus union', () => {
    it('accepts DRAFT as a valid status', () => {
      const status: QuotationStatus = 'DRAFT'
      expect(status).toBe('DRAFT')
    })

    it('accepts SENT as a valid status', () => {
      const status: QuotationStatus = 'SENT'
      expect(status).toBe('SENT')
    })

    it('accepts EXPIRED as a valid status', () => {
      const status: QuotationStatus = 'EXPIRED'
      expect(status).toBe('EXPIRED')
    })

    it('accepts CANCELLED as a valid status (TWO L\'s — distinct from sales CANCELED)', () => {
      // GUARDRAIL: Quotations use 'CANCELLED' (TWO L's). sales uses 'CANCELED'
      // (ONE L). They are distinct backend contracts.
      const status: QuotationStatus = 'CANCELLED'
      expect(status).toBe('CANCELLED')
      expect(status.length).toBe(9) // C-A-N-C-E-L-L-E-D = 9 chars, 2 L's
    })
  })

  describe('CancelReason union', () => {
    it('accepts all four backend cancel reasons', () => {
      const customerRequest: CancelReason = 'CUSTOMER_REQUEST'
      const priceObjection: CancelReason = 'PRICE_OBJECTION'
      const expired: CancelReason = 'EXPIRED'
      const other: CancelReason = 'OTHER'

      expect(customerRequest).toBe('CUSTOMER_REQUEST')
      expect(priceObjection).toBe('PRICE_OBJECTION')
      expect(expired).toBe('EXPIRED')
      expect(other).toBe('OTHER')
    })
  })

  describe('PriceSource union', () => {
    it('accepts PRICE_LIST, TIER_PRICE, CUSTOM, PROMOTION as valid sources', () => {
      const priceList: PriceSource = 'PRICE_LIST'
      const tierPrice: PriceSource = 'TIER_PRICE'
      const custom: PriceSource = 'CUSTOM'
      const promotion: PriceSource = 'PROMOTION'

      expect(priceList).toBe('PRICE_LIST')
      expect(tierPrice).toBe('TIER_PRICE')
      expect(custom).toBe('CUSTOM')
      expect(promotion).toBe('PROMOTION')
    })
  })

  describe('QuotationCustomer interface', () => {
    it('constructs with required id, firstName, and nullable lastName/email', () => {
      const customer: QuotationCustomer = {
        id: 'cust-1',
        firstName: 'María',
        lastName: 'García',
        email: 'maria@test.com',
      }

      expect(customer.id).toBe('cust-1')
      expect(customer.firstName).toBe('María')
      expect(customer.lastName).toBe('García')
      expect(customer.email).toBe('maria@test.com')
    })

    it('allows lastName = null and email = null when customer has none', () => {
      const customer: QuotationCustomer = {
        id: 'cust-2',
        firstName: 'Walk-in',
        lastName: null,
        email: null,
      }

      expect(customer.lastName).toBeNull()
      expect(customer.email).toBeNull()
    })
  })

  describe('QuotationItemProduct and QuotationItemVariant', () => {
    it('constructs a product snapshot with nullable imageUrl', () => {
      const product: QuotationItemProduct = {
        id: 'prod-1',
        name: 'Camisa',
        sku: 'CAM-001',
        imageUrl: 'https://cdn.example.com/camisa.jpg',
      }

      expect(product.imageUrl).toBe('https://cdn.example.com/camisa.jpg')

      const productNoImage: QuotationItemProduct = {
        id: 'prod-2',
        name: 'Sin imagen',
        sku: 'NO-IMG',
        imageUrl: null,
      }

      expect(productNoImage.imageUrl).toBeNull()
    })

    it('constructs a variant snapshot with required id, name, sku', () => {
      const variant: QuotationItemVariant = {
        id: 'var-1',
        name: 'Roja M',
        sku: 'CAM-R-M',
      }

      expect(variant.id).toBe('var-1')
      expect(variant.name).toBe('Roja M')
      expect(variant.sku).toBe('CAM-R-M')
    })
  })

  describe('QuotationItemResponseDto interface', () => {
    it('constructs a fully-priced item with backend fields', () => {
      const item: QuotationItemResponseDto = {
        id: 'item-1',
        productId: 'prod-1',
        variantId: null,
            productName: 'Test Product',
        variantName: null,
    quantity: 2,
        product: { id: 'prod-1', name: 'Camisa', sku: 'CAM-001', imageUrl: null },
        variant: null,
        unitPriceCents: 15000,
        priceSource: 'PRICE_LIST',
        discountType: null,
        discountValue: null,
        discountAmountCents: 0,
        discountTitle: null,
        promotionId: null,
        manuallyAdjusted: false,
        overrideNote: null,
        createdAt: '2026-08-01T20:00:00.000Z',
        updatedAt: '2026-08-01T20:00:00.000Z',
      }

      expect(item.quantity).toBe(2)
      expect(item.unitPriceCents).toBe(15000)
      expect(item.priceSource).toBe('PRICE_LIST')
      expect(item.variantId).toBeNull()
      expect(item.manuallyAdjusted).toBe(false)
    })

    it('constructs a manually-overridden item with priceSource = CUSTOM', () => {
      const item: QuotationItemResponseDto = {
        id: 'item-2',
        productId: 'prod-1',
        variantId: null,
            productName: 'Test Product',
        variantName: null,
    quantity: 1,
        product: { id: 'prod-1', name: 'Camisa', sku: 'CAM-001', imageUrl: null },
        variant: null,
        unitPriceCents: 12000,
        priceSource: 'CUSTOM',
        discountType: null,
        discountValue: null,
        discountAmountCents: 0,
        discountTitle: null,
        promotionId: null,
        manuallyAdjusted: true,
        overrideNote: null,
        createdAt: '2026-08-01T20:00:00.000Z',
        updatedAt: '2026-08-01T20:00:00.000Z',
      }

      expect(item.priceSource).toBe('CUSTOM')
      expect(item.manuallyAdjusted).toBe(true)
    })

    it('accepts all three discount types and nullable fields', () => {
      const percentage: DiscountType = 'PERCENTAGE'
      const fixed: DiscountType = 'FIXED'
      const nullable: DiscountType = null

      expect(percentage).toBe('PERCENTAGE')
      expect(fixed).toBe('FIXED')
      expect(nullable).toBeNull()
    })
  })

  describe('AppliedPromotion interface', () => {
    it('constructs an applied promotion snapshot (id is optional)', () => {
      const promo: AppliedPromotion = {
        promotionId: 'promo-1',
        title: 'Black Friday 10%',
        discountCents: 1500,
      }

      expect(promo.promotionId).toBe('promo-1')
      expect(promo.title).toBe('Black Friday 10%')
      expect(promo.discountCents).toBe(1500)
      expect(promo.id).toBeUndefined()
    })
  })

  describe('QuotationResponseDto interface', () => {
    it('constructs a complete DRAFT quotation with all backend fields', () => {
      const quotation: QuotationResponseDto = {
        id: 'qtn-1',
        customerId: 'cust-1',
        customer: {
          id: 'cust-1',
          firstName: 'María',
          lastName: 'García',
          email: 'maria@test.com',
        },
        globalPriceListId: 'pl-publico',
        priceListExplicitlySet: false,
        status: 'DRAFT',
        expiresAt: null,
        cancelReason: null,
        canceledAt: null,
        subtotalCents: 30000,
        discountCents: 0,
        totalCents: 30000,
        manuallyEnded: false,
        items: [],
        appliedPromotions: [],
        vetoedPromotionIds: [],
        optedInManualPromotionIds: [],
        effectiveStatus: 'DRAFT',
        createdAt: '2026-08-01T20:00:00.000Z',
        updatedAt: '2026-08-01T20:00:00.000Z',
      }

      expect(quotation.id).toBe('qtn-1')
      expect(quotation.status).toBe('DRAFT')
      expect(quotation.customer?.email).toBe('maria@test.com')
      expect(quotation.expiresAt).toBeNull()
      expect(quotation.subtotalCents).toBe(30000)
      expect(quotation.totalCents).toBe(30000)
      expect(quotation.items).toEqual([])
    })

    it('constructs a CANCELLED quotation with reason and canceledAt', () => {
      const quotation: QuotationResponseDto = {
        id: 'qtn-2',
        customerId: null,
        customer: null,
        globalPriceListId: null,
        priceListExplicitlySet: false,
        status: 'CANCELLED',
        expiresAt: null,
        cancelReason: 'CUSTOMER_REQUEST',
        canceledAt: '2026-08-02T10:00:00.000Z',
        subtotalCents: 5000,
        discountCents: 0,
        totalCents: 5000,
        manuallyEnded: false,
        items: [],
        appliedPromotions: [],
        vetoedPromotionIds: [],
        optedInManualPromotionIds: [],
        effectiveStatus: 'CANCELLED',
        createdAt: '2026-08-01T20:00:00.000Z',
        updatedAt: '2026-08-02T10:00:00.000Z',
      }

      expect(quotation.status).toBe('CANCELLED')
      expect(quotation.cancelReason).toBe('CUSTOMER_REQUEST')
      expect(quotation.canceledAt).toBe('2026-08-02T10:00:00.000Z')
    })
  })

  describe('QuotationListParams interface', () => {
    it('accepts a full filter set', () => {
      const params: QuotationListParams = {
        page: 2,
        limit: 20,
        status: 'DRAFT',
        customerId: 'cust-1',
        search: 'maría',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }

      expect(params.page).toBe(2)
      expect(params.limit).toBe(20)
      expect(params.status).toBe('DRAFT')
      expect(params.search).toBe('maría')
      expect(params.sortOrder).toBe('desc')
    })

    it('allows empty params (backend defaults)', () => {
      const params: QuotationListParams = {}
      expect(params.page).toBeUndefined()
      expect(params.status).toBeUndefined()
    })
  })

  describe('PaginatedQuotations interface', () => {
    it('constructs a paginated response with data + pagination', () => {
      const page: PaginatedQuotations = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }

      expect(page.data).toEqual([])
      expect(page.pagination.page).toBe(1)
      expect(page.pagination.total).toBe(0)
    })

    it('computes totalPages from total + limit', () => {
      const page: PaginatedQuotations = {
        data: [],
        pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
      }

      expect(page.pagination.totalPages).toBe(Math.ceil(page.pagination.total / page.pagination.limit))
    })
  })
})