import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { PosCatalogItem, PosProductDetail } from '../../interfaces/sale.types'
import ProductSearchResultItem from '../ProductSearchResultItem.vue'
import ProductDetailModal from '../ProductDetailModal.vue'
import VariantPickerModal from '../VariantPickerModal.vue'

/*
 * Restock backorder S6/S11: the POS catalog `stock` object may carry
 * stockOnHand / reservedForBackorders / availableToSell. «Disponible 3 · Apartado 2» only when
 * reserved > 0; with reserved 0 or no fields the stock UI is exactly what it was.
 */

const { getProductDetail } = vi.hoisted(() => ({ getProductDetail: vi.fn() }))
vi.mock('../../api/sale.api', () => ({ saleApi: { getProductDetail } }))

const wrappers: VueWrapper[] = []
const track = <T extends VueWrapper>(wrapper: T) => {
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})
beforeEach(() => getProductDetail.mockReset())

const reservedStock = { quantity: 3, minQuantity: 1, stockOnHand: 5, reservedForBackorders: 2, availableToSell: 3 }

const simple: PosCatalogItem = {
  id: 'prod-1',
  name: 'Alimento Gato Senior',
  description: null,
  sku: 'GAT-1',
  barcode: null,
  unit: null,
  hasVariants: false,
  useStock: true,
  category: null,
  brand: null,
  mainImage: null,
  images: [],
  price: { priceCents: 45000, priceDecimal: 450, priceListName: 'PUBLICO' },
  stock: { quantity: 24, minQuantity: 5 },
  variants: [],
}

const variantOf = (id: string, stock: PosCatalogItem['stock']) => ({
  id,
  name: `Presentación ${id}`,
  sku: null,
  barcode: null,
  mainImage: null,
  price: { priceCents: 1000, priceDecimal: 10, priceListName: 'PUBLICO' },
  stock,
})

const cardStubs = { UIcon: { template: '<i />' } }
const mountCard = (item: PosCatalogItem, composition = true) =>
  track(
    mount(ProductSearchResultItem, {
      props: composition ? { item, composition: true } : { item },
      global: { stubs: cardStubs },
    }),
  )

describe('catalog card (composition) — reserved stock', () => {
  it('reads «Disponible 3 · Apartado 2» in the stock line, in the warning state, never «sin stock»', () => {
    const wrapper = mountCard({ ...simple, stock: reservedStock })
    const line = wrapper.get('[data-testid="card-stock-line"]')
    expect(line.text()).toBe('Disponible 3 · Apartado 2')
    expect(line.attributes('data-sales-pos-stock')).toBe('reserved')
    expect(line.text()).not.toMatch(/sin stock|agotado/i)
  })

  it('keeps showing the split when nothing is sellable now (0 available, 2 reserved)', () => {
    const wrapper = mountCard({
      ...simple,
      stock: { quantity: 0, minQuantity: 1, stockOnHand: 2, reservedForBackorders: 2, availableToSell: 0 },
    })
    expect(wrapper.get('[data-testid="card-stock-line"]').text()).toBe('Disponible 0 · Apartado 2')
  })

  it('adds the reserved units of every variant for a product whose stock lives in its variants', () => {
    const wrapper = mountCard({
      ...simple,
      hasVariants: true,
      price: null,
      stock: null,
      variants: [
        variantOf('a', { quantity: 4, minQuantity: 1, reservedForBackorders: 2 }),
        variantOf('b', { quantity: 6, minQuantity: 1, reservedForBackorders: 1 }),
      ],
    })
    expect(wrapper.get('[data-testid="card-stock-line"]').text()).toBe('Disponible 10 · Apartado 3')
  })

  it.each([{ reservedForBackorders: 0 }, {}])('is unchanged with %j', (extra) => {
    const wrapper = mountCard({ ...simple, stock: { quantity: 24, minQuantity: 5, ...extra } })
    const line = wrapper.get('[data-testid="card-stock-line"]')
    expect(line.text()).toBe('24 disponibles')
    expect(line.attributes('data-sales-pos-stock')).toBe('ok')
  })
})

