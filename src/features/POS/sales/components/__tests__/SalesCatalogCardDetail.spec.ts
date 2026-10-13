import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { computed, ref } from 'vue'
import type { PosCatalogItem, PosProductDetail } from '../../interfaces/sale.types'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ProductSearchResultItem from '../ProductSearchResultItem.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ProductSearchResults from '../ProductSearchResults.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ProductSearchPanel from '../ProductSearchPanel.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ProductDetailModal from '../ProductDetailModal.vue'

/*
 * S12 — v0 catalog cards and product detail inside Venta.
 *
 * User decision verbatim: "Igual que v0 (recomendado)" — image and name open
 * the product detail; the visible "Agregar" / "Ver variantes" button is the
 * card action. Only the exact `sales-entry-portal` opt-in changes; quotations
 * keep the whole-card select. Facts come from real catalog/detail fields only.
 * Public DOM/event contracts; rendered fidelity remains user-owned.
 */

const ENTRY = 'hf-theme hf-ui sales-entry-portal'

const { getProductDetail } = vi.hoisted(() => ({ getProductDetail: vi.fn() }))
vi.mock('../../api/sale.api', () => ({ saleApi: { getProductDetail } }))

const mockItems = ref<PosCatalogItem[]>([])
vi.mock('../../composables/useProductSearch', () => ({
  useProductSearch: () => ({
    query: ref(''),
    items: computed(() => mockItems.value),
    isLoading: computed(() => false),
    isEmpty: computed(() => false),
    hasQuery: computed(() => false),
    categoryId: ref(undefined),
    categories: computed(() => []),
    totalUnfiltered: computed(() => mockItems.value.length),
  }),
}))

const wrappers: VueWrapper[] = []
const track = <T extends VueWrapper>(wrapper: T) => {
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})
beforeEach(() => {
  getProductDetail.mockReset()
  mockItems.value = []
})

const simple: PosCatalogItem = {
  id: 'prod-1',
  name: 'Alimento para perro adulto',
  description: 'Pollo y arroz · 2 kg',
  sku: 'ALI-002',
  barcode: null,
  unit: null,
  hasVariants: false,
  useStock: true,
  category: { id: 'cat-1', name: 'Alimentos' },
  brand: { id: 'brand-1', name: 'CANINO' },
  mainImage: null,
  images: [],
  price: { priceCents: 45000, priceDecimal: 450, priceListName: 'PUBLICO' },
  stock: { quantity: 24, minQuantity: 5 },
  variants: [],
}

const withVariants: PosCatalogItem = {
  ...simple,
  id: 'prod-2',
  name: 'Ibuprofeno',
  description: null,
  sku: 'MED-014',
  hasVariants: true,
  price: null,
  stock: null,
  variants: [
    { id: 'v-1', name: '500 mg', sku: 'MED-014-1', barcode: null, mainImage: null, price: { priceCents: 15000, priceDecimal: 150, priceListName: 'PUBLICO' }, stock: { quantity: 10, minQuantity: 2 } },
    { id: 'v-2', name: '250 mg', sku: 'MED-014-2', barcode: null, mainImage: null, price: { priceCents: 13000, priceDecimal: 130, priceListName: 'PUBLICO' }, stock: { quantity: 10, minQuantity: 2 } },
  ],
}

const cardStubs = { UIcon: { template: '<i />' } }

function mountCard(item: PosCatalogItem, composition = true) {
  return track(
    mount(ProductSearchResultItem, {
      props: composition ? { item, composition: true } : { item },
      global: { stubs: cardStubs },
    }),
  )
}

