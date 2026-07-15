import { describe, it, expect } from 'vitest'
import type {
  SaleStatus,
  SaleCurrency,
  PriceSource,
  SaleItem,
  Sale,
  AddItemPayload,
  UpdateQtyPayload,
  AvailablePriceOption,
  AvailablePricesResponse,
  OverrideItemPricePayload,
  ApplyItemDiscountPayload,
  PosCatalogPrice,
  PosCatalogStock,
  PosCatalogVariant,
  PosCatalogItem,
  PosCatalogResponse,
  PosCatalogSearchParams,
  PaymentMethod,
  CollectionPaymentMethod,
  PaymentEntry,
  ChargeSalePayload,
  ChargeSaleResponse,
  ChargeDomainErrorCode,
  DebtPaymentPayload,
  DebtPaymentResponse,
  DebtPaymentDomainErrorCode,
  ConfirmedSaleRow,
  ConfirmedSalesListResponse,
  SaleDetail,
  SaleDetailItem,
  SaleDetailPayment,
  SaleTimelineEvent,
  SaleComment,
  SaleCommentErrorCode,
  ListSalesParams,
  SalesListCounts,
  SalesListPagination,
  AppliedOrderPromotion,
  ApplicablePromotion,
  ListApplicablePromotionsResponse,
  SaleRewardKind,
} from '../sale.types'
import { SaleCommentError } from '../sale.types'

