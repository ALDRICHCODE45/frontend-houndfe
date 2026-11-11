import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { catalogBranchesQueryKey } from '@/features/catalog/composables/useCatalogBranches'
import CatalogProductCard from '@/features/catalog/components/CatalogProductCard.vue'

const product = {
  id: 'product-1',
  name: 'Café molido de altura',
  slug: null,
  description: null,
  category: { id: 'coffee', name: 'Café' },
  brand: { name: 'Tostadores' },
  image: { url: 'https://example.test/cafe.jpg' },
  price: { fromPriceCents: 2599, priceCents: 2599, hidden: false },
  availability: 'available' as const,
  stockPresentation: {
    mode: 'SYSTEM_STATUS' as const,
    status: 'available' as const,
    customQuantity: null,
  },
  hasVariants: false,
  rating: null,
  featuredLabel: null,
}

const stubs = { UIcon: defineComponent({ setup: () => () => h('span') }) }

const Empty = defineComponent({ render: () => null })
let router: Router

function createCatalogRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/catalogo/:branchSlug?', name: 'public-catalog', component: Empty },
      {
        path: '/catalogo/:branchSlug/p/:productId',
        name: 'public-catalog-product',
        component: Empty,
      },
    ],
  })
}

beforeEach(async () => {
  router = createCatalogRouter()
  await router.push('/catalogo/centro?priceListId=list-1')
  await router.isReady()
})

const mountCard = (overrides = {}) =>
  mount(CatalogProductCard, {
    props: { product: { ...product, ...overrides } },
    global: { stubs, plugins: [router] },
  })

const cardLink = (wrapper: ReturnType<typeof mountCard>) =>
  wrapper.get(`a[aria-label="Ver detalles de ${product.name}"]`)