describe('S12 — v0 catalog card in Venta', () => {
  it('renders the real facts and a visible add action', () => {
    const wrapper = mountCard(simple)

    expect(wrapper.get('.sales-pos-product-brand').text()).toBe('CANINO · ALI-002')
    expect(wrapper.get('[data-testid="card-view-detail-name"]').text()).toBe('Alimento para perro adulto')
    expect(wrapper.get('[data-testid="card-detail-line"]').text()).toBe('Pollo y arroz · 2 kg')
    expect(wrapper.get('.sales-pos-product-price').text()).toBe('$450.00')
    expect(wrapper.get('[data-testid="card-stock-line"]').text()).toBe('24 disponibles')
    const add = wrapper.get('[data-testid="add-action"]')
    expect(add.text()).toBe('Agregar')
    expect(add.classes()).not.toContain('sm:hidden')
    expect(wrapper.find('[data-testid="stock-badge"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-hint"]').exists()).toBe(false)
  })

  it('opens the detail from the image and the name, and adds only from the button', async () => {
    const wrapper = mountCard(simple)

    await wrapper.get('[data-testid="card-view-detail-media"]').trigger('click')
    await wrapper.get('[data-testid="card-view-detail-name"]').trigger('click')
    expect(wrapper.emitted('view-detail')).toEqual([[simple], [simple]])
    expect(wrapper.emitted('select')).toBeUndefined()

    await wrapper.get('[data-testid="result-card"]').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()

    await wrapper.get('[data-testid="add-action"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([[simple]])
    expect(wrapper.emitted('view-detail')).toHaveLength(2)
  })

  it('labels the image and name actions for assistive technology', () => {
    const wrapper = mountCard(simple)

    expect(wrapper.get('[data-testid="card-view-detail-media"]').attributes('aria-label')).toBe(
      'Ver detalle de Alimento para perro adulto',
    )
    expect(wrapper.get('[data-testid="card-view-detail-media"]').attributes('type')).toBe('button')
    expect(wrapper.get('[data-testid="card-view-detail-name"]').attributes('type')).toBe('button')
    expect(wrapper.get('[data-testid="add-action"]').attributes('type')).toBe('button')
  })

  it('shows variant products with count badge, presentations, lowest price and the variants action', async () => {
    const wrapper = mountCard(withVariants)

    expect(wrapper.get('[data-testid="variant-count-badge"]').text()).toBe('2 variantes')
    expect(wrapper.get('[data-testid="card-detail-line"]').text()).toBe('2 presentaciones')
    expect(wrapper.get('.sales-pos-product-price').text()).toBe('Desde $130.00')
    expect(wrapper.get('[data-testid="card-stock-line"]').text()).toBe('20 disponibles')
    const add = wrapper.get('[data-testid="add-action"]')
    expect(add.text()).toBe('Ver variantes')
    expect(add.classes()).toContain('sales-pos-product-add-variants')

    await add.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[withVariants]])
  })

  it('omits unavailable facts instead of inventing them', () => {
    const wrapper = mountCard({
      ...simple,
      description: '  ',
      brand: null,
      useStock: false,
      price: null,
    })

    expect(wrapper.get('.sales-pos-product-brand').text()).toBe('ALI-002')
    expect(wrapper.find('[data-testid="card-detail-line"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="card-stock-line"]').exists()).toBe(false)
    expect(wrapper.get('.sales-pos-product-price').text()).toBe('Sin precio')
  })

  it('marks low stock with the warning state', () => {
    const wrapper = mountCard({ ...simple, stock: { quantity: 3, minQuantity: 5 } })

    const stock = wrapper.get('[data-testid="card-stock-line"]')
    expect(stock.text()).toBe('Solo 3 disponibles')
    expect(stock.attributes('data-sales-pos-stock')).toBe('low')
  })

  it('keeps the previous whole-card select when not opted in (quotations)', async () => {
    const wrapper = mountCard(simple, false)

    expect(wrapper.find('[data-testid="card-view-detail-media"]').exists()).toBe(false)
    await wrapper.get('[data-testid="result-card"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([[simple]])
    expect(wrapper.emitted('view-detail')).toBeUndefined()
    expect(wrapper.get('[data-testid="add-action"]').classes()).toContain('sm:hidden')
  })
})