describe('catalog card (legacy, quotations) — reserved stock', () => {
  it('shows the split under the price and keeps the #N badge', () => {
    const wrapper = mountCard({ ...simple, stock: reservedStock }, false)
    expect(wrapper.get('[data-testid="stock-badge"]').text()).toBe('#3')
    expect(wrapper.get('[data-testid="reserved-stock"]').text()).toBe('Disponible 3 · Apartado 2')
  })

  it('shows nothing extra with reserved 0', () => {
    const wrapper = mountCard({ ...simple, stock: { quantity: 3, minQuantity: 1, reservedForBackorders: 0 } }, false)
    expect(wrapper.find('[data-testid="reserved-stock"]').exists()).toBe(false)
  })
})

describe('variant picker — reserved stock', () => {
  const mountPicker = () => {
    const wrapper = mount(VariantPickerModal, {
      props: {
        open: true,
        productId: 'p',
        productName: 'Camisa',
        variants: [
          variantOf('a', { quantity: 4, minQuantity: 1, stockOnHand: 6, reservedForBackorders: 2, availableToSell: 4 }),
          variantOf('b', { quantity: 9, minQuantity: 1 }),
        ],
      },
      attachTo: document.body,
    })
    track(wrapper)
    return wrapper
  }

  it('labels the badge «Disponible 4 · Apartado 2» in warning tone only for the reserved variant', async () => {
    mountPicker()
    await flushPromises()
    const a = document.body.querySelector('[data-testid="variant-row-a"] .hf-status-badge')!
    const b = document.body.querySelector('[data-testid="variant-row-b"] .hf-status-badge')!
    expect(a.textContent?.trim()).toBe('Disponible 4 · Apartado 2')
    expect(a.getAttribute('data-tone')).toBe('warning')
    expect(b.textContent?.trim()).toBe('9 unidades')
  })
})

describe('product detail — reserved stock', () => {
  const modalStub = {
    props: ['open', 'title', 'ui', 'content'],
    template: '<div v-if="open" data-testid="modal"><h2>{{ title }}</h2><slot name="body" /><slot name="footer" /></div>',
  }
  const stubs = {
    UModal: modalStub,
    Modal: modalStub,
    USkeleton: { template: '<div />' },
    UIcon: { template: '<i />' },
    UButton: { props: ['label'], template: '<button>{{ label }}</button>' },
    Button: { props: ['label'], template: '<button>{{ label }}</button>' },
  }
  const detail = (stock: unknown, variants: unknown[] = []) =>
    ({
      id: 'prod-2',
      name: 'Alimento Gato',
      description: null,
      sku: 'GAT',
      barcode: null,
      unit: null,
      hasVariants: variants.length > 0,
      useStock: true,
      enabledForPos: true,
      category: null,
      brand: null,
      mainImage: null,
      images: [],
      price: null,
      stock,
      variants,
    }) as unknown as PosProductDetail

  async function mountDetail(data: PosProductDetail, portalClass?: string) {
    getProductDetail.mockResolvedValue(data)
    const wrapper = track(
      mount(ProductDetailModal, {
        props: { open: true, productId: 'prod-2', variantId: null, ...(portalClass ? { portalClass } : {}) },
        global: { stubs },
      }),
    )
    await flushPromises()
    return wrapper
  }

  it('Venta composition: the Stock row reads «Disponible 3 · Apartado 2»', async () => {
    const wrapper = await mountDetail(
      detail({ ...reservedStock, location: null }),
      'hf-theme hf-ui sales-entry-portal',
    )
    const stockRow = wrapper.findAll('[data-testid="detail-data-row"]').find((row) => row.get('dt').text() === 'Stock')!
    expect(stockRow.get('dd').text()).toBe('Disponible 3 · Apartado 2')
  })

  it('legacy stat card: the figure and the reserved line, and the per-variant split', async () => {
    const wrapper = await mountDetail(
      detail({ ...reservedStock, location: null }, [
        variantOf('v-1', { quantity: 4, minQuantity: 1, reservedForBackorders: 2 }),
      ]),
    )
    expect(wrapper.text()).toContain('Apartado 2')
    expect(wrapper.text()).toContain('Disponible 4')
  })

  it('shows no split with reserved 0', async () => {
    const wrapper = await mountDetail(detail({ quantity: 3, minQuantity: 1, reservedForBackorders: 0, location: null }))
    expect(wrapper.text()).not.toContain('Apartado')
  })
})
