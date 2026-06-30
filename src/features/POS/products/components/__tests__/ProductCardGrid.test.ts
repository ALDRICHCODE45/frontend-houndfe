import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCardGrid from '../ProductCardGrid.vue'
import type { Product } from '../../interfaces/product.types'

const product = {
  id: 'prod-1',
  name: 'Alpha',
  sku: 'ALPHA',
  barcode: null,
  categoryId: 'cat-1',
  categoryName: 'Food',
  brandId: 'brand-1',
  brandName: 'Brand',
  priceCents: 1299,
  quantity: 5,
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
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} satisfies Product

function mountComponent(overrideProps: Record<string, unknown> = {}) {
  return mount(ProductCardGrid, {
    props: {
      products: [product],
      currencyFormatter: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
      ...overrideProps,
    },
    global: {
      stubs: {
        UIcon: { template: '<i data-testid="empty-icon" />' },
        ProductCard: {
          template: '<article data-testid="product-card" @click="$emit(\'click\', $props.product)">{{ $props.product.name }}</article>',
          props: ['product'],
        },
      },
    },
  })
}

describe('ProductCardGrid', () => {
  it('shows skeletons for initial loading without products', () => {
    const wrapper = mountComponent({ products: [], loading: true })

    expect(wrapper.findAll('.animate-pulse')).toHaveLength(8)
    expect(wrapper.find('[data-testid="product-card"]').exists()).toBe(false)
  })

  it('keeps visible cards during background fetching when products already exist', () => {
    const wrapper = mountComponent({ loading: true })

    expect(wrapper.findAll('.animate-pulse')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="product-card"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Alpha')
  })
})
