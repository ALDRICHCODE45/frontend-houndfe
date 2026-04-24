import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductSearchResultItem from '../ProductSearchResultItem.vue'
import type { PosCatalogItem } from '../../interfaces/sale.types'

describe('ProductSearchResultItem.vue', () => {
  const simpleProduct: PosCatalogItem = {
    id: 'prod-1',
    name: 'Paracetamol 500mg',
    sku: 'PAR-500',
    barcode: '7501234567890',
    unit: 'UNIDAD',
    hasVariants: false,
    useStock: true,
    category: { id: 'cat-1', name: 'Medicamentos' },
    brand: { id: 'brand-1', name: 'Bayer' },
    mainImage: 'https://cdn.example.com/paracetamol.jpg',
    images: ['https://cdn.example.com/paracetamol.jpg'],
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

  const variantProduct: PosCatalogItem = {
    id: 'prod-2',
    name: 'Camisa',
    sku: 'CAM-001',
    barcode: null,
    unit: 'UNIDAD',
    hasVariants: true,
    useStock: true,
    category: { id: 'cat-2', name: 'Ropa' },
    brand: null,
    mainImage: null,
    images: [],
    price: null,
    stock: null,
    variants: [
      {
        id: 'var-1',
        name: 'Roja M',
        sku: 'CAM-R-M',
        barcode: null,
        mainImage: null,
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
      {
        id: 'var-2',
        name: 'Azul L',
        sku: 'CAM-A-L',
        barcode: null,
        mainImage: null,
        price: {
          priceCents: 29900,
          priceDecimal: 299,
          priceListName: 'PUBLICO',
        },
        stock: {
          quantity: 3,
          minQuantity: 2,
        },
      },
    ],
  }

  describe('simple product rendering', () => {
    it('should render product name', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: simpleProduct },
      })

      expect(wrapper.text()).toContain('Paracetamol 500mg')
    })

    it('should render formatted price from price.priceDecimal', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: simpleProduct },
      })

      expect(wrapper.text()).toContain('$49.98')
    })

    it('should render SKU subtitle when sku is present', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: simpleProduct },
      })

      expect(wrapper.text()).toContain('PAR-500')
    })

    it('should show stock badge with quantity when stock is not null', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: simpleProduct },
      })

      expect(wrapper.text()).toContain('120')
      expect(wrapper.text()).toContain('unidades')
    })

    it('should show mainImage as thumbnail', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: simpleProduct },
      })

      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('https://cdn.example.com/paracetamol.jpg')
    })
  })

  describe('variant product rendering', () => {
    it('should show "Ver variantes" when price is null', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: variantProduct },
      })

      expect(wrapper.text()).toContain('Ver variantes')
    })

    it('should show variant count when hasVariants is true', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: variantProduct },
      })

      expect(wrapper.text()).toContain('2 variantes')
    })

    it('should show chevron icon as affordance for variant selection', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: variantProduct },
      })

      const chevronIcon = wrapper.find('[data-testid="chevron-icon"]')
      expect(chevronIcon.exists()).toBe(true)
    })

    it('should hide stock badge when stock is null', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: variantProduct },
      })

      const stockBadge = wrapper.find('[data-testid="stock-badge"]')
      expect(stockBadge.exists()).toBe(false)
    })
  })

  describe('null mainImage handling', () => {
    it('should show placeholder icon when mainImage is null', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: variantProduct },
      })

      const placeholder = wrapper.find('[data-testid="placeholder-icon"]')
      expect(placeholder.exists()).toBe(true)
    })

    it('should not render img tag when mainImage is null', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: variantProduct },
      })

      const img = wrapper.find('img')
      expect(img.exists()).toBe(false)
    })
  })

  describe('broken image URL handling', () => {
    it('should swap to placeholder when image fails to load', async () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: {
          item: {
            ...simpleProduct,
            mainImage: 'https://broken.url/image.jpg',
          },
        },
      })

      const img = wrapper.find('img')
      await img.trigger('error')

      const placeholder = wrapper.find('[data-testid="placeholder-icon"]')
      expect(placeholder.exists()).toBe(true)
    })
  })

  describe('null stock handling', () => {
    it('should hide stock badge when stock is null', () => {
      const productNoStock: PosCatalogItem = {
        ...simpleProduct,
        useStock: false,
        stock: null,
      }

      const wrapper = mount(ProductSearchResultItem, {
        props: { item: productNoStock },
      })

      const stockBadge = wrapper.find('[data-testid="stock-badge"]')
      expect(stockBadge.exists()).toBe(false)
    })
  })

  describe('low stock warning', () => {
    it('should render stock badge with quantity for low stock', () => {
      const lowStockProduct: PosCatalogItem = {
        ...simpleProduct,
        stock: {
          quantity: 5,
          minQuantity: 10,
        },
      }

      const wrapper = mount(ProductSearchResultItem, {
        props: { item: lowStockProduct },
      })

      const badge = wrapper.find('[data-testid="stock-badge"]')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toContain('5 unidades')
    })

    it('should render stock badge with quantity for normal stock', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: simpleProduct },
      })

      const badge = wrapper.find('[data-testid="stock-badge"]')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toContain('120 unidades')
    })
  })

  describe('SKU subtitle handling', () => {
    it('should hide SKU subtitle when sku is null', () => {
      const noSkuProduct: PosCatalogItem = {
        ...simpleProduct,
        sku: null,
      }

      const wrapper = mount(ProductSearchResultItem, {
        props: { item: noSkuProduct },
      })

      // SKU subtitle should not be rendered
      const skuElement = wrapper.find('[data-testid="sku-subtitle"]')
      expect(skuElement.exists()).toBe(false)
    })
  })

  describe('interaction', () => {
    it('should emit select event when clicked', async () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: simpleProduct },
      })

      await wrapper.trigger('click')

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')?.[0]).toEqual([simpleProduct])
    })

    it('should have cursor-pointer class', () => {
      const wrapper = mount(ProductSearchResultItem, {
        props: { item: simpleProduct },
      })

      expect(wrapper.classes()).toContain('cursor-pointer')
    })
  })
})