describe('CatalogProductCard', () => {
  it('labels the variant-derived minimum «Desde» (handoff 15 §1: fromPriceCents is the lowest presentation price)', () => {
    const wrapper = mountCard({
      hasVariants: true,
      price: { fromPriceCents: 14900, priceCents: 12900, hidden: false },
    })
    expect(wrapper.get('[data-testid="catalog-product-price"]').text()).toBe(formatCentsMXN(14900))
    expect(wrapper.text()).toContain('Desde')
    expect(wrapper.text()).not.toMatch(/Precio de referencia|Precio del producto/)
  })

  it.each([
    { hasVariants: false, price: { fromPriceCents: 14900, priceCents: 12900, hidden: false } },
    { hasVariants: true, price: { fromPriceCents: null, priceCents: null, hidden: false } },
    { hasVariants: true, price: { fromPriceCents: 14900, priceCents: 12900, hidden: true } },
  ])('withholds reference scope when inapplicable (%j)', (overrides) => {
    expect(mountCard(overrides).text()).not.toMatch(
      /Desde|Consulta los precios por presentación/,
    )
  })

  it('preserves a zero reference amount ahead of a nonzero product price', () => {
    const wrapper = mountCard({
      hasVariants: true,
      price: { fromPriceCents: 0, priceCents: 12900, hidden: false },
    })
    expect(wrapper.get('[data-testid="catalog-product-price"]').text()).toBe(formatCentsMXN(0))
    expect(wrapper.text()).toContain('Desde')
    expect(wrapper.text()).not.toMatch(/Precio de referencia|Consultar precio/)
  })

  it('retains product-price fallback when the reference amount is null', () => {
    const wrapper = mountCard({
      hasVariants: true,
      price: { fromPriceCents: null, priceCents: 12900, hidden: false },
    })
    expect(wrapper.get('[data-testid="catalog-product-price"]').text()).toBe(formatCentsMXN(12900))
    expect(wrapper.text()).toContain('Desde')
  })

  it('contains published media and shows the quiet «Elegir presentación» affordance without nested controls', () => {
    const wrapper = mountCard({ hasVariants: true })

    expect(wrapper.get('img').classes()).toContain('object-contain')
    expect(wrapper.get('[data-testid="catalog-product-action"]').text()).toContain(
      'Elegir presentación',
    )
    expect(wrapper.findAll('a')).toHaveLength(1)
    expect(wrapper.find('button, a a, a button, select, input').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/Agregar|Consulta los precios por presentación/)
  })

  it('reads «Ver detalle» when the product has a single presentation', () => {
    const action = mountCard({ hasVariants: false }).get('[data-testid="catalog-product-action"]')

    expect(action.text()).toContain('Ver detalle')
    expect(action.text()).not.toContain('Elegir presentación')
  })

  it.each([
    { fromPriceCents: null, priceCents: null, hidden: false },
    { fromPriceCents: 2599, priceCents: 2599, hidden: true },
  ])('keeps unavailable public prices neutral (%j)', (price) => {
    const wrapper = mountCard({ price })
    expect(wrapper.get('[data-testid="catalog-product-price"]').text()).toBe('Consultar precio')
    expect(wrapper.text()).not.toContain('$')
  })

  it('renders a real product image, meaningful alt text, MXN cents, and authoritative system status', () => {
    const wrapper = mountCard()

    expect(wrapper.get('img').attributes()).toMatchObject({
      src: product.image.url,
      alt: `Imagen de ${product.name}`,
    })
    expect(wrapper.text()).toContain(formatCentsMXN(2599))
    expect(wrapper.text()).not.toContain('Disponible')
    expect(wrapper.text()).toContain('Tostadores')
    expect(wrapper.text()).toContain('Café')
  })

  it('makes the whole card one link to the product page of the current branch, keeping the listing query', async () => {
    await router.push(
      '/catalogo/centro?priceListId=list-1&categoryId=11111111-1111-4111-8111-111111111111&page=2&facet=life:adult',
    )
    const wrapper = mountCard()
    const link = cardLink(wrapper)
    const target = router.resolve(link.attributes('href')!)

    expect(link.element.tagName).toBe('A')
    expect(link.attributes('data-catalog-product-id')).toBe(product.id)
    expect(target.name).toBe('public-catalog-product')
    expect(target.params).toEqual({ branchSlug: 'centro', productId: product.id })
    expect(target.query).toEqual({
      priceListId: 'list-1',
      categoryId: '11111111-1111-4111-8111-111111111111',
      page: '2',
      facet: 'life:adult',
    })
  })

  it('navigates to the product page on activation and still emits open-detail for compatibility', async () => {
    const wrapper = mountCard()
    const link = cardLink(wrapper)

    await link.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('open-detail')).toEqual([[product.id, link.element]])
    expect(router.currentRoute.value.name).toBe('public-catalog-product')
    expect(router.currentRoute.value.params.productId).toBe(product.id)
    expect(router.currentRoute.value.query.priceListId).toBe('list-1')
  })

  it('uses a neutral fallback and consult-price copy for an absent image and hidden/null price', () => {
    const wrapper = mountCard({
      image: null,
      price: { fromPriceCents: null, priceCents: null, hidden: true },
    })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(
      wrapper.get('[data-testid="catalog-product-image-fallback"]').attributes('aria-label'),
    ).toBe(`Imagen no disponible para ${product.name}`)
    expect(wrapper.text()).toContain('Consultar precio')
    expect(wrapper.text()).not.toContain('$0')
  })

  it('fills the media region with a designed honest no-image state that keeps its testid, role and label', () => {
    const wrapper = mountCard({ image: null })
    const media = wrapper.get('[data-testid="catalog-product-media"]')
    const fallback = wrapper.get('[data-testid="catalog-product-image-fallback"]')

    // The state owns the whole reserved media region instead of floating inside it.
    expect(media.element.firstElementChild).toBe(fallback.element)
    expect(fallback.classes()).toEqual(
      expect.arrayContaining(['size-full', 'flex', 'flex-col', 'items-center', 'justify-center']),
    )
    expect(fallback.attributes('role')).toBe('img')
    expect(fallback.attributes('aria-label')).toBe(`Imagen no disponible para ${product.name}`)

    // The absence is written, never implied by a lone glyph.
    expect(fallback.text()).toContain('Imagen no disponible')
    expect(fallback.find('span').exists()).toBe(true)

    // No gradient placeholder and no invented media URL.
    expect(fallback.classes().some((className) => className.startsWith('bg-gradient'))).toBe(false)
    expect(fallback.element.querySelector('img')).toBeNull()
    expect(wrapper.html()).not.toMatch(/gradient|placeholder|picsum|dicebear/i)
  })

  it('lets the real product image win over the no-image state', () => {
    const wrapper = mountCard()

    expect(wrapper.get('img').attributes()).toMatchObject({
      src: product.image.url,
      alt: `Imagen de ${product.name}`,
    })
    expect(wrapper.find('[data-testid="catalog-product-image-fallback"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Imagen no disponible')
  })

  it('swaps a failed real image for the same written no-image state inside the media region', async () => {
    const wrapper = mountCard()
    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    const fallback = wrapper.get('[data-testid="catalog-product-image-fallback"]')
    expect(wrapper.get('[data-testid="catalog-product-media"]').element.firstElementChild).toBe(
      fallback.element,
    )
    expect(fallback.attributes('aria-label')).toBe(`Imagen no disponible para ${product.name}`)
    expect(fallback.text()).toContain('Imagen no disponible')
  })

  it('re-attempts the media after a failure when the URL changes and keeps identity changes covered', async () => {
    const wrapper = mountCard()
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('[data-testid="catalog-product-image-fallback"]').exists()).toBe(true)

    // Same URL, different product: a stale failure must never suppress the new product's media.
    await wrapper.setProps({ product: { ...product, id: 'product-2' } })
    await nextTick()
    expect(wrapper.get('img').attributes('src')).toBe(product.image.url)
    expect(wrapper.find('[data-testid="catalog-product-image-fallback"]').exists()).toBe(false)

    // Same product identity, new URL: the failure is re-keyed and the new URL is attempted.
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)

    await wrapper.setProps({
      product: { ...product, id: 'product-2', image: { url: 'https://example.test/cafe-v2.jpg' } },
    })
    await nextTick()

    expect(wrapper.get('img').attributes('src')).toBe('https://example.test/cafe-v2.jpg')
    expect(wrapper.find('[data-testid="catalog-product-image-fallback"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Imagen no disponible')
  })

  it('keeps valid nullable availability with HIDDEN presentation neutral', () => {
    const wrapper = mountCard({
      availability: null,
      stockPresentation: { mode: 'HIDDEN', status: null, customQuantity: null },
    })

    expect(wrapper.text()).not.toMatch(/Disponible|Pocas piezas|Agotado|unidades/)
  })

  it('renders CUSTOM_QUANTITY zero without discarding it or calling it out of stock', () => {
    const wrapper = mountCard({
      availability: null,
      stockPresentation: { mode: 'CUSTOM_QUANTITY', status: null, customQuantity: 0 },
    })

    expect(wrapper.text()).toContain('0 unidades')
    expect(wrapper.text()).not.toMatch(/Disponible|Pocas piezas|Agotado/)
  })

  it('says nothing about availability on an ordinary available card', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="catalog-product-availability"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Disponible')
  })

  it('puts the «Desde» note inline before the price, with a small MXN after it', () => {
    const wrapper = mountCard({
      hasVariants: true,
      price: { fromPriceCents: 14900, priceCents: 12900, hidden: false },
    })
    const line = wrapper.get('[data-testid="catalog-product-price-line"]')
    expect(Array.from(line.element.children).map((child) => child.textContent?.trim())).toEqual([
      'Desde',
      formatCentsMXN(14900),
      'MXN',
    ])
    expect(wrapper.findAll('.catalog-product-price-note')).toHaveLength(1)
    expect(line.find('.catalog-product-price-note').exists()).toBe(true)
  })

  it('leads with the media region and keeps the availability pill inside it', () => {
    const wrapper = mountCard({
      availability: 'low_stock',
      stockPresentation: { mode: 'SYSTEM_STATUS', status: 'low_stock', customQuantity: null },
    })

    const control = cardLink(wrapper)
    const media = wrapper.get('[data-testid="catalog-product-media"]')
    expect(control.element.firstElementChild).toBe(media.element)
    expect(media.find('img').exists()).toBe(true)

    const availability = media.get('[data-testid="catalog-product-availability"]')
    expect(availability.text()).toContain('Pocas piezas')
  })

  it('orders the card body as brand, name, category and price', () => {
    const wrapper = mountCard()

    const body = wrapper.get('[data-testid="catalog-product-body"]')
    const sequence = Array.from(body.element.querySelectorAll('[data-testid], h2')).map(
      (element) => element.getAttribute('data-testid') ?? element.tagName.toLowerCase(),
    )

    expect(sequence).toEqual([
      'catalog-product-brand',
      'h2',
      'catalog-product-category',
      'catalog-product-price-line',
      'catalog-product-price',
      'catalog-product-action',
    ])
    expect(body.get('h2').text()).toBe(product.name)
    expect(body.get('[data-testid="catalog-product-brand"]').text()).toBe(product.brand.name)
    expect(body.get('[data-testid="catalog-product-category"]').text()).toBe(product.category.name)
    expect(body.get('[data-testid="catalog-product-price"]').text()).toBe(
      formatCentsMXN(product.price.priceCents),
    )
  })

  it('lets a long formatted price and a custom quantity wrap without truncating either value', () => {
    const wrapper = mountCard({
      price: { fromPriceCents: 123456789, priceCents: 123456789, hidden: false },
      stockPresentation: { mode: 'CUSTOM_QUANTITY', status: null, customQuantity: 1234 },
    })

    const price = wrapper.get('[data-testid="catalog-product-price"]')
    const quantity = wrapper.get('[data-testid="catalog-product-quantity"]')
    const row = price.element.closest('.catalog-product-price-row')

    expect(row?.className).toContain('flex-wrap')
    for (const value of [price, quantity]) {
      expect(value.classes()).toEqual(expect.arrayContaining(['min-w-0', 'break-words']))
      expect(value.classes()).not.toContain('truncate')
      expect(value.classes()).not.toContain('overflow-hidden')
    }
    expect(price.text()).toBe(formatCentsMXN(123456789))
    expect(quantity.text()).toBe('1234 unidades')
  })

  it('renders no rating or featured surface even when the DTO carries one', () => {
    const wrapper = mountCard({ rating: 4.8, featuredLabel: 'Nuevo' })

    expect(wrapper.text()).not.toContain('4.8')
    expect(wrapper.text()).not.toContain('Nuevo')
  })

  it('renders an aggregate CUSTOM_QUANTITY variant status when its quantity is null', () => {
    const wrapper = mountCard({
      availability: 'low_stock',
      stockPresentation: {
        mode: 'CUSTOM_QUANTITY',
        status: 'low_stock',
        customQuantity: null,
      },
    })

    expect(wrapper.text()).toContain('Pocas piezas')
    expect(wrapper.text()).not.toContain('unidades')
  })

  describe('status tones and paint', () => {
    it.each([
      ['low_stock', 'Pocas piezas', 'warning'],
      ['out_of_stock', 'Agotado', 'neutral'],
    ] as const)('maps %s to the %s tone, never a palette color', (status, label, tone) => {
      const wrapper = mountCard({
        availability: status,
        stockPresentation: { mode: 'SYSTEM_STATUS', status, customQuantity: null },
      })
      const badge = wrapper.get('[data-testid="catalog-product-availability"]')

      expect(badge.attributes('data-tone')).toBe(tone)
      expect(badge.text()).toBe(label)
    })

    it('paints with catalog roles only: no palette literals and no bold weights', () => {
      const html = mountCard({ image: null }).html()

      expect(html).not.toMatch(/emerald|amber|red-\d|coco-|font-bold/)
      expect(html).toContain('font-semibold')
    })
  })
})