describe('S12 — results and panel wiring', () => {
  it('forwards the opt-in and the detail event from the results grid', async () => {
    const wrapper = track(
      mount(ProductSearchResults, {
        props: { items: [simple], isLoading: false, isEmpty: false, hasQuery: false, composition: true },
        global: { stubs: cardStubs },
      }),
    )

    await wrapper.get('[data-testid="card-view-detail-name"]').trigger('click')
    expect(wrapper.emitted('view-detail')).toEqual([[simple]])
  })

  const panelStubs = {
    VariantPickerModal: { template: '<div />' },
    ProductDetailModal: {
      name: 'ProductDetailModal',
      props: ['open', 'productId', 'variantId', 'portalClass'],
      emits: ['update:open'],
      template: '<div v-if="open" data-testid="detail-stub" />',
    },
    UIcon: { template: '<i />' },
  }

  it('opens the product detail from a Venta card with the entry portal', async () => {
    mockItems.value = [simple]
    const wrapper = track(mount(ProductSearchPanel, { props: { portalClass: ENTRY }, global: { stubs: panelStubs } }))

    await wrapper.get('[data-testid="card-view-detail-media"]').trigger('click')
    const detail = wrapper.getComponent({ name: 'ProductDetailModal' })
    expect(detail.props()).toMatchObject({ open: true, productId: 'prod-1', variantId: null, portalClass: ENTRY })
    expect(wrapper.emitted('add-product')).toBeUndefined()

    detail.vm.$emit('update:open', false)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="detail-stub"]').exists()).toBe(false)
  })

  it('still adds a simple product from the Venta card button', async () => {
    mockItems.value = [simple]
    const wrapper = track(mount(ProductSearchPanel, { props: { portalClass: ENTRY }, global: { stubs: panelStubs } }))

    await wrapper.get('[data-testid="add-action"]').trigger('click')
    expect(wrapper.emitted('add-product')).toEqual([['prod-1', null, null]])
  })

  it('never mounts the catalog detail for an unrelated consumer', async () => {
    mockItems.value = [simple]
    const wrapper = track(mount(ProductSearchPanel, { global: { stubs: panelStubs } }))

    expect(wrapper.findComponent({ name: 'ProductDetailModal' }).exists()).toBe(false)
    await wrapper.get('[data-testid="result-card"]').trigger('click')
    expect(wrapper.emitted('add-product')).toEqual([['prod-1', null, null]])
  })
})

const detail: PosProductDetail = {
  id: 'prod-2',
  name: 'Ibuprofeno',
  description: 'Caja con 10 cápsulas.',
  sku: 'MED-014',
  barcode: '7500000000014',
  unit: null,
  hasVariants: true,
  useStock: true,
  enabledForPos: true,
  category: { id: 'cat-1', name: 'Medicamentos' },
  brand: { id: 'brand-1', name: 'Nova Salud' },
  mainImage: null,
  images: [],
  price: null,
  stock: null,
  variants: [
    { id: 'v-1', name: '500 mg', sku: 'MED-014-1', barcode: '7500000000014', mainImage: null, price: { priceCents: 15000, priceDecimal: 150, priceListName: 'PUBLICO' }, stock: { quantity: 10, minQuantity: 2, location: 'Pasillo B · Estante 2' } },
    { id: 'v-2', name: '250 mg', sku: 'MED-014-2', barcode: null, mainImage: null, price: { priceCents: 13000, priceDecimal: 130, priceListName: 'PUBLICO' }, stock: null },
  ],
} as PosProductDetail

const modalStub = {
  props: ['open', 'title', 'ui', 'content'],
  template: '<div v-if="open" data-testid="modal"><h2>{{ title }}</h2><slot name="body" /><slot name="footer" /></div>',
}
const detailStubs = {
  UModal: modalStub,
  Modal: modalStub,
  USkeleton: { template: '<div />' },
  UIcon: { template: '<i />' },
  UButton: { props: ['label', 'to'], emits: ['click'], template: '<button @click="$emit(\'click\')">{{ label }}</button>' },
  Button: { props: ['label', 'to'], emits: ['click'], template: '<button @click="$emit(\'click\')">{{ label }}</button>' },
}

async function mountDetail(portalClass?: string, variantId: string | null = 'v-1') {
  getProductDetail.mockResolvedValue(detail)
  const wrapper = track(
    mount(ProductDetailModal, {
      props: { open: true, productId: 'prod-2', variantId, ...(portalClass ? { portalClass } : {}) },
      global: { stubs: detailStubs },
    }),
  )
  await flushPromises()
  return wrapper
}

const rows = (wrapper: VueWrapper) =>
  wrapper.findAll('[data-testid="detail-data-row"]').map((row) => [row.get('dt').text(), row.get('dd').text()])