describe('sale.types', () => {
  describe('SaleStatus type', () => {
    it('should accept DRAFT as a valid status', () => {
      const status: SaleStatus = 'DRAFT'
      expect(status).toBe('DRAFT')
    })

    it('should accept CONFIRMED as a valid status', () => {
      const status: SaleStatus = 'CONFIRMED'
      expect(status).toBe('CONFIRMED')
    })
  })

  describe('charge contracts', () => {
    it('accepts supported payment methods only', () => {
      const methodA: PaymentMethod = 'cash'
      const methodB: PaymentMethod = 'card_credit'
      const methodC: PaymentMethod = 'card_debit'
      const methodD: PaymentMethod = 'transfer'
      const methodE: PaymentMethod = 'credit'

      expect(methodA).toBe('cash')
      expect(methodB).toBe('card_credit')
      expect(methodC).toBe('card_debit')
      expect(methodD).toBe('transfer')
      expect(methodE).toBe('credit')
    })

    it('builds charge payload and response contracts', () => {
      const payload: ChargeSalePayload = {
        method: 'cash',
        amountCents: 20000,
      }

      const response: ChargeSaleResponse = {
        saleId: 'sale-1',
        folio: 'A-202605-000001',
        subtotalCents: 20000,
        discountCents: 5000,
        totalCents: 15000,
        paidCents: 20000,
        debtCents: 0,
        changeDueCents: 5000,
        paymentStatus: 'PAID',
        confirmedAt: '2026-05-06T19:00:00.000Z',
      }

      expect(payload.method).toBe('cash')
      expect(response.paymentStatus).toBe('PAID')
      expect(response.changeDueCents).toBe(5000)
      expect(response.folio).toMatch(/^A-\d{6}-\d{6}$/)
      expect(response.totalCents).toBe(response.subtotalCents - response.discountCents)
    })

    it('accepts all backend payment statuses', () => {
      const paid: ChargeSaleResponse['paymentStatus'] = 'PAID'
      const partial: ChargeSaleResponse['paymentStatus'] = 'PARTIAL'
      const credit: ChargeSaleResponse['paymentStatus'] = 'CREDIT'

      expect(paid).toBe('PAID')
      expect(partial).toBe('PARTIAL')
      expect(credit).toBe('CREDIT')
    })

    it('supports known charge domain error codes', () => {
      const codeA: ChargeDomainErrorCode = 'AMBIGUOUS_PAYMENT_SHAPE'
      const codeB: ChargeDomainErrorCode = 'IDEMPOTENCY_KEY_CONFLICT'
      const codeC: ChargeDomainErrorCode = 'PRICE_OUT_OF_DATE'
      const codeD: ChargeDomainErrorCode = 'PAYMENT_EXCEEDS_DEBT'

      expect(codeA).toBe('AMBIGUOUS_PAYMENT_SHAPE')
      expect(codeB).toBe('IDEMPOTENCY_KEY_CONFLICT')
      expect(codeC).toBe('PRICE_OUT_OF_DATE')
      expect(codeD).toBe('PAYMENT_EXCEEDS_DEBT')
    })

    it('supports multi-payment payload shape', () => {
      const payload: ChargeSalePayload = {
        payments: [
          { method: 'cash', amountCents: 20000 },
          { method: 'card_debit', amountCents: 10000, reference: 'V-42' },
        ],
      }

      expect(payload.payments).toHaveLength(2)
      expect(payload.payments[1]?.reference).toBe('V-42')
    })

    it('supports debt payment contracts', () => {
      const payload: DebtPaymentPayload = {
        payments: [
          { method: 'transfer', amountCents: 5000, reference: 'TRX-100' },
          { method: 'cash', amountCents: 2000 },
        ],
      }

      const response: DebtPaymentResponse = {
        saleId: 'sale-1',
        paidCents: 45000,
        debtCents: 5000,
        totalCents: 50000,
        paymentStatus: 'PARTIAL',
        paymentIds: ['pay-1', 'pay-2'],
      }

      expect(payload.payments[0]?.method).toBe('transfer')
      expect(response.debtCents).toBe(5000)
      expect(response.paymentIds).toHaveLength(2)
    })

    it('supports collection methods without credit', () => {
      const methodA: CollectionPaymentMethod = 'cash'
      const methodB: CollectionPaymentMethod = 'card_credit'
      const methodC: CollectionPaymentMethod = 'card_debit'
      const methodD: CollectionPaymentMethod = 'transfer'

      expect(methodA).toBe('cash')
      expect(methodB).toBe('card_credit')
      expect(methodC).toBe('card_debit')
      expect(methodD).toBe('transfer')

      // @ts-expect-error credit is not part of CollectionPaymentMethod
      const invalid: CollectionPaymentMethod = 'credit'
      expect(invalid).toBe('credit')
    })

    it('supports debt payment domain error codes', () => {
      const codeA: DebtPaymentDomainErrorCode = 'SALE_NOT_FOUND'
      const codeB: DebtPaymentDomainErrorCode = 'NO_OUTSTANDING_DEBT'
      const codeC: DebtPaymentDomainErrorCode = 'PAYMENT_EXCEEDS_DEBT'
      const codeD: DebtPaymentDomainErrorCode = 'IDEMPOTENCY_KEY_CONFLICT'

      expect(codeA).toBe('SALE_NOT_FOUND')
      expect(codeB).toBe('NO_OUTSTANDING_DEBT')
      expect(codeC).toBe('PAYMENT_EXCEEDS_DEBT')
      expect(codeD).toBe('IDEMPOTENCY_KEY_CONFLICT')
    })

    it('accepts PaymentEntry list in debt payload', () => {
      const entries: PaymentEntry[] = [
        { method: 'cash', amountCents: 10000 },
        { method: 'card_debit', amountCents: 2000, reference: 'V-99' },
      ]

      const payload: DebtPaymentPayload = {
        payments: entries,
      }

      expect(payload.payments).toHaveLength(2)
    })
  })

  describe('confirmed sales list contracts', () => {
    it('builds ListSalesParams with all supported filters', () => {
      const params: ListSalesParams = {
        page: 2,
        limit: 20,
        sortBy: 'totalCents',
        sortOrder: 'asc',
        q: 'jean',
        status: ['CONFIRMED'],
        paymentStatus: ['PARTIAL'],
        deliveryStatus: ['PENDING'],
        confirmedFrom: '2026-05-01T00:00:00.000Z',
        confirmedTo: '2026-05-31T23:59:59.999Z',
        cashierUserId: 'cashier-1',
        customerId: ['customer-1'],
      }

      expect(params.sortBy).toBe('totalCents')
      expect(params.deliveryStatus).toEqual(['PENDING'])
      expect(params.q).toBe('jean')
    })

    it('builds ConfirmedSaleRow with exact backend item fields including debtCents', () => {
      const row: ConfirmedSaleRow = {
        id: 'sale-1',
        folio: 'A-202605-000012',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        deliveryStatus: 'DELIVERED',
        totalCents: 127000,
        debtCents: 0,
        confirmedAt: '2026-05-06T14:43:00.000Z',
        dueDate: null,
        customer: { id: 'customer-1', name: 'Empresa F.' },
        cashier: { id: 'cashier-1', name: 'cesar flores' },
        seller: null,
        paymentMethods: ['CASH'],
      }

      expect(row.debtCents).toBe(0)
      expect(row.customer?.name).toBe('Empresa F.')
      expect(row.seller).toBeNull()
    })

    it('builds ConfirmedSalesListResponse with pagination and counts', () => {
      const pagination: SalesListPagination = {
        page: 1,
        limit: 20,
        total: 50,
        totalPages: 3,
      }
      const counts: SalesListCounts = {
        all: 50,
        pendingPayments: 3,
        notDelivered: 1,
      }

      const response: ConfirmedSalesListResponse = {
        data: [],
        pagination,
        counts,
      }

      expect(response.pagination.totalPages).toBe(3)
      expect(response.counts.pendingPayments).toBe(3)
    })
  })

  describe('sale detail contracts', () => {
    it('accepts detail item, payment and timeline nested types', () => {
      const item: SaleDetailItem = {
        productName: 'Jean Recto',
        variantName: null,
        imageUrl: null,
        unitPriceCents: 17000,
        quantity: 1,
        discountCents: 0,
        subtotalCents: 17000,
      }

      const payment: SaleDetailPayment = {
        method: 'CASH',
        amountCents: 127000,
        tenderedCents: 127000,
        changeCents: 0,
        reference: null,
        paidAt: '2026-05-06T14:43:00.000Z',
      }

      const event: SaleTimelineEvent = {
        type: 'PAYMENT_RECEIVED',
        at: '2026-05-06T14:43:00.000Z',
        actor: { id: 'user-1', name: 'Cajero' },
        register: 'Principal',
        method: 'CASH',
        amountCents: 127000,
        reference: null,
      }

      expect(item.imageUrl).toBeNull()
      expect(payment.method).toBe('CASH')
      expect(event.type).toBe('PAYMENT_RECEIVED')
    })

    it('supports all discriminated timeline variants', () => {
      const events: SaleTimelineEvent[] = [
        {
          type: 'SALE_REGISTERED',
          at: '2026-05-06T14:40:00.000Z',
          actor: null,
          register: 'Principal',
        },
        {
          type: 'PAYMENT_RECEIVED',
          at: '2026-05-06T14:42:00.000Z',
          actor: { id: 'u-1', name: 'Ana' },
          register: 'Principal',
          method: 'CARD_DEBIT',
          amountCents: 5000,
          reference: 'TX-1',
        },
        {
          type: 'PRODUCTS_DELIVERED',
          at: '2026-05-06T14:43:00.000Z',
          actor: { id: 'u-2', name: 'Luis' },
          register: 'Principal',
        },
        {
          type: 'COMMENT',
          at: '2026-05-06T14:44:00.000Z',
          actor: { id: 'u-3', name: 'Marta' },
          commentId: 'comment-1',
          body: 'Cliente pidió factura',
        },
      ]

      expect(events).toHaveLength(4)
      expect(events[1]?.type).toBe('PAYMENT_RECEIVED')
      expect(events[3]?.type).toBe('COMMENT')
    })

    it('requires non-null actor in COMMENT events', () => {
      // @ts-expect-error COMMENT actor cannot be null
      const invalid: SaleTimelineEvent = {
        type: 'COMMENT',
        at: '2026-05-06T14:44:00.000Z',
        actor: null,
        commentId: 'comment-1',
        body: 'Cliente pidió factura',
      }

      expect(invalid).toBeDefined()
    })

    it('supports SaleComment and typed SaleCommentError', () => {
      const comment: SaleComment = {
        id: 'comment-1',
        saleId: 'sale-1',
        tenantId: 'tenant-1',
        authorUserId: 'user-1',
        body: 'ok',
        createdAt: '2026-05-06T14:44:00.000Z',
        updatedAt: '2026-05-06T14:44:00.000Z',
        deletedAt: null,
      }
      const code: SaleCommentErrorCode = 'COMMENT_AUTHOR_FORBIDDEN'
      const error = new SaleCommentError(code)

      expect(comment.id).toBe('comment-1')
      expect(error.code).toBe('COMMENT_AUTHOR_FORBIDDEN')
    })

    it('builds SaleDetail with backend fields and nullable actors', () => {
      const detail: SaleDetail = {
        id: 'sale-1',
        folio: 'A-202605-000012',
        status: 'CONFIRMED',
        channel: 'POS',
        register: 'Principal',
        confirmedAt: '2026-05-06T14:43:00.000Z',
        dueDate: null,
        subtotalCents: 127000,
        discountCents: 0,
        totalCents: 127000,
        paidCents: 127000,
        debtCents: 0,
        changeDueCents: 0,
        paymentStatus: 'PAID',
        deliveryStatus: 'DELIVERED',
        customer: null,
        cashier: { id: 'cashier-1', name: 'cesar flores' },
        seller: null,
        items: [],
        payments: [],
        timeline: [],
      }

      expect(detail.channel).toBe('POS')
      expect(detail.register).toBe('Principal')
      expect(detail.customer).toBeNull()
    })
  })

  describe('SaleCurrency type', () => {
    it('should accept MXN as a valid currency', () => {
      const currency: SaleCurrency = 'MXN'
      expect(currency).toBe('MXN')
    })
  })

  describe('PriceSource type', () => {
    it('should accept default, price_list, and custom values', () => {
      const sourceA: PriceSource = 'default'
      const sourceB: PriceSource = 'price_list'
      const sourceC: PriceSource = 'custom'

      expect(sourceA).toBe('default')
      expect(sourceB).toBe('price_list')
      expect(sourceC).toBe('custom')
    })
  })

  describe('SaleItem interface', () => {
    it('should construct a valid SaleItem with all required fields', () => {
      const item: SaleItem = {
        id: 'item-1',
        productId: 'prod-1',
        variantId: null,
        productName: 'Paracetamol 500mg',
        variantName: null,
        quantity: 2,
        unitPriceCents: 5000,
        unitPriceCurrency: 'MXN',
      }

      expect(item.id).toBe('item-1')
      expect(item.productId).toBe('prod-1')
      expect(item.variantId).toBeNull()
      expect(item.productName).toBe('Paracetamol 500mg')
      expect(item.quantity).toBe(2)
      expect(item.unitPriceCents).toBe(5000)
      expect(item.unitPriceCurrency).toBe('MXN')
    })

    it('should allow variantId and variantName for variant products', () => {
      const item: SaleItem = {
        id: 'item-2',
        productId: 'prod-2',
        variantId: 'var-1',
        productName: 'Vitamina C',
        variantName: '1000mg',
        quantity: 1,
        unitPriceCents: 12000,
        unitPriceCurrency: 'MXN',
      }

      expect(item.variantId).toBe('var-1')
      expect(item.variantName).toBe('1000mg')
    })

    it('should support optional price override metadata', () => {
      const item: SaleItem = {
        id: 'item-3',
        productId: 'prod-3',
        variantId: null,
        productName: 'Ibuprofeno',
        variantName: null,
        quantity: 1,
        unitPriceCents: 2500,
        unitPriceCurrency: 'MXN',
        priceSource: 'price_list',
        originalPriceCents: 3000,
        appliedPriceListId: 'list-1',
        customPriceCents: null,
      }

      expect(item.priceSource).toBe('price_list')
      expect(item.originalPriceCents).toBe(3000)
      expect(item.appliedPriceListId).toBe('list-1')
      expect(item.customPriceCents).toBeNull()
    })

    it('supports optional discount metadata fields', () => {
      const item: SaleItem = {
        id: 'item-discount',
        productId: 'prod-1',
        variantId: null,
        productName: 'Paracetamol 500mg',
        variantName: null,
        quantity: 1,
        unitPriceCents: 8000,
        unitPriceCurrency: 'MXN',
        discountType: 'percentage',
        discountValue: 20,
        discountAmountCents: 1600,
        discountTitle: 'Promo especial',
        prePriceCentsBeforeDiscount: 9600,
      }

      expect(item.discountType).toBe('percentage')
      expect(item.discountAmountCents).toBe(1600)
      expect(item.discountTitle).toBe('Promo especial')
      expect(item.prePriceCentsBeforeDiscount).toBe(9600)
    })
  })

  describe('Available prices contracts', () => {
    it('should construct AvailablePriceOption with backend fields', () => {
      const option: AvailablePriceOption = {
        priceListId: 'list-publico',
        priceListName: 'PUBLICO',
        priceCents: 2198,
        priceDecimal: 21.98,
        currency: 'MXN',
        isCurrent: true,
      }

      expect(option.priceListName).toBe('PUBLICO')
      expect(option.priceDecimal).toBe(21.98)
      expect(option.currency).toBe('MXN')
      expect(option.isCurrent).toBe(true)
    })

    it('should construct AvailablePricesResponse with prices array', () => {
      const response: AvailablePricesResponse = {
        saleId: 'sale-1',
        itemId: 'item-1',
        prices: [
          {
            priceListId: 'list-publico',
            priceListName: 'PUBLICO',
            priceCents: 2198,
            priceDecimal: 21.98,
            currency: 'MXN',
            isCurrent: true,
          },
        ],
      }

      expect(response.saleId).toBe('sale-1')
      expect(response.itemId).toBe('item-1')
      expect(response.prices).toHaveLength(1)
    })
  })

  describe('OverrideItemPricePayload XOR contract', () => {
    it('should allow priceListId payload', () => {
      const payload: OverrideItemPricePayload = {
        priceListId: 'list-1',
      }

      expect(payload.priceListId).toBe('list-1')
    })

    it('should allow customPriceCents payload', () => {
      const payload: OverrideItemPricePayload = {
        customPriceCents: 2198,
      }

      expect(payload.customPriceCents).toBe(2198)
    })
  })

  describe('ApplyItemDiscountPayload XOR contract', () => {
    it('allows amount discount payload', () => {
      const payload: ApplyItemDiscountPayload = {
        type: 'amount',
        amountCents: 2000,
        title: 'Descuento empleado',
      }

      expect(payload.type).toBe('amount')
      expect(payload.amountCents).toBe(2000)
      expect(payload.title).toBe('Descuento empleado')
    })

    it('allows percentage discount payload', () => {
      const payload: ApplyItemDiscountPayload = {
        type: 'percentage',
        percent: 15,
      }

      expect(payload.type).toBe('percentage')
      expect(payload.percent).toBe(15)
    })
  })

  describe('Sale interface', () => {
    it('should construct a valid Sale with empty items array', () => {
      const sale: Sale = {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [],
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:00:00Z',
      }

      expect(sale.id).toBe('sale-1')
      expect(sale.userId).toBe('user-1')
      expect(sale.status).toBe('DRAFT')
      expect(sale.items).toEqual([])
      expect(sale.createdAt).toBe('2026-04-21T10:00:00Z')
    })

    it('should allow Sale with multiple items', () => {
      const sale: Sale = {
        id: 'sale-2',
        userId: 'user-2',
        status: 'DRAFT',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            productName: 'Product A',
            variantName: null,
            quantity: 3,
            unitPriceCents: 1000,
            unitPriceCurrency: 'MXN',
          },
          {
            id: 'item-2',
            productId: 'prod-2',
            variantId: 'var-1',
            productName: 'Product B',
            variantName: 'Variant X',
            quantity: 1,
            unitPriceCents: 2500,
            unitPriceCurrency: 'MXN',
          },
        ],
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:05:00Z',
      }

      expect(sale.items).toHaveLength(2)
      expect(sale.items[0]?.productName).toBe('Product A')
      expect(sale.items[1]?.productName).toBe('Product B')
    })
  })

  describe('AddItemPayload interface', () => {
    it('should construct payload for simple product without variant', () => {
      const payload: AddItemPayload = {
        productId: 'prod-1',
        quantity: 1,
      }

      expect(payload.productId).toBe('prod-1')
      expect(payload.quantity).toBe(1)
      expect(payload.variantId).toBeUndefined()
    })

    it('should construct payload for variant product with variantId', () => {
      const payload: AddItemPayload = {
        productId: 'prod-2',
        variantId: 'var-1',
        quantity: 2,
      }

      expect(payload.productId).toBe('prod-2')
      expect(payload.variantId).toBe('var-1')
      expect(payload.quantity).toBe(2)
    })

    it('should allow explicit null variantId', () => {
      const payload: AddItemPayload = {
        productId: 'prod-3',
        variantId: null,
        quantity: 5,
      }

      expect(payload.variantId).toBeNull()
    })
  })

  describe('UpdateQtyPayload interface', () => {
    it('should construct valid quantity update payload', () => {
      const payload: UpdateQtyPayload = {
        quantity: 10,
      }

      expect(payload.quantity).toBe(10)
    })

    it('should allow quantity of 1 as minimum', () => {
      const payload: UpdateQtyPayload = {
        quantity: 1,
      }

      expect(payload.quantity).toBe(1)
    })
  })



  describe('PosCatalogPrice interface', () => {
    it('should construct valid price with cents and decimal', () => {
      const price: PosCatalogPrice = {
        priceCents: 4998,
        priceDecimal: 49.98,
        priceListName: 'PUBLICO',
      }

      expect(price.priceCents).toBe(4998)
      expect(price.priceDecimal).toBe(49.98)
      expect(price.priceListName).toBe('PUBLICO')
    })

    it('should construct price with integer decimal value', () => {
      const price: PosCatalogPrice = {
        priceCents: 29900,
        priceDecimal: 299,
        priceListName: 'PUBLICO',
      }

      expect(price.priceDecimal).toBe(299)
    })
  })

  describe('PosCatalogStock interface', () => {
    it('should construct valid stock with quantity and minQuantity', () => {
      const stock: PosCatalogStock = {
        quantity: 120,
        minQuantity: 10,
      }

      expect(stock.quantity).toBe(120)
      expect(stock.minQuantity).toBe(10)
    })

    it('should allow zero quantity for out-of-stock items', () => {
      const stock: PosCatalogStock = {
        quantity: 0,
        minQuantity: 5,
      }

      expect(stock.quantity).toBe(0)
    })
  })

  describe('PosCatalogVariant interface', () => {
    it('should construct variant with all required fields and nullables', () => {
      const variant: PosCatalogVariant = {
        id: 'var-1',
        name: 'Roja M',
        sku: 'CAM-R-M',
        barcode: '7509876543210',
        mainImage: 'https://cdn.example.com/camisa-roja.jpg',
        price: {
          priceCents: 29900,
          priceDecimal: 299,
          priceListName: 'PUBLICO',
        },
        stock: {
          quantity: 5,
          minQuantity: 2,
        },
      }

      expect(variant.id).toBe('var-1')
      expect(variant.name).toBe('Roja M')
      expect(variant.sku).toBe('CAM-R-M')
      expect(variant.price).toBeDefined()
      expect(variant.price?.priceCents).toBe(29900)
      expect(variant.stock).toBeDefined()
      expect(variant.stock?.quantity).toBe(5)
    })

    it('should allow null for sku, barcode, mainImage, price, and stock', () => {
      const variant: PosCatalogVariant = {
        id: 'var-2',
        name: 'Azul S',
        sku: null,
        barcode: null,
        mainImage: null,
        price: null,
        stock: null,
      }

      expect(variant.sku).toBeNull()
      expect(variant.barcode).toBeNull()
      expect(variant.mainImage).toBeNull()
      expect(variant.price).toBeNull()
      expect(variant.stock).toBeNull()
    })
  })

  describe('PosCatalogItem interface', () => {
    it('should construct simple product without variants', () => {
      const item: PosCatalogItem = {
        id: 'prod-1',
        name: 'Aspirina 500mg',
        sku: 'ASP-500',
        barcode: '7501234567890',
        unit: 'UNIDAD',
        hasVariants: false,
        useStock: true,
        category: { id: 'cat-1', name: 'Medicamentos' },
        brand: { id: 'brand-1', name: 'Bayer' },
        mainImage: 'https://cdn.example.com/asp-main.jpg',
        images: ['https://cdn.example.com/asp-main.jpg', 'https://cdn.example.com/asp-2.jpg'],
        price: {
          priceCents: 4998,
          priceDecimal: 49.98,
          priceListName: 'PUBLICO',
        },
        stock: {
          quantity: 120,
          minQuantity: 10,
        },
        variants: [],
      }

      expect(item.id).toBe('prod-1')
      expect(item.name).toBe('Aspirina 500mg')
      expect(item.hasVariants).toBe(false)
      expect(item.variants).toHaveLength(0)
      expect(item.price).toBeDefined()
      expect(item.stock).toBeDefined()
      expect(item.category?.name).toBe('Medicamentos')
    })

    it('should construct variant product with null price and stock', () => {
      const item: PosCatalogItem = {
        id: 'prod-2',
        name: 'Camisa',
        sku: 'CAM-001',
        barcode: null,
        unit: 'UNIDAD',
        hasVariants: true,
        useStock: true,
        category: { id: 'cat-2', name: 'Ropa' },
        brand: null,
        mainImage: 'https://cdn.example.com/camisa-main.jpg',
        images: ['https://cdn.example.com/camisa-main.jpg'],
        price: null,
        stock: null,
        variants: [
          {
            id: 'var-1',
            name: 'Roja M',
            sku: 'CAM-R-M',
            barcode: '7509876543210',
            mainImage: 'https://cdn.example.com/camisa-roja.jpg',
            price: {
              priceCents: 29900,
              priceDecimal: 299,
              priceListName: 'PUBLICO',
            },
            stock: {
              quantity: 5,
              minQuantity: 2,
            },
          },
        ],
      }

      expect(item.hasVariants).toBe(true)
      expect(item.price).toBeNull()
      expect(item.stock).toBeNull()
      expect(item.variants).toHaveLength(1)
      expect(item.variants[0]?.name).toBe('Roja M')
      expect(item.brand).toBeNull()
    })

    it('should allow null for all optional nullable fields', () => {
      const item: PosCatalogItem = {
        id: 'prod-3',
        name: 'Producto sin detalles',
        sku: null,
        barcode: null,
        unit: null,
        hasVariants: false,
        useStock: false,
        category: null,
        brand: null,
        mainImage: null,
        images: [],
        price: null,
        stock: null,
        variants: [],
      }

      expect(item.sku).toBeNull()
      expect(item.barcode).toBeNull()
      expect(item.unit).toBeNull()
      expect(item.category).toBeNull()
      expect(item.brand).toBeNull()
      expect(item.mainImage).toBeNull()
      expect(item.price).toBeNull()
      expect(item.stock).toBeNull()
    })
  })

  describe('PosCatalogResponse interface', () => {
    it('should construct response with items and pagination metadata', () => {
      const response: PosCatalogResponse = {
        items: [
          {
            id: 'prod-1',
            name: 'Test Product',
            sku: null,
            barcode: null,
            unit: null,
            hasVariants: false,
            useStock: false,
            category: null,
            brand: null,
            mainImage: null,
            images: [],
            price: null,
            stock: null,
            variants: [],
          },
        ],
        total: 42,
        limit: 25,
        offset: 0,
      }

      expect(response.items).toHaveLength(1)
      expect(response.total).toBe(42)
      expect(response.limit).toBe(25)
      expect(response.offset).toBe(0)
    })

    it('should allow empty items array when no results', () => {
      const response: PosCatalogResponse = {
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
      }

      expect(response.items).toHaveLength(0)
      expect(response.total).toBe(0)
    })
  })

  describe('PosCatalogSearchParams interface', () => {
    it('should construct search params with all fields', () => {
      const params: PosCatalogSearchParams = {
        q: 'aspirina',
        limit: 25,
        offset: 0,
        categoryId: 'cat-uuid',
        brandId: 'brand-uuid',
      }

      expect(params.q).toBe('aspirina')
      expect(params.limit).toBe(25)
      expect(params.offset).toBe(0)
      expect(params.categoryId).toBe('cat-uuid')
      expect(params.brandId).toBe('brand-uuid')
    })

    it('should allow all fields to be undefined for default behavior', () => {
      const params: PosCatalogSearchParams = {}

      expect(params.q).toBeUndefined()
      expect(params.limit).toBeUndefined()
      expect(params.offset).toBeUndefined()
      expect(params.categoryId).toBeUndefined()
      expect(params.brandId).toBeUndefined()
    })
  })

  describe('promotion contracts (promotions-in-sale)', () => {
    describe('SaleItem.promotionId optional field', () => {
      it('accepts promotionId when a per-line promo is applied', () => {
        const item: SaleItem = {
          id: 'item-promo',
          productId: 'prod-1',
          variantId: null,
          productName: 'Paracetamol 500mg',
          variantName: null,
          quantity: 1,
          unitPriceCents: 8000,
          unitPriceCurrency: 'MXN',
          promotionId: '0192b1f0-7c8d-7e0a-9d4a-abcdef012345',
        }

        expect(item.promotionId).toBe('0192b1f0-7c8d-7e0a-9d4a-abcdef012345')
      })

      it('accepts explicit promotionId = null (no promo on this line)', () => {
        const item: SaleItem = {
          id: 'item-nopromo',
          productId: 'prod-1',
          variantId: null,
          productName: 'Paracetamol 500mg',
          variantName: null,
          quantity: 1,
          unitPriceCents: 8000,
          unitPriceCurrency: 'MXN',
          promotionId: null,
        }

        expect(item.promotionId).toBeNull()
      })

      it('omits promotionId for backward compat with pre-deploy drafts', () => {
        const item: SaleItem = {
          id: 'item-legacy',
          productId: 'prod-1',
          variantId: null,
          productName: 'Paracetamol 500mg',
          variantName: null,
          quantity: 1,
          unitPriceCents: 8000,
          unitPriceCurrency: 'MXN',
        }

        expect(item.promotionId).toBeUndefined()
      })
    })

    describe('SaleItem subtotalCents + rewardKind optional fields (buy-x-get-y-promotion REQ-3)', () => {
      // BXGY draft lines receive backend NET subtotalCents and a
      // rewardKind='buy_x_get_y' tag. The frontend MUST accept both fields
      // so the draft cart row can render NET + the GRATIS reward badge.

      it('accepts subtotalCents and rewardKind = "buy_x_get_y" on a BXGY draft line', () => {
        const item: SaleItem = {
          id: 'item-bxgy',
          productId: 'prod-1',
          variantId: null,
          productName: 'Vitamina C',
          variantName: null,
          quantity: 2,
          unitPriceCents: 20000,
          unitPriceCurrency: 'MXN',
          prePriceCentsBeforeDiscount: 20000,
          discountAmountCents: 20000,
           subtotalCents: 20000,
           rewardKind: 'buy_x_get_y',
           rewardDiscountPercent: 50,
         }

         expect(item.subtotalCents).toBe(20000)
         expect(item.rewardKind).toBe('buy_x_get_y')
         expect(item.rewardDiscountPercent).toBe(50)

      })

      it('accepts rewardKind = null on a non-reward draft line', () => {
        const item: SaleItem = {
          id: 'item-regular',
          productId: 'prod-1',
          variantId: null,
          productName: 'Vitamina C',
          variantName: null,
          quantity: 1,
          unitPriceCents: 12000,
          unitPriceCurrency: 'MXN',
           subtotalCents: 12000,
           rewardKind: null,
           rewardDiscountPercent: null,
         }

         expect(item.rewardKind).toBeNull()
         expect(item.rewardDiscountPercent).toBeNull()
         expect(item.subtotalCents).toBe(12000)

      })

      it('omits subtotalCents and rewardKind for backward compat with pre-deploy draft responses', () => {
        const item: SaleItem = {
          id: 'item-legacy-draft',
          productId: 'prod-1',
          variantId: null,
          productName: 'Vitamina C',
          variantName: null,
          quantity: 1,
          unitPriceCents: 12000,
          unitPriceCurrency: 'MXN',
        }

         expect(item.subtotalCents).toBeUndefined()
         expect(item.rewardKind).toBeUndefined()
         expect(item.rewardDiscountPercent).toBeUndefined()

      })
    })

    describe('Sale totals fields (subtotalCents/discountCents/totalCents) + appliedOrderPromotion optional', () => {
      it('accepts backend-provided totals + applied order promo', () => {
        const orderPromo: AppliedOrderPromotion = {
          promotionId: '0192b1f0-7c8d-7e0a-9d4a-aaaaaaaaaaaa',
          discountType: 'percentage',
          discountValue: 10,
          discountAmountCents: 1000,
          discountTitle: 'Black Friday 10% off the cart',
        }

        const sale: Sale = {
          id: 'sale-promo',
          userId: 'user-1',
          status: 'DRAFT',
          items: [],
          createdAt: '2026-04-21T10:00:00Z',
          updatedAt: '2026-04-21T10:00:00Z',
          subtotalCents: 10000,
          discountCents: 1500,
          totalCents: 8500,
          appliedOrderPromotion: orderPromo,
        }

        expect(sale.subtotalCents).toBe(10000)
        expect(sale.discountCents).toBe(1500)
        expect(sale.totalCents).toBe(8500)
        expect(sale.appliedOrderPromotion?.discountTitle).toBe('Black Friday 10% off the cart')
        expect(sale.appliedOrderPromotion?.discountType).toBe('percentage')
      })

      it('accepts appliedOrderPromotion = null when no order promo applies', () => {
        const sale: Sale = {
          id: 'sale-no-order-promo',
          userId: 'user-1',
          status: 'DRAFT',
          items: [],
          createdAt: '2026-04-21T10:00:00Z',
          updatedAt: '2026-04-21T10:00:00Z',
          subtotalCents: 5000,
          discountCents: 0,
          totalCents: 5000,
          appliedOrderPromotion: null,
        }

        expect(sale.appliedOrderPromotion).toBeNull()
      })

      it('omits totals + appliedOrderPromotion for backward compat with pre-deploy drafts', () => {
        const sale: Sale = {
          id: 'sale-legacy',
          userId: 'user-1',
          status: 'DRAFT',
          items: [],
          createdAt: '2026-04-21T10:00:00Z',
          updatedAt: '2026-04-21T10:00:00Z',
        }

        expect(sale.subtotalCents).toBeUndefined()
        expect(sale.discountCents).toBeUndefined()
        expect(sale.totalCents).toBeUndefined()
        expect(sale.appliedOrderPromotion).toBeUndefined()
      })
    })

    describe('ApplicablePromotion type', () => {
      it('builds a PRODUCT_DISCOUNT applicable promotion', () => {
        const promo: ApplicablePromotion = {
          id: '0192b1f0-7c8d-7e0a-9d4a-product0001',
          title: '20% off Aspirina',
          type: 'PRODUCT_DISCOUNT',
        }

        expect(promo.type).toBe('PRODUCT_DISCOUNT')
        expect(promo.title).toBe('20% off Aspirina')
      })

      it('builds an ORDER_DISCOUNT applicable promotion', () => {
        const promo: ApplicablePromotion = {
          id: '0192b1f0-7c8d-7e0a-9d4a-order000001',
          title: '$50 off cart',
          type: 'ORDER_DISCOUNT',
        }

        expect(promo.type).toBe('ORDER_DISCOUNT')
      })

      // buy-x-get-y-promotion REQ-1: applicable-promotion response may include
      // BXGY promotions. The frontend type union MUST accept it.
      it('builds a BUY_X_GET_Y applicable promotion', () => {
        const promo: ApplicablePromotion = {
          id: '0192b1f0-7c8d-7e0a-9d4a-bxgy00000001',
          title: '2x1 Vitaminas',
          type: 'BUY_X_GET_Y',
        }

        expect(promo.type).toBe('BUY_X_GET_Y')
      })

      // bxgy-promotion-followups REQ-4: five optional + nullable eligibility
      // fields surface BXGY backend hints. Every existing fixture omits them,
      // so all five MUST be optional (`?`) and the numeric pair MUST accept
      // null. Required fields would break the legacy fixtures across the app.

      it('accepts all five eligibility fields with concrete values', () => {
        const promo: ApplicablePromotion = {
          id: 'promo-eligible-1',
          title: '2x1 Vitaminas',
          type: 'BUY_X_GET_Y',
          eligible: true,
          buyQuantity: 2,
          getQuantity: 1,
          unitsNeeded: 1,
          method: 'MANUAL',
        }

        expect(promo.eligible).toBe(true)
        expect(promo.buyQuantity).toBe(2)
        expect(promo.getQuantity).toBe(1)
        expect(promo.unitsNeeded).toBe(1)
        expect(promo.method).toBe('MANUAL')
      })

      it('accepts explicit null for buyQuantity and getQuantity', () => {
        const promo: ApplicablePromotion = {
          id: 'promo-eligible-2',
          title: '2x1 Vitaminas',
          type: 'BUY_X_GET_Y',
          eligible: false,
          buyQuantity: null,
          getQuantity: null,
        }

        expect(promo.buyQuantity).toBeNull()
        expect(promo.getQuantity).toBeNull()
        expect(promo.eligible).toBe(false)
      })

      it('remains omittable for legacy fixtures with all five fields absent', () => {
        // Minimal legacy fixture — keeps backward compat with pre-deploy
        // backend responses that do not yet include any eligibility metadata.
        const promo: ApplicablePromotion = {
          id: 'promo-eligible-3',
          title: '20% off Aspirina',
          type: 'PRODUCT_DISCOUNT',
        }

        expect(promo.eligible).toBeUndefined()
        expect(promo.buyQuantity).toBeUndefined()
        expect(promo.getQuantity).toBeUndefined()
        expect(promo.unitsNeeded).toBeUndefined()
        expect(promo.method).toBeUndefined()
      })
    })

    describe('SaleDetailItem.rewardKind optional field (buy-x-get-y-promotion REQ-2)', () => {
      // BXGY reward lines receive rewardKind='buy_x_get_y'. The frontend MUST
      // accept it so a confirmed-sale detail response surfaces the GRATIS badge.
      it('accepts rewardKind = "buy_x_get_y" on a confirmed-sale detail line', () => {
        const item: SaleDetailItem = {
          productName: 'Vitamina C',
          variantName: null,
          imageUrl: null,
          unitPriceCents: 12000,
          quantity: 1,
          discountCents: 0,
           subtotalCents: 0,
           rewardKind: 'buy_x_get_y',
           rewardDiscountPercent: 50,
         }

         expect(item.rewardKind).toBe('buy_x_get_y')
         expect(item.rewardDiscountPercent).toBe(50)

      })

      // null = backend explicitly says "not a reward" (regular confirmed line).
      it('accepts rewardKind = null when the line is not a reward', () => {
        const item: SaleDetailItem = {
          productName: 'Vitamina C',
          variantName: null,
          imageUrl: null,
          unitPriceCents: 12000,
          quantity: 1,
          discountCents: 0,
           subtotalCents: 12000,
           rewardKind: null,
           rewardDiscountPercent: null,
         }

         expect(item.rewardKind).toBeNull()
         expect(item.rewardDiscountPercent).toBeNull()

      })

      // Omitted = pre-deploy backend response. Must remain backward-compatible.
      it('omits rewardKind for backward compat with pre-deploy confirmed-sale responses', () => {
        const item: SaleDetailItem = {
          productName: 'Vitamina C',
          variantName: null,
          imageUrl: null,
          unitPriceCents: 12000,
          quantity: 1,
          discountCents: 0,
          subtotalCents: 12000,
        }

         expect(item.rewardKind).toBeUndefined()
         expect(item.rewardDiscountPercent).toBeUndefined()
       })
     })

     describe('SaleDetailItem.promotionId optional field (bxgy-promotion-followups REQ-7)', () => {
      // The confirmed-sale surface forwards the line's promotionId to
      // `SaleItemBadges` so the promo-name chip renders on the listed line.
      // The field MUST be optional + nullable to keep pre-deploy confirmed-sale
      // responses parsing without modification.

      it('accepts promotionId as a string when the line carries a promo', () => {
        const item: SaleDetailItem = {
          productName: 'Camisa',
          variantName: null,
          imageUrl: null,
          unitPriceCents: 25000,
          quantity: 1,
          discountCents: 5000,
          subtotalCents: 20000,
          discountTitle: 'Black Friday 2x1',
          promotionId: 'promo-abc',
        }

        expect(item.promotionId).toBe('promo-abc')
      })

      it('accepts explicit null for promotionId (no promo on this line)', () => {
        const item: SaleDetailItem = {
          productName: 'Camisa',
          variantName: null,
          imageUrl: null,
          unitPriceCents: 25000,
          quantity: 1,
          discountCents: 5000,
          subtotalCents: 20000,
          discountTitle: 'Descuento manual',
          promotionId: null,
        }

        expect(item.promotionId).toBeNull()
      })

      it('omits promotionId for legacy confirmed-sale fixtures', () => {
        const item: SaleDetailItem = {
          productName: 'Camisa',
          variantName: null,
          imageUrl: null,
          unitPriceCents: 25000,
          quantity: 1,
          discountCents: 5000,
          subtotalCents: 20000,
          discountTitle: 'Descuento manual',
        }

        expect(item.promotionId).toBeUndefined()
      })
    })

    describe('ListApplicablePromotionsResponse type', () => {
      it('builds the response shape exactly as the backend returns it', () => {
        const response: ListApplicablePromotionsResponse = {
          saleId: '0192b1f0-7c8d-7e0a-9d4a-salebbbbbbb',
          promotions: [
            {
              id: '0192b1f0-7c8d-7e0a-9d4a-pro000000001',
              title: '20% off Aspirina',
              type: 'PRODUCT_DISCOUNT',
            },
            {
              id: '0192b1f0-7c8d-7e0a-9d4a-pro000000002',
              title: '10% off cart over $500',
              type: 'ORDER_DISCOUNT',
            },
          ],
        }

        expect(response.saleId).toBe('0192b1f0-7c8d-7e0a-9d4a-salebbbbbbb')
        expect(response.promotions).toHaveLength(2)
        expect(response.promotions[0]?.type).toBe('PRODUCT_DISCOUNT')
        expect(response.promotions[1]?.type).toBe('ORDER_DISCOUNT')
      })

      it('accepts empty promotions array (no applicable promos for this draft)', () => {
        const response: ListApplicablePromotionsResponse = {
          saleId: 'sale-empty',
          promotions: [],
        }

        expect(response.promotions).toEqual([])
      })
    })

    // ── advanced-promotion-type WU-B — SaleRewardKind widening ───────────────
    //
    // The rewardKind literal widens from 'buy_x_get_y' | null to a union that
    // also accepts 'advanced' and any unknown runtime string (forward-compat for
    // new reward families the backend may add). The (string & {}) intersection
    // preserves literal autocomplete at the call site while still letting the
    // type accept arbitrary strings at runtime.
    describe('SaleRewardKind widening (advanced-promotion-type WU-B)', () => {
      it('accepts the literal "buy_x_get_y" — backwards compatible', () => {
        const kind: SaleRewardKind = 'buy_x_get_y'
        expect(kind).toBe('buy_x_get_y')
      })

      it('accepts the new literal "advanced" for ADVANCED reward lines', () => {
        const kind: SaleRewardKind = 'advanced'
        expect(kind).toBe('advanced')
      })

      it('accepts an unknown runtime string for forward-compat with future reward kinds', () => {
        const kind: SaleRewardKind = 'mystery_code' as SaleRewardKind
        // Widening-safe: must NOT collapse to "buy_x_get_y" nor "advanced".
        expect(kind).not.toBe('buy_x_get_y')
        expect(kind).not.toBe('advanced')
        expect(kind).toBe('mystery_code')
      })

      it('accepts null when the line is not a reward', () => {
        const kind: SaleRewardKind = null
        expect(kind).toBeNull()
      })

      it('SaleItem.rewardKind accepts the "advanced" literal', () => {
        const item: SaleItem = {
          id: 'item-advanced',
          productId: 'prod-1',
          variantId: null,
          productName: 'Camisa',
          variantName: null,
          quantity: 1,
          unitPriceCents: 20000,
          unitPriceCurrency: 'MXN',
          rewardKind: 'advanced',
          rewardDiscountPercent: 100,
        }

        expect(item.rewardKind).toBe('advanced')
        expect(item.rewardDiscountPercent).toBe(100)
      })

      it('SaleDetailItem.rewardKind accepts the "advanced" literal', () => {
        const item: SaleDetailItem = {
          productName: 'Camisa',
          variantName: null,
          imageUrl: null,
          unitPriceCents: 20000,
          quantity: 1,
          discountCents: 0,
          subtotalCents: 0,
          rewardKind: 'advanced',
          rewardDiscountPercent: 50,
        }

        expect(item.rewardKind).toBe('advanced')
        expect(item.rewardDiscountPercent).toBe(50)
      })
    })
  })
})