describe('CatalogProductCard v0 extras', () => {
  const branch = { id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null }

  function mountWithBranches(branches: unknown[], overrides = {}) {
    const queryClient = new QueryClient()
    queryClient.setQueryData(catalogBranchesQueryKey, branches)
    return mount(CatalogProductCard, {
      props: { product: { ...product, ...overrides } },
      global: { stubs, plugins: [router, [VueQueryPlugin, { queryClient }]] },
    })
  }

  it('renders no WhatsApp control without a number (backend without v0)', async () => {
    const wrapper = mountWithBranches([branch])
    await flushPromises()
    expect(wrapper.find('[data-testid="catalog-whatsapp-link"]').exists()).toBe(false)
    expect(wrapper.html()).not.toMatch(/whatsapp|wa\.me/i)
    expect(wrapper.findAll('a')).toHaveLength(1)
  })

  it('renders no WhatsApp control for a null number or an unrelated branch number', async () => {
    const wrapper = mountWithBranches([
      { ...branch, whatsappNumber: null },
      { ...branch, id: 'b-2', slug: 'norte', whatsappNumber: '+5215500000000' },
    ])
    await flushPromises()
    expect(wrapper.find('[data-testid="catalog-whatsapp-link"]').exists()).toBe(false)
  })

  it('links «Pedir» to wa.me beside the card link, never inside it', async () => {
    const wrapper = mountWithBranches([{ ...branch, whatsappNumber: '+5215500000000' }])
    await flushPromises()
    const link = wrapper.get('[data-testid="catalog-whatsapp-link"]')
    const url = new URL(link.attributes('href')!)
    expect(url.origin + url.pathname).toBe('https://wa.me/5215500000000')
    const text = url.searchParams.get('text')!
    expect(text).toContain(product.name)
    expect(text).toContain('Sucursal Centro')
    expect(text).toContain('/catalogo/centro/p/product-1')
    expect(text).toContain('priceListId=list-1')
    expect(link.attributes('aria-label')).toBe(`Pedir por WhatsApp: ${product.name}`)
    expect(cardLinkOf(wrapper).element.contains(link.element)).toBe(false)
  })

  it('reads «Preguntar» when the product is out of stock', async () => {
    const wrapper = mountWithBranches([{ ...branch, whatsappNumber: '+5215500000000' }], {
      availability: 'out_of_stock',
      stockPresentation: { mode: 'SYSTEM_STATUS', status: 'out_of_stock', customQuantity: null },
    })
    await flushPromises()
    const link = wrapper.get('[data-testid="catalog-whatsapp-link"]')
    expect(link.attributes('aria-label')).toBe(`Preguntar por WhatsApp: ${product.name}`)
    expect(new URL(link.attributes('href')!).searchParams.get('text')).toContain('¿cuándo vuelve')
  })

  const exact = (exactQuantity?: number | null) => ({
    availability: 'low_stock' as const,
    stockPresentation: {
      mode: 'SYSTEM_STATUS_EXACT_LOW_STOCK' as const,
      status: 'low_stock' as const,
      customQuantity: null,
      ...(exactQuantity === undefined ? {} : { exactQuantity }),
    },
  })

  it('writes «Quedan N» on the availability pill when the exact quantity is published', () => {
    const wrapper = mountCard(exact(3))
    expect(wrapper.get('[data-testid="catalog-product-availability"]').text()).toBe('Quedan 3')
  })

  it.each([[null], [undefined]])('keeps «Pocas piezas» when the exact quantity is %s', (quantity) => {
    const wrapper = mountCard(exact(quantity))
    expect(wrapper.get('[data-testid="catalog-product-availability"]').text()).toBe('Pocas piezas')
  })
})

function cardLinkOf(wrapper: ReturnType<typeof mount>) {
  return wrapper.get(`a[aria-label="Ver detalles de ${product.name}"]`)
}
