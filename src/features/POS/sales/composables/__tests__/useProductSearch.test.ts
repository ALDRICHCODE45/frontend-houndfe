import { describe, it, expect } from 'vitest'
import { mapToSearchableProduct, filterSellInPosProducts } from '../useProductSearch'
import type { Product } from '@/features/POS/products/interfaces/product.types'

describe('useProductSearch utilities', () => {
  describe('mapToSearchableProduct', () => {
    it('should map simple product without variants', () => {
      const product: Product = {
        id: 'prod-1',
        name: 'Aspirina 100mg',
        sku: 'ASP-100',
        barcode: null,
        categoryId: 'cat-1',
        categoryName: 'Medicamentos',
        brandId: 'brand-1',
        brandName: 'Brand A',
        priceCents: 5000,
        quantity: 50,
        minQuantity: 1,
        useStock: true,
        hasVariants: false,
        useLotsAndExpirations: false,
        sellInPos: true,
        includeInOnlineCatalog: true,
        requiresPrescription: false,
        chargeProductTaxes: true,
        variantStockTotal: null,
        variantCount: null,
        status: 'active',
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:00:00Z',
      }

      const result = mapToSearchableProduct(product)

      expect(result.id).toBe('prod-1')
      expect(result.name).toBe('Aspirina 100mg')
      expect(result.priceCents).toBe(5000)
      expect(result.stock).toBe(50)
      expect(result.sellInPos).toBe(true)
      expect(result.hasVariants).toBe(false)
      expect(result.variantCount).toBe(0)
      expect(result.imageUrl).toBeNull()
    })

    it('should map product with variants using variantStockTotal', () => {
      const product: Product = {
        id: 'prod-2',
        name: 'Vitamina C',
        sku: 'VIT-C',
        barcode: null,
        categoryId: 'cat-1',
        categoryName: 'Vitaminas',
        brandId: 'brand-1',
        brandName: 'Brand B',
        priceCents: 8000,
        quantity: 0,
        minQuantity: 1,
        useStock: true,
        hasVariants: true,
        useLotsAndExpirations: false,
        sellInPos: true,
        includeInOnlineCatalog: true,
        requiresPrescription: false,
        chargeProductTaxes: true,
        variantStockTotal: 120,
        variantCount: 3,
        status: 'active',
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:00:00Z',
      }

      const result = mapToSearchableProduct(product)

      expect(result.stock).toBe(120)
      expect(result.hasVariants).toBe(true)
      expect(result.variantCount).toBe(3)
    })

    it('should use quantity for stock when variantStockTotal is null despite hasVariants=true', () => {
      const product: Product = {
        id: 'prod-3',
        name: 'Product C',
        sku: 'PC',
        barcode: null,
        categoryId: 'cat-1',
        categoryName: 'Cat',
        brandId: 'brand-1',
        brandName: 'Brand',
        priceCents: 1000,
        quantity: 25,
        minQuantity: 1,
        useStock: true,
        hasVariants: true,
        useLotsAndExpirations: false,
        sellInPos: true,
        includeInOnlineCatalog: true,
        requiresPrescription: false,
        chargeProductTaxes: true,
        variantStockTotal: null,
        variantCount: 0,
        status: 'active',
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:00:00Z',
      }

      const result = mapToSearchableProduct(product)

      expect(result.stock).toBe(25)
    })

    it('should handle variantCount=null as 0', () => {
      const product: Product = {
        id: 'prod-4',
        name: 'Product D',
        sku: 'PD',
        barcode: null,
        categoryId: 'cat-1',
        categoryName: 'Cat',
        brandId: 'brand-1',
        brandName: 'Brand',
        priceCents: 2000,
        quantity: 10,
        minQuantity: 1,
        useStock: true,
        hasVariants: false,
        useLotsAndExpirations: false,
        sellInPos: true,
        includeInOnlineCatalog: true,
        requiresPrescription: false,
        chargeProductTaxes: true,
        variantStockTotal: null,
        variantCount: null,
        status: 'active',
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:00:00Z',
      }

      const result = mapToSearchableProduct(product)

      expect(result.variantCount).toBe(0)
    })
  })

  describe('filterSellInPosProducts', () => {
    it('should filter products by sellInPos=true', () => {
      const products: Product[] = [
        {
          id: 'prod-1',
          name: 'Product A',
          sku: 'PA',
          barcode: null,
          categoryId: 'cat-1',
          categoryName: 'Cat',
          brandId: 'brand-1',
          brandName: 'Brand',
          priceCents: 5000,
          quantity: 10,
          minQuantity: 1,
          useStock: true,
          hasVariants: false,
          useLotsAndExpirations: false,
          sellInPos: true,
          includeInOnlineCatalog: true,
          requiresPrescription: false,
          chargeProductTaxes: true,
          variantStockTotal: null,
          variantCount: null,
          status: 'active',
          createdAt: '2026-04-21T10:00:00Z',
          updatedAt: '2026-04-21T10:00:00Z',
        },
        {
          id: 'prod-2',
          name: 'Product B',
          sku: 'PB',
          barcode: null,
          categoryId: 'cat-1',
          categoryName: 'Cat',
          brandId: 'brand-1',
          brandName: 'Brand',
          priceCents: 3000,
          quantity: 5,
          minQuantity: 1,
          useStock: true,
          hasVariants: false,
          useLotsAndExpirations: false,
          sellInPos: false,
          includeInOnlineCatalog: true,
          requiresPrescription: false,
          chargeProductTaxes: true,
          variantStockTotal: null,
          variantCount: null,
          status: 'active',
          createdAt: '2026-04-21T10:00:00Z',
          updatedAt: '2026-04-21T10:00:00Z',
        },
      ]

      const result = filterSellInPosProducts(products)

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('prod-1')
      expect(result[0]?.sellInPos).toBe(true)
    })

    it('should return empty array when no products have sellInPos=true', () => {
      const products: Product[] = [
        {
          id: 'prod-1',
          name: 'Product A',
          sku: 'PA',
          barcode: null,
          categoryId: 'cat-1',
          categoryName: 'Cat',
          brandId: 'brand-1',
          brandName: 'Brand',
          priceCents: 5000,
          quantity: 10,
          minQuantity: 1,
          useStock: true,
          hasVariants: false,
          useLotsAndExpirations: false,
          sellInPos: false,
          includeInOnlineCatalog: true,
          requiresPrescription: false,
          chargeProductTaxes: true,
          variantStockTotal: null,
          variantCount: null,
          status: 'active',
          createdAt: '2026-04-21T10:00:00Z',
          updatedAt: '2026-04-21T10:00:00Z',
        },
      ]

      const result = filterSellInPosProducts(products)

      expect(result).toEqual([])
    })

    it('should handle empty input array', () => {
      const result = filterSellInPosProducts([])
      expect(result).toEqual([])
    })

    it('should map all filtered products to SearchableProduct shape', () => {
      const products: Product[] = [
        {
          id: 'prod-1',
          name: 'Vitamina D',
          sku: 'VIT-D',
          barcode: null,
          categoryId: 'cat-1',
          categoryName: 'Vitaminas',
          brandId: 'brand-1',
          brandName: 'Brand',
          priceCents: 12000,
          quantity: 0,
          minQuantity: 1,
          useStock: true,
          hasVariants: true,
          useLotsAndExpirations: false,
          sellInPos: true,
          includeInOnlineCatalog: true,
          requiresPrescription: false,
          chargeProductTaxes: true,
          variantStockTotal: 200,
          variantCount: 5,
          status: 'active',
          createdAt: '2026-04-21T10:00:00Z',
          updatedAt: '2026-04-21T10:00:00Z',
        },
        {
          id: 'prod-2',
          name: 'Aspirina',
          sku: 'ASP',
          barcode: null,
          categoryId: 'cat-1',
          categoryName: 'Med',
          brandId: 'brand-1',
          brandName: 'Brand',
          priceCents: 4000,
          quantity: 30,
          minQuantity: 1,
          useStock: true,
          hasVariants: false,
          useLotsAndExpirations: false,
          sellInPos: true,
          includeInOnlineCatalog: true,
          requiresPrescription: false,
          chargeProductTaxes: true,
          variantStockTotal: null,
          variantCount: null,
          status: 'active',
          createdAt: '2026-04-21T10:00:00Z',
          updatedAt: '2026-04-21T10:00:00Z',
        },
      ]

      const result = filterSellInPosProducts(products)

      expect(result).toHaveLength(2)
      expect(result[0]?.id).toBe('prod-1')
      expect(result[0]?.name).toBe('Vitamina D')
      expect(result[0]?.stock).toBe(200)
      expect(result[0]?.hasVariants).toBe(true)
      expect(result[1]?.id).toBe('prod-2')
      expect(result[1]?.stock).toBe(30)
      expect(result[1]?.hasVariants).toBe(false)
    })
  })
})
