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
} from '../sale.types'

describe('sale.types', () => {
  describe('SaleStatus type', () => {
    it('should accept DRAFT as a valid status', () => {
      const status: SaleStatus = 'DRAFT'
      expect(status).toBe('DRAFT')
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
})
