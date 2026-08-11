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

  it('uses Employee ladder grid classes (sm:2 lg:3 xl:5 2xl:7) on both skeleton and card states', () => {
    // Card grid ladder — same breakpoint ladder as EmployeeCardGrid /
    // SaleCardGrid / QuotationCardGrid.
    const cardsWrapper = mountComponent({ products: [product], loading: false })
    const cardsLadder = cardsWrapper.find('[data-testid="product-cards-grid"]')
    expect(cardsLadder.exists()).toBe(true)
    expect(cardsLadder.classes()).toEqual(
      expect.arrayContaining([
        'grid',
        'gap-3',
        'sm:grid-cols-2',
        'lg:grid-cols-3',
        'xl:grid-cols-5',
        '2xl:grid-cols-7',
      ]),
    )

    // Skeleton ladder mirrors the cards ladder so layout doesn't jump when
    // the cards arrive.
    const skeletonWrapper = mountComponent({ products: [], loading: true })
    const skeletonLadder = skeletonWrapper.find('[data-testid="product-cards-skeleton"]')
    expect(skeletonLadder.exists()).toBe(true)
    expect(skeletonLadder.classes()).toEqual(
      expect.arrayContaining([
        'grid',
        'gap-3',
        'sm:grid-cols-2',
        'lg:grid-cols-3',
        'xl:grid-cols-5',
        '2xl:grid-cols-7',
      ]),
    )
  })

  it('skeleton uses theme tokens (border-default + bg-elevated) for visual parity with EmployeeCardGrid', () => {
    const wrapper = mountComponent({ products: [], loading: true })

    const skeletons = wrapper.findAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
    expect(skeletons[0]!.classes()).toEqual(
      expect.arrayContaining(['border-default', 'bg-elevated']),
    )
    // Legacy coco-neutral tokens are gone.
    expect(skeletons[0]!.classes()).not.toContain('bg-coco-neutral-100')
  })
})
