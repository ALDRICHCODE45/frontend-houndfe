import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCardGrid from '../ProductCardGrid.vue'
import type { Product } from '../../interfaces/product.types'

const product = {
  id: 'prod-1',
  name: 'Alpha',
  type: 'PRODUCT',
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

  it('uses the available-width auto-fit grid contract on both skeleton and card states', () => {
    // S2 pilot convention (design §4): the nested list width — not the
    // viewport — decides the column count. The exact sm/lg/xl/2xl ladder
    // is intentionally retired for this grid.
    const availableWidthClasses = [
      'grid',
      'gap-3',
      'w-full',
      'min-w-0',
      'max-w-full',
      'grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]',
    ]

    const cardsWrapper = mountComponent({ products: [product], loading: false })
    const cardsGrid = cardsWrapper.find('[data-testid="product-cards-grid"]')
    expect(cardsGrid.exists()).toBe(true)
    expect(cardsGrid.classes()).toEqual(expect.arrayContaining(availableWidthClasses))
    expect(cardsGrid.classes()).not.toContain('sm:grid-cols-2')
    expect(cardsGrid.classes()).not.toContain('2xl:grid-cols-7')

    // Skeleton ladder mirrors the cards contract so layout doesn't jump
    // when the cards arrive.
    const skeletonWrapper = mountComponent({ products: [], loading: true })
    const skeletonGrid = skeletonWrapper.find('[data-testid="product-cards-skeleton"]')
    expect(skeletonGrid.exists()).toBe(true)
    expect(skeletonGrid.classes()).toEqual(expect.arrayContaining(availableWidthClasses))
    expect(skeletonGrid.classes()).not.toContain('xl:grid-cols-5')
  })

  it('contains the empty state to the available width without a horizontal scroll class', () => {
    const wrapper = mountComponent({ products: [], loading: false })

    const emptyRoot = wrapper.get('[data-testid="product-cards-empty"]')
    expect(emptyRoot.classes()).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full']),
    )
    expect(emptyRoot.classes()).not.toContain('overflow-x-auto')
  })

  it('renders the custom empty message within the contained empty root', () => {
    const wrapper = mountComponent({ products: [], loading: false, empty: 'Catálogo vacío' })

    const emptyRoot = wrapper.get('[data-testid="product-cards-empty"]')
    expect(emptyRoot.text()).toContain('Catálogo vacío')
  })

  it('keeps long product names inside the available-width grid without scroll classes', () => {
    const longProduct = {
      ...product,
      name: 'Tinta para plotter de gran formato eco-solvente serie X black 1L',
    } satisfies Product
    const wrapper = mountComponent({ products: [longProduct], loading: false })

    const grid = wrapper.get('[data-testid="product-cards-grid"]')
    expect(grid.text()).toContain(longProduct.name)
    expect(grid.classes()).not.toContain('overflow-x-auto')
  })

  it('keeps visible cards contained during background fetching', () => {
    const wrapper = mountComponent({ loading: true })

    const grid = wrapper.get('[data-testid="product-cards-grid"]')
    expect(grid.classes()).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full']),
    )
    expect(grid.classes()).not.toContain('overflow-x-auto')
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
