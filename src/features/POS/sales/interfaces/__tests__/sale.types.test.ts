import { describe, it, expect } from 'vitest'
import type {
  SaleStatus,
  SaleCurrency,
  SaleItem,
  Sale,
  AddItemPayload,
  UpdateQtyPayload,
  SearchableProduct,
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

  describe('SearchableProduct interface', () => {
    it('should construct SearchableProduct for simple product without variants', () => {
      const product: SearchableProduct = {
        id: 'prod-1',
        name: 'Aspirina 100mg',
        imageUrl: 'https://example.com/image.jpg',
        priceCents: 3500,
        stock: 50,
        sellInPos: true,
        hasVariants: false,
        variantCount: 0,
      }

      expect(product.id).toBe('prod-1')
      expect(product.name).toBe('Aspirina 100mg')
      expect(product.hasVariants).toBe(false)
      expect(product.variantCount).toBe(0)
      expect(product.sellInPos).toBe(true)
    })

    it('should construct SearchableProduct for product with variants', () => {
      const product: SearchableProduct = {
        id: 'prod-2',
        name: 'Vitamina D',
        imageUrl: null,
        priceCents: 8000,
        stock: 120,
        sellInPos: true,
        hasVariants: true,
        variantCount: 3,
      }

      expect(product.hasVariants).toBe(true)
      expect(product.variantCount).toBe(3)
      expect(product.imageUrl).toBeNull()
    })
  })
})