describe('S12 — v0 product detail in Venta', () => {
  it('renders the hero, the catalog facts and the selected variant price', async () => {
    const wrapper = await mountDetail(ENTRY)

    expect(wrapper.get('[data-testid="detail-eyebrow"]').text()).toBe('Nova Salud · Medicamentos')
    expect(wrapper.get('[data-testid="detail-name"]').text()).toBe('Ibuprofeno 500 mg')
    expect(wrapper.get('[data-testid="detail-description"]').text()).toBe('Caja con 10 cápsulas.')
    expect(wrapper.get('[data-testid="detail-price"]').text()).toBe('$150.00')
    expect(wrapper.get('[data-testid="detail-price-list"]').text()).toBe('Precio lista · PUBLICO')
    expect(rows(wrapper)).toEqual([
      ['SKU', 'MED-014-1'],
      ['Código de barras', '7500000000014'],
      ['Stock', '10 unidades'],
      ['Ubicación', 'Pasillo B · Estante 2'],
      ['Marca', 'Nova Salud'],
    ])
    expect(wrapper.find('.grid-cols-3').exists()).toBe(false)
  })

  it('lists variants as choices and switches the facts on selection', async () => {
    const wrapper = await mountDetail(ENTRY)

    const choices = wrapper.findAll('[data-testid="detail-variant"]')
    expect(choices.map((choice) => choice.text())).toEqual(['500 mg · $150.00', '250 mg · $130.00'])
    expect(choices.map((choice) => choice.attributes('aria-pressed'))).toEqual(['true', 'false'])

    await choices[1]!.trigger('click')
    expect(wrapper.get('[data-testid="detail-price"]').text()).toBe('$130.00')
    expect(rows(wrapper)).toEqual([
      ['SKU', 'MED-014-2'],
      ['Código de barras', '7500000000014'],
      ['Stock', 'No registrado'],
      ['Ubicación', 'Sin ubicación'],
      ['Marca', 'Nova Salud'],
    ])
    expect(wrapper.findAll('[data-testid="detail-variant"]').map((c) => c.attributes('aria-pressed'))).toEqual([
      'false',
      'true',
    ])
  })

  it('keeps the existing footer actions and the single fetch', async () => {
    const wrapper = await mountDetail(ENTRY, null)

    expect(getProductDetail).toHaveBeenCalledTimes(1)
    expect(getProductDetail).toHaveBeenCalledWith('prod-2')
    expect(wrapper.text()).toContain('Cerrar')
    expect(wrapper.text()).toContain('Ir al producto')
    // Opened from a catalog card (no variant yet): the first variant is shown,
    // like v0, instead of an empty product-level price.
    expect(wrapper.get('[data-testid="detail-price"]').text()).toBe('$150.00')
    expect(wrapper.findAll('[data-testid="detail-variant"]')[0]!.attributes('aria-pressed')).toBe('true')
  })

  it('shows "Sin precio" for a simple product without a price', async () => {
    getProductDetail.mockResolvedValue({ ...detail, hasVariants: false, variants: [] })
    const wrapper = track(
      mount(ProductDetailModal, {
        props: { open: true, productId: 'prod-2', variantId: null, portalClass: ENTRY },
        global: { stubs: detailStubs },
      }),
    )
    await flushPromises()

    expect(wrapper.get('[data-testid="detail-price"]').text()).toBe('Sin precio')
    expect(wrapper.find('[data-testid="detail-price-list"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="detail-variant"]').exists()).toBe(false)
  })

  it('keeps the previous stat grid when not opted in', async () => {
    const wrapper = await mountDetail(undefined)

    expect(wrapper.find('[data-testid="detail-eyebrow"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Existencias')
    expect(wrapper.find('.grid-cols-3').exists()).toBe(true)
  })
})

describe('S12 — exact-token detail boundary (verifier finding)', () => {
  it('never applies the Venta checkout marker or composition to a near-match token', async () => {
    const wrapper = await mountDetail('hf-theme hf-ui not-sales-entry-portal')

    const modal = wrapper.getComponent(modalStub)
    expect(modal.props('ui')).toEqual({ content: 'hf-theme hf-ui not-sales-entry-portal' })
    expect(wrapper.find('[data-testid="detail-eyebrow"]').exists()).toBe(false)
  })

  it('appends the checkout marker for the exact Venta token', async () => {
    const wrapper = await mountDetail(ENTRY)

    expect(wrapper.getComponent(modalStub).props('ui')).toEqual({ content: `${ENTRY} sales-pos-checkout` })
  })
})
