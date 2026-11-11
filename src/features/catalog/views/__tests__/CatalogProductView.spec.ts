import { DOMWrapper, enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick, shallowRef } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { mountWithUApp } from '../../../../test/mountWithUApp'
import CatalogProductView from '../CatalogProductView.vue'
import type { CatalogProductDetailState } from '../../composables/useCatalogProductDetail'
import type { CatalogBranchesState } from '../../composables/useCatalogBranches'
import type { CatalogPriceContextsState } from '../../composables/useCatalogPriceContexts'
import type { PublicBranchDto } from '../../interfaces/catalog.types'
import type { PublicCatalogBranchDetailDto } from '../../interfaces/public-catalog-branch.types'
import type { PublicCatalogPriceContextDto } from '../../interfaces/public-catalog-price-context.types'
import type {
  PublicCatalogProductDetailDto,
  PublicProductAttribute,
} from '../../interfaces/public-catalog-product-detail.types'

/**
 * The page is a composition of three data sources. They are replaced by controllable state so the
 * tests observe what the page renders and which identity it asks for, never a network detail.
 */
const fake = vi.hoisted(() => ({
  branches: null as unknown as import('vue').ShallowRef<PublicBranchDto[]>,
  branchesState: null as unknown as import('vue').ShallowRef<CatalogBranchesState>,
  retryBranches: null as unknown as ReturnType<typeof import('vitest').vi.fn>,
  branchDetail: null as unknown as import('vue').ShallowRef<PublicCatalogBranchDetailDto | null>,
  contexts: null as unknown as import('vue').ShallowRef<PublicCatalogPriceContextDto[]>,
  contextsState: null as unknown as import('vue').ShallowRef<CatalogPriceContextsState>,
  contextsSlug: [] as Array<string | null>,
  detail: null as unknown as import('vue').ShallowRef<PublicCatalogProductDetailDto | null>,
  detailState: null as unknown as import('vue').ShallowRef<CatalogProductDetailState>,
  retryDetail: null as unknown as ReturnType<typeof import('vitest').vi.fn>,
  identity: null as unknown as import('vue').ComputedRef<Array<string | null | undefined>>,
  listing: null as unknown as import('vue').ShallowRef<unknown>,
  listingState: null as unknown as import('vue').ShallowRef<string>,
  listingSlug: [] as Array<string | null>,
}))

vi.mock('@/features/catalog/composables/useCatalogBranches', () => ({
  useCatalogBranches: () => ({
    branches: fake.branches,
    state: fake.branchesState,
    retry: fake.retryBranches,
  }),
}))
vi.mock('@/features/catalog/composables/useCatalogBranchDetail', () => ({
  useCatalogBranchDetail: () => ({ branch: fake.branchDetail }),
}))
vi.mock('@/features/catalog/composables/useCatalogPriceContexts', async () => {
  const { toValue } = await import('vue')
  return {
    useCatalogPriceContexts: (slug: import('vue').MaybeRefOrGetter<string | null>) => {
      fake.contextsSlug.push(toValue(slug))
      return { contexts: fake.contexts, state: fake.contextsState, retry: vi.fn() }
    },
  }
})
vi.mock('@/features/catalog/composables/useCatalogProducts', async () => {
  const { toValue } = await import('vue')
  return {
    useCatalogProducts: (slug: import('vue').MaybeRefOrGetter<string | null>) => {
      fake.listingSlug.push(toValue(slug))
      return { products: shallowRef([]), response: fake.listing, state: fake.listingState, retry: vi.fn() }
    },
  }
})
vi.mock('@/features/catalog/composables/useCatalogProductDetail', async () => {
  const { computed: vueComputed, toValue } = await import('vue')
  return {
    useCatalogProductDetail: (
      ...identity: Array<import('vue').MaybeRefOrGetter<string | null | undefined>>
    ) => {
      fake.identity = vueComputed(() => identity.map((part) => toValue(part)))
      return { detail: fake.detail, state: fake.detailState, retry: fake.retryDetail }
    },
  }
})

const stubs = {
  CatalogHeader: defineComponent({
    setup: (_props, { slots }) => () =>
      h('header', [slots.categories?.(), slots.search?.()]),
  }),
  CatalogFooter: defineComponent({ setup: () => () => h('footer', 'footer') }),
  UIcon: defineComponent({ setup: () => () => h('span') }),
  USkeleton: defineComponent({ setup: () => () => h('span', { 'data-testid': 'skeleton' }) }),
}

const branches: PublicBranchDto[] = [
  { id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null },
  { id: 'b-2', name: 'Sucursal Norte', slug: 'norte', address: null, phone: null },
]
const priceContexts: PublicCatalogPriceContextDto[] = [
  { priceListId: 'list-1', name: 'Público', isCatalogDefault: true },
  { priceListId: 'list-2', name: 'Mayoreo', isCatalogDefault: false },
]

const attribute = (
  code: string,
  label: string,
  display: string,
  section: { code: string; label: string } | null,
): PublicProductAttribute => ({
  code,
  label,
  facet: false,
  section,
  value: { type: 'text', text: display },
  display,
})
const whoSection = { code: 'who', label: 'Para quién' }
const packSection = { code: 'pack', label: 'Contenido y empaque' }

const branchEntry = (availability: 'available' | 'low_stock' | 'out_of_stock') => [
  {
    branchId: 'b-2',
    branchName: 'Sucursal Norte',
    branchSlug: 'norte',
    availability: 'available' as const,
    isSelected: false,
  },
  {
    branchId: 'b-1',
    branchName: 'Sucursal Centro',
    branchSlug: 'centro',
    availability,
    isSelected: true,
  },
]
const systemStatus = (status: 'available' | 'low_stock' | 'out_of_stock') => ({
  mode: 'SYSTEM_STATUS' as const,
  status,
  customQuantity: null,
})

/** Server order is creation order: 20 kg, 2 kg, 8 kg. */
const detailFixture = (): PublicCatalogProductDetailDto => ({
  id: 'product-1',
  name: 'Croqueta Nupec Cachorro',
  slug: null,
  description: 'Alimento seco <b>sin HTML</b> para cachorro.',
  category: { id: '11111111-1111-4111-8111-111111111111', name: 'Alimento para perro' },
  brand: { name: 'Nupec' },
  images: [
    { id: 'img-2', url: 'https://example.test/side.jpg', isMain: false },
    { id: 'img-1', url: 'https://example.test/main.jpg', isMain: true },
  ],
  price: { priceCents: 22000, hidden: false },
  availability: 'available',
  stockPresentation: systemStatus('available'),
  hasVariants: true,
  variants: [
    {
      id: 'v-20',
      name: '20 kg',
      option: 'Peso',
      value: '20 kg',
      image: { url: 'https://example.test/20kg.jpg' },
      price: { priceCents: 168900, hidden: false },
      availabilityByBranch: branchEntry('out_of_stock'),
      stockPresentation: systemStatus('out_of_stock'),
      attributes: [attribute('weight', 'Peso neto', '20 kg', packSection)],
    },
    {
      id: 'v-2',
      name: '2 kg',
      option: 'Peso',
      value: '2 kg',
      image: null,
      price: { priceCents: 22000, hidden: false },
      availabilityByBranch: branchEntry('low_stock'),
      stockPresentation: systemStatus('low_stock'),
      attributes: [attribute('weight', 'Peso neto', '2 kg', packSection)],
    },
    {
      id: 'v-8',
      name: '8 kg',
      option: 'Peso',
      value: '8 kg',
      image: { url: 'https://example.test/8kg.jpg' },
      price: { priceCents: 74900, hidden: false },
      availabilityByBranch: branchEntry('available'),
      stockPresentation: systemStatus('available'),
      attributes: [
        attribute('weight', 'Peso neto', '8 kg', packSection),
        attribute('package', 'Empaque', 'Bolsa', packSection),
      ],
    },
  ],
  rating: null,
  featuredLabel: null,
  attributes: [attribute('species', 'Especie', 'Perro', whoSection)],
  priceContext: { priceListId: 'list-1', name: 'Público', isCatalogDefault: true },
  excludedCount: 0,
})

const Empty = defineComponent({ render: () => null })
let router: Router

async function mountPage(path = '/catalogo/centro/p/product-1?priceListId=list-1') {
  router = createRouter({
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
  await router.push(path)
  await router.isReady()
  const wrapper = mountWithUApp(CatalogProductView, {
    attachTo: document.body,
    global: { plugins: [router], stubs },
  })
  await flushPromises()
  return wrapper
}

const body = () => new DOMWrapper(document.body)
const get = (selector: string) => body().get(selector)
const find = (selector: string) => body().find(selector)
const findAll = (selector: string) => body().findAll(selector)
const presentationInput = (name: string) => {
  const label = findAll('[data-testid="catalog-detail-presentation"]').find((entry) =>
    entry.text().includes(name),
  )
  if (!label) throw new Error(`Missing presentation ${name}`)
  return label.get('input[type="radio"]')
}
const choose = async (name: string) => {
  await presentationInput(name).setValue(true)
  await nextTick()
}
const resolveHref = (selector: string) => router.resolve(get(selector).attributes('href')!)

beforeEach(() => {
  fake.branches = shallowRef(branches)
  fake.branchesState = shallowRef<CatalogBranchesState>('populated')
  fake.retryBranches = vi.fn()
  fake.branchDetail = shallowRef<PublicCatalogBranchDetailDto | null>(null)
  fake.contexts = shallowRef(priceContexts)
  fake.contextsState = shallowRef<CatalogPriceContextsState>('populated')
  fake.contextsSlug = []
  fake.detail = shallowRef<PublicCatalogProductDetailDto | null>(detailFixture())
  fake.detailState = shallowRef<CatalogProductDetailState>('populated')
  fake.retryDetail = vi.fn()
  fake.identity = computed(() => [])
  fake.listing = shallowRef({
    items: [],
    meta: { total: 12, page: 1, limit: 20, totalPages: 1 },
    facets: {
      categories: [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Alimento para perro', count: 7 },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Juguetes', count: 5 },
      ],
      attributes: [],
    },
    priceContext: { priceListId: 'list-1', name: 'Público', isCatalogDefault: true },
  })
  fake.listingState = shallowRef('populated')
  fake.listingSlug = []
})

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
// Registered last so it runs first: the page unmounts before the body is cleared.
enableAutoUnmount(afterEach)

describe('CatalogProductView', () => {
  describe('identity and price list', () => {
    it('asks for the product of the route branch in the price list of the query', async () => {
      await mountPage('/catalogo/centro/p/product-1?priceListId=list-2')
      expect(fake.identity.value).toEqual(['centro', 'product-1', 'list-2'])
    })

    it('falls back to the default price list of the branch when the query carries none', async () => {
      await mountPage('/catalogo/centro/p/product-1')
      expect(fake.identity.value).toEqual(['centro', 'product-1', 'list-1'])
    })

    it('never asks for the product of a branch that does not publish its catalog', async () => {
      await mountPage('/catalogo/sur/p/product-1?priceListId=list-1')
      expect(fake.identity.value[1]).toBeNull()
    })
  })

  describe('header', () => {
    it('offers «Categorías» with the listing counts and opens the listing on that category', async () => {
      await mountPage('/catalogo/centro/p/product-1?priceListId=list-1&page=3')
      expect(fake.listingSlug).toContain('centro')
      await get('.catalog-select-trigger').trigger('click')
      const items = findAll('.catalog-menu-item').map((item) => item.text())
      expect(items[0]).toContain('Todas las categorías')
      expect(items[0]).toContain('12')
      expect(items).toContain('Juguetes 5')

      await findAll('.catalog-menu-item')[2]!.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('public-catalog')
      expect(router.currentRoute.value.params.branchSlug).toBe('centro')
      expect(router.currentRoute.value.query).toEqual({
        priceListId: 'list-1',
        categoryId: '22222222-2222-4222-8222-222222222222',
      })
    })

    it('submits the search to the listing with q, keeping only the price list', async () => {
      await mountPage('/catalogo/centro/p/product-1?priceListId=list-1&categoryId=x&page=2')
      await get('input[type="search"]').setValue('croquetas')
      await get('form[role="search"]').trigger('submit')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('public-catalog')
      expect(router.currentRoute.value.query).toEqual({ priceListId: 'list-1', q: 'croquetas' })
    })

    it('never asks for the listing of a branch that does not publish its catalog', async () => {
      await mountPage('/catalogo/sur/p/product-1')
      expect(fake.listingSlug.every((slug) => slug === null)).toBe(true)
    })
  })

  describe('populated page', () => {
    it('shows identity, the presentation price, the price list and the branch availability', async () => {
      await mountPage()

      expect(get('h1').text()).toBe('Croqueta Nupec Cachorro')
      expect(get('[data-testid="catalog-detail-eyebrow"]').text()).toContain('Nupec')
      expect(get('[data-testid="catalog-detail-eyebrow"]').text()).toContain('Alimento para perro')
      // Arrival selects the first presentation in stock in size order: 2 kg.
      expect(get('[data-testid="catalog-detail-price"]').text()).toContain(formatCentsMXN(22000))
      expect(get('[data-testid="catalog-detail-price"]').text()).toContain('MXN')
      // One meta line, one availability pill: no price-list text, no separate quantity line.
      expect(get('[data-testid="catalog-detail-meta"]').text()).toBe('Presentación 2 kg')
      expect(body().text()).not.toContain('Lista de precios')
      expect(find('[data-testid="catalog-detail-unit-price"]').exists()).toBe(false)
      const availability = get('[data-testid="catalog-detail-availability"]')
      expect(availability.text()).toBe('Pocas piezas en Sucursal Centro')
      expect(availability.attributes('data-tone')).toBe('warning')
    })

    it('renders the description as plain text, never as HTML', async () => {
      await mountPage()
      const description = get('[data-testid="catalog-detail-description"]')
      expect(description.text()).toContain('<b>sin HTML</b>')
      expect(description.find('b').exists()).toBe(false)
    })

    it('lists presentations from the smallest size up with their own price and stock label', async () => {
      await mountPage()
      const rows = findAll('[data-testid="catalog-detail-presentation"]')

      expect(
        rows.map((row) => row.get('[data-testid="catalog-detail-presentation-name"]').text()),
      ).toEqual(['2 kg', '8 kg', '20 kg'])
      expect(rows[0]!.text()).toContain(formatCentsMXN(22000))
      expect(rows[0]!.text()).toContain('Pocas piezas')
      expect(rows[1]!.text()).toContain('Disponible')
      expect(rows[2]!.text()).toContain('Agotado')
      expect(get('[data-testid="catalog-detail-presentations"]').text()).toContain('3 opciones')
    })

    it('keeps an out-of-stock presentation selectable and shows its own price and «Agotado»', async () => {
      await mountPage()
      const input = presentationInput('20 kg')

      expect(input.attributes('disabled')).toBeUndefined()
      await choose('20 kg')

      expect((input.element as HTMLInputElement).checked).toBe(true)
      expect(get('[data-testid="catalog-detail-price"]').text()).toContain(formatCentsMXN(168900))
      expect(get('[data-testid="catalog-detail-availability"]').text()).toBe(
        'Agotado en Sucursal Centro',
      )
      expect(get('[data-testid="catalog-detail-availability"]').attributes('data-tone')).toBe(
        'neutral',
      )
    })

    it('selects the first presentation when every presentation is out of stock', async () => {
      const detail = detailFixture()
      detail.variants = detail.variants.map((variant) => ({
        ...variant,
        availabilityByBranch: branchEntry('out_of_stock'),
        stockPresentation: systemStatus('out_of_stock'),
      }))
      fake.detail.value = detail
      await mountPage()

      expect((presentationInput('2 kg').element as HTMLInputElement).checked).toBe(true)
    })

    it('moves the selection with the keyboard through native radio inputs in one group', async () => {
      await mountPage()
      const inputs = findAll('[data-testid="catalog-detail-presentation"] input[type="radio"]')

      expect(new Set(inputs.map((input) => input.attributes('name'))).size).toBe(1)
      expect(get('[data-testid="catalog-detail-presentations"]').element.tagName).toBe('FIELDSET')
      expect(get('[data-testid="catalog-detail-presentations"] legend').text()).toBe('Presentación')
      ;(inputs[1]!.element as HTMLInputElement).focus()
      await choose('8 kg')
      expect(document.activeElement).toBe(inputs[1]!.element)
      expect(get('[data-testid="catalog-detail-price"]').text()).toContain(formatCentsMXN(74900))
    })

    it('shows «Consultar precio» for a hidden presentation price and no amount', async () => {
      const detail = detailFixture()
      detail.variants[1]!.price = { priceCents: null, hidden: true }
      fake.detail.value = detail
      await mountPage()

      expect(get('[data-testid="catalog-detail-price"]').text()).toBe('Consultar precio')
      const row = findAll('[data-testid="catalog-detail-presentation"]')[0]!
      expect(row.text()).toContain('Consultar precio')
    })

    it('uses the product price, stock and attributes when the product has no presentations', async () => {
      fake.detail.value = {
        ...detailFixture(),
        hasVariants: false,
        variants: [],
        price: { priceCents: 9900, hidden: false },
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: null, customQuantity: 0 },
        availability: null,
      }
      await mountPage()

      expect(find('[data-testid="catalog-detail-presentations"]').exists()).toBe(false)
      expect(get('[data-testid="catalog-detail-price"]').text()).toContain(formatCentsMXN(9900))
      expect(get('[data-testid="catalog-detail-quantity"]').text()).toBe('0 unidades')
      expect(find('[data-testid="catalog-detail-availability"]').exists()).toBe(false)
      expect(get('[data-testid="catalog-detail-specs"]').text()).toContain('Perro')
    })

    it('shows the characteristics of the selected presentation grouped by section', async () => {
      await mountPage()
      const groupsOf = () =>
        findAll('[data-testid="catalog-detail-spec-group"]').map((group) => group.text())

      expect(get('[data-testid="catalog-detail-specs-scope"]').text()).toBe('2 kg')
      expect(groupsOf()).toEqual([
        expect.stringContaining('Para quién'),
        expect.stringContaining('Contenido y empaque'),
      ])
      expect(groupsOf()[1]).toContain('2 kg')
      expect(groupsOf()[1]).not.toContain('Bolsa')

      await choose('8 kg')
      expect(get('[data-testid="catalog-detail-specs-scope"]').text()).toBe('8 kg')
      expect(groupsOf()[0]).toContain('Perro')
      expect(groupsOf()[1]).toContain('8 kg')
      expect(groupsOf()[1]).toContain('Bolsa')
    })

    it('explains a product with no description, presentations or characteristics', async () => {
      fake.detail.value = {
        ...detailFixture(),
        description: null,
        hasVariants: false,
        variants: [],
        attributes: [],
      }
      await mountPage()

      expect(get('[data-testid="catalog-detail-empty-note"]').text()).toContain(
        'Sin información adicional',
      )
    })

    it('exposes no WhatsApp, cart, quantity picker, rating or related products without v0 data', async () => {
      await mountPage()
      const text = body().text()

      expect(text).not.toMatch(/WhatsApp|Agregar|Carrito|Quedan|por kg|Ahorras|Más para/)
      expect(find('input[type="number"]').exists()).toBe(false)
    })
  })

  describe('gallery', () => {
    const mainImage = () => get('[data-testid="catalog-detail-main-image"]')

    it('starts on the product main image when the selected presentation has no image of its own', async () => {
      await mountPage()

      expect(mainImage().attributes('src')).toBe('https://example.test/main.jpg')
      expect(find('[data-testid="catalog-detail-gallery-caption"]').exists()).toBe(false)
      expect(findAll('[data-testid="catalog-detail-thumb"]')).toHaveLength(2)
    })

    it('follows the image of the selected presentation and labels it', async () => {
      await mountPage()
      await choose('8 kg')

      expect(mainImage().attributes('src')).toBe('https://example.test/8kg.jpg')
      expect(get('[data-testid="catalog-detail-gallery-caption"]').text()).toBe('Presentación 8 kg')
      const thumbs = findAll('[data-testid="catalog-detail-thumb"]')
      expect(thumbs).toHaveLength(3)
      expect(thumbs[0]!.attributes('aria-current')).toBe('true')

      await choose('2 kg')
      expect(mainImage().attributes('src')).toBe('https://example.test/main.jpg')
    })

    it('shows another image from its thumbnail and returns to the first one on a new presentation', async () => {
      await mountPage()
      await findAll('[data-testid="catalog-detail-thumb"]')[1]!.trigger('click')
      expect(mainImage().attributes('src')).toBe('https://example.test/side.jpg')

      await choose('8 kg')
      expect(mainImage().attributes('src')).toBe('https://example.test/8kg.jpg')
    })

    it('replaces a failed image with a written no-image state and no invented URL', async () => {
      await mountPage()
      await mainImage().trigger('error')

      expect(find('[data-testid="catalog-detail-main-image"]').exists()).toBe(false)
      const fallback = get('[data-testid="catalog-detail-image-fallback"]')
      expect(fallback.attributes('role')).toBe('img')
      expect(fallback.text()).toContain('Imagen no disponible')
      expect(find('[data-testid="catalog-detail-zoom"]').exists()).toBe(false)
    })

    it('shows the no-image state when the product publishes no media', async () => {
      fake.detail.value = { ...detailFixture(), images: [], variants: [] }
      await mountPage()

      expect(get('[data-testid="catalog-detail-image-fallback"]').attributes('aria-label')).toBe(
        'Imagen no disponible para Croqueta Nupec Cachorro',
      )
      expect(find('[data-testid="catalog-detail-thumb"]').exists()).toBe(false)
    })

    it('opens a labelled enlarged view of the shown image and closes it from its own control', async () => {
      await mountPage()
      await choose('8 kg')
      await get('[data-testid="catalog-detail-zoom"]').trigger('click')
      await flushPromises()

      const preview = get('[data-testid="catalog-detail-image-preview-img"]')
      expect(preview.attributes('src')).toBe('https://example.test/8kg.jpg')
      expect(body().text()).toContain('Vista ampliada de imagen')

      await get('[data-testid="catalog-detail-image-preview-close"]').trigger('click')
      await flushPromises()
      expect(find('[data-testid="catalog-detail-image-preview-img"]').exists()).toBe(false)
    })
  })

  describe('breadcrumb', () => {
    it('leads back to the same listing, naming the category the shopper came from', async () => {
      await mountPage(
        '/catalogo/centro/p/product-1?priceListId=list-2&categoryId=11111111-1111-4111-8111-111111111111&page=2',
      )
      const back = get('[data-testid="catalog-detail-back"]')
      const target = resolveHref('[data-testid="catalog-detail-back"]')

      expect(back.text()).toBe('Volver a Alimento para perro')
      expect(target.name).toBe('public-catalog')
      expect(target.params.branchSlug).toBe('centro')
      expect(target.query).toEqual({
        priceListId: 'list-2',
        categoryId: '11111111-1111-4111-8111-111111111111',
        page: '2',
      })
    })

    it('reads «Volver al catálogo» when the shopper did not come from that category', async () => {
      await mountPage('/catalogo/centro/p/product-1?priceListId=list-2&q=croqueta')
      expect(get('[data-testid="catalog-detail-back"]').text()).toBe('Volver al catálogo')
      expect(resolveHref('[data-testid="catalog-detail-back"]').query).toEqual({
        priceListId: 'list-2',
        q: 'croqueta',
      })
    })

    it('links the catalog and the category crumbs keeping only the price list', async () => {
      await mountPage('/catalogo/centro/p/product-1?priceListId=list-2&page=3')
      const crumbs = get('[data-testid="catalog-detail-crumbs"]')
      const links = crumbs.findAll('a')

      expect(links.map((link) => link.text())).toEqual(['Catálogo', 'Alimento para perro'])
      expect(router.resolve(links[0]!.attributes('href')!).query).toEqual({ priceListId: 'list-2' })
      expect(router.resolve(links[1]!.attributes('href')!).query).toEqual({
        priceListId: 'list-2',
        categoryId: '11111111-1111-4111-8111-111111111111',
      })
      expect(crumbs.get('[aria-current="page"]').text()).toBe('Croqueta Nupec Cachorro')
    })
  })

  describe('share', () => {
    const copyShare = () => get('[data-testid="catalog-detail-share-copy"]')
    const nativeShare = () => get('[data-testid="catalog-detail-share-native"]')

    it('copies the share-preview URL with its price list and confirms «Enlace copiado»', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
      await mountPage('/catalogo/centro/p/product-1?priceListId=list-2&page=3')

      await copyShare().trigger('click')
      await flushPromises()

      expect(writeText).toHaveBeenCalledTimes(1)
      const shared = new URL(writeText.mock.calls[0]![0] as string)
      // The preview route lives on the API host; it redirects people to the storefront page.
      expect(shared.origin).toBe('http://localhost:3000')
      expect(shared.pathname).toBe('/share/centro/p/product-1')
      expect(Object.fromEntries(shared.searchParams)).toEqual({ priceListId: 'list-2' })
      const toast = get('[data-testid="catalog-detail-share-feedback"]')
      expect(toast.text()).toBe('Enlace copiado')
      expect(toast.attributes('role')).toBe('status')
    })

    it('says so when the link cannot be copied', async () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      })
      await mountPage()

      await copyShare().trigger('click')
      await flushPromises()

      expect(get('[data-testid="catalog-detail-share-feedback"]').text()).toBe(
        'No se pudo copiar el enlace',
      )
    })

    it('uses the native share sheet on the mobile control when the browser offers one', async () => {
      const share = vi.fn().mockResolvedValue(undefined)
      const writeText = vi.fn()
      vi.stubGlobal('navigator', { ...navigator, share, clipboard: { writeText } })
      await mountPage()

      await nativeShare().trigger('click')
      await flushPromises()

      expect(share).toHaveBeenCalledWith({
        title: 'Croqueta Nupec Cachorro',
        url: 'http://localhost:3000/share/centro/p/product-1?priceListId=list-1',
      })
      expect(writeText).not.toHaveBeenCalled()
    })

    it('copies on the mobile control when there is no native share sheet', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })
      await mountPage()

      await nativeShare().trigger('click')
      await flushPromises()

      expect(writeText).toHaveBeenCalledTimes(1)
      expect(get('[data-testid="catalog-detail-share-feedback"]').text()).toBe('Enlace copiado')
    })

    it('stays quiet when the shopper dismisses the native share sheet', async () => {
      const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
      const writeText = vi.fn()
      vi.stubGlobal('navigator', { share, clipboard: { writeText } })
      await mountPage()

      await nativeShare().trigger('click')
      await flushPromises()

      expect(writeText).not.toHaveBeenCalled()
      expect(find('[data-testid="catalog-detail-share-feedback"]').exists()).toBe(false)
    })
  })

  describe('states', () => {
    it.each(['loading', 'retry-pending'] as const)(
      'reserves the page with a skeleton while %s',
      async (state) => {
        fake.detail.value = null
        fake.detailState.value = state
        await mountPage()

        const loading = get('[data-testid="catalog-detail-loading"]')
        expect(loading.attributes('aria-busy')).toBe('true')
        expect(loading.text()).toContain('Cargando producto…')
        expect(find('h1').exists()).toBe(false)
      },
    )

    it('shows the skeleton while the branches are still loading', async () => {
      fake.branchesState.value = 'loading'
      fake.branches.value = []
      await mountPage()
      expect(find('[data-testid="catalog-detail-loading"]').exists()).toBe(true)
    })

    it('reads a missing or unpublished product as «Este producto ya no está disponible» with a way back', async () => {
      fake.detail.value = null
      fake.detailState.value = 'not-found'
      await mountPage('/catalogo/centro/p/gone?priceListId=list-2&page=2')

      const notice = get('[data-testid="catalog-detail-notice"]')
      expect(notice.get('h1').text()).toBe('Este producto ya no está disponible')
      expect(notice.attributes('role')).toBe('status')
      expect(notice.find('[data-testid="catalog-detail-retry"]').exists()).toBe(false)
      const link = notice.get('a')
      expect(link.text()).toBe('Ver el catálogo')
      const target = router.resolve(link.attributes('href')!)
      expect(target.name).toBe('public-catalog')
      expect(target.query).toEqual({ priceListId: 'list-2', page: '2' })
    })

    it.each([
      ['network', 'Revisa tu conexión'],
      ['server', 'Inténtalo de nuevo'],
      ['rate-limit', 'Espera unos segundos'],
    ] as const)('offers a retry for a %s failure', async (state, copy) => {
      fake.detail.value = null
      fake.detailState.value = state
      await mountPage()

      const notice = get('[data-testid="catalog-detail-notice"]')
      expect(notice.attributes('role')).toBe('alert')
      expect(notice.text()).toContain('No pudimos cargar el producto')
      expect(notice.text()).toContain(copy)
      await get('[data-testid="catalog-detail-retry"]').trigger('click')
      expect(fake.retryDetail).toHaveBeenCalledTimes(1)
    })

    it('offers a retry when the branches fail to load', async () => {
      fake.branchesState.value = 'network'
      fake.branches.value = []
      await mountPage()

      await get('[data-testid="catalog-detail-retry"]').trigger('click')
      expect(fake.retryBranches).toHaveBeenCalledTimes(1)
    })

    it('says the branch does not publish its catalog and offers the published branches', async () => {
      await mountPage('/catalogo/sur/p/product-1?priceListId=list-1')

      const notice = get('[data-testid="catalog-detail-notice"]')
      expect(notice.get('h1').text()).toBe('Esta sucursal aún no publica su catálogo')
      const links = notice.findAll('a')
      expect(links.map((link) => link.text())).toEqual([
        'Ver catálogo de Sucursal Centro',
        'Ver catálogo de Sucursal Norte',
      ])
      expect(router.resolve(links[1]!.attributes('href')!).params.branchSlug).toBe('norte')
    })
  })
})

describe('CatalogProductView v0 extras', () => {
  const number = '+5215500000000'
  const withNumber = () => {
    fake.branches.value = [{ ...branches[0]!, whatsappNumber: number }, branches[1]!]
  }
  const waLinks = () => findAll('[data-testid="catalog-whatsapp-link"]')
  const messageOf = (link: ReturnType<typeof waLinks>[number]) =>
    new URL(link.attributes('href')!).searchParams.get('text')!

  const contentAttribute = (value: number, unit: string, code = 'measure.net_mass') =>
    ({
      code,
      label: 'Contenido',
      facet: false,
      section: packSection,
      value: { type: 'number', value, unit: { code: unit, label: unit } },
      display: `${value} ${unit}`,
    }) satisfies PublicProductAttribute
  const withContents = (units: [string, string, string]) => {
    const detail = fake.detail.value!
    const contents: Record<string, [number, string]> = {
      'v-2': [2, units[0]],
      'v-8': [8, units[1]],
      'v-20': [20, units[2]],
    }
    fake.detail.value = {
      ...detail,
      variants: detail.variants.map((variant) => ({
        ...variant,
        attributes: [contentAttribute(...contents[variant.id]!)],
      })),
    }
  }

  describe('WhatsApp', () => {
    it('renders no WhatsApp UI at all without a number', async () => {
      await mountPage()
      expect(waLinks()).toHaveLength(0)
      expect(find('[data-testid="catalog-detail-sticky-bar"]').exists()).toBe(false)
      expect(body().html()).not.toMatch(/wa\.me|WhatsApp/)
    })

    it('offers «Pedir por WhatsApp» naming product, presentation, branch and page', async () => {
      withNumber()
      await mountPage('/catalogo/centro/p/product-1?priceListId=list-1&page=2')
      const cta = waLinks()[0]!
      const url = new URL(cta.attributes('href')!)
      expect(url.origin + url.pathname).toBe('https://wa.me/5215500000000')
      expect(cta.text()).toBe('Pedir por WhatsApp')
      const text = messageOf(cta)
      expect(text).toContain('Croqueta Nupec Cachorro')
      expect(text).toContain('2 kg')
      expect(text).toContain('Sucursal Centro')
      expect(text).toContain('/catalogo/centro/p/product-1?priceListId=list-1')
      expect(text).not.toContain('page=2')
    })

    it('tells what the WhatsApp button will send, only when the button renders', async () => {
      await mountPage()
      expect(find('[data-testid="catalog-detail-whatsapp-hint"]').exists()).toBe(false)

      withNumber()
      await mountPage()
      const hint = get('[data-testid="catalog-detail-whatsapp-hint"]')
      expect(hint.text()).toContain('Abrirá WhatsApp con este mensaje: «Hola, quiero Croqueta Nupec Cachorro 2 kg · Sucursal Centro')
      expect(hint.text().endsWith('»')).toBe(true)
      await choose('20 kg')
      expect(get('[data-testid="catalog-detail-whatsapp-hint"]').text()).toContain(
        '¿cuándo vuelve Croqueta Nupec Cachorro 20 kg?',
      )
    })

    it('follows the selected presentation and asks («Preguntar») when it is sold out', async () => {
      withNumber()
      await mountPage()
      await choose('20 kg')
      const cta = waLinks()[0]!
      expect(cta.text()).toBe('Preguntar por WhatsApp')
      expect(messageOf(cta)).toContain('¿cuándo vuelve Croqueta Nupec Cachorro 20 kg?')
    })

    it('takes the number from the branch card when the branches list has none', async () => {
      fake.branchDetail.value = {
        name: 'Sucursal Centro',
        phone: null,
        address: null,
        hours: null,
        pickupAvailable: false,
        deliveryAvailable: false,
        whatsappNumber: number,
      }
      await mountPage()
      expect(new URL(waLinks()[0]!.attributes('href')!).pathname).toBe('/5215500000000')
    })

    it('shows the mobile bar with price, «Cambiar» and the same WhatsApp action', async () => {
      withNumber()
      await mountPage()
      const bar = get('[data-testid="catalog-detail-sticky-bar"]')
      expect(bar.get('[data-testid="catalog-sticky-price"]').text()).toContain(formatCentsMXN(22000))
      expect(bar.get('[data-testid="catalog-sticky-line"]').text().replace(/\s+/g, ' ')).toBe(
        '2 kg · Cambiar',
      )
      expect(bar.find('[data-testid="catalog-whatsapp-link"]').exists()).toBe(true)
      const scrollIntoView = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoView
      await bar.get('[data-testid="catalog-sticky-change"]').trigger('click')
      await flushPromises()
      expect(scrollIntoView).toHaveBeenCalled()
      expect(document.activeElement).toBe(presentationInput('2 kg').element)
    })
  })

  describe('branch block', () => {
    const card = (overrides: Partial<PublicCatalogBranchDetailDto> = {}): PublicCatalogBranchDetailDto => ({
      name: 'Sucursal Centro',
      phone: null,
      address: { formatted: 'Dirección formateada por el backend' },
      hours: {
        timeZone: 'America/Mexico_City',
        days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map(
          (day) => ({ day, label: day, closed: false, ranges: [{ open: '08:00', close: '17:00' }] }),
        ),
        summary: 'Resumen del backend',
      },
      pickupAvailable: true,
      deliveryAvailable: false,
      whatsappNumber: null,
      ...overrides,
    })

    it('renders nothing without a branch card (404, network error or backend without v0)', async () => {
      await mountPage()
      expect(find('[data-testid="catalog-branch-block"]').exists()).toBe(false)
    })

    it('shows the address, today\'s hours and only the flagged pickup / delivery lines', async () => {
      fake.branchDetail.value = card()
      await mountPage()
      const block = get('[data-testid="catalog-branch-block"]')
      expect(block.get('[data-testid="catalog-branch-address"]').text()).toBe(
        'Dirección formateada por el backend',
      )
      expect(block.get('[data-testid="catalog-branch-hours"]').text()).toBe('Abierto hoy 08:00–17:00')
      expect(block.find('[data-testid="catalog-branch-pickup"]').exists()).toBe(true)
      expect(block.find('[data-testid="catalog-branch-delivery"]').exists()).toBe(false)
    })

    it('falls back to the summary when hours or address are missing', async () => {
      fake.branchDetail.value = card({
        address: null,
        pickupAvailable: false,
        deliveryAvailable: true,
        hours: { timeZone: 'Not/AZone', days: [], summary: 'Resumen del backend' },
      })
      await mountPage()
      const block = get('[data-testid="catalog-branch-block"]')
      expect(block.get('[data-testid="catalog-branch-hours"]').text()).toBe('Resumen del backend')
      expect(block.find('[data-testid="catalog-branch-address"]').exists()).toBe(false)
      expect(block.find('[data-testid="catalog-branch-pickup"]').exists()).toBe(false)
      expect(block.find('[data-testid="catalog-branch-delivery"]').exists()).toBe(true)
    })

    it('renders no block for a branch with nothing configured', async () => {
      fake.branchDetail.value = card({ address: null, hours: null, pickupAvailable: false })
      await mountPage()
      expect(find('[data-testid="catalog-branch-block"]').exists()).toBe(false)
    })
  })

  describe('presentation labels', () => {
    it('shows only what follows the product name in tiles, meta line, caption and bar', async () => {
      withNumber()
      const detail = fake.detail.value!
      fake.detail.value = {
        ...detail,
        variants: detail.variants.map((variant) => ({
          ...variant,
          name: `${detail.name} ${variant.name}`,
        })),
      }
      await mountPage()
      expect(
        findAll('[data-testid="catalog-detail-presentation-name"]').map((entry) => entry.text()),
      ).toEqual(['2 kg', '8 kg', '20 kg'])
      expect(get('[data-testid="catalog-detail-meta"]').text()).toBe('Presentación 2 kg')
      await choose('8 kg')
      expect(get('[data-testid="catalog-detail-gallery-caption"]').text()).toBe('Presentación 8 kg')
      expect(get('[data-testid="catalog-sticky-line"]').text().replace(/\s+/g, ' ')).toBe(
        '8 kg · Cambiar',
      )
      const message = new URL(waLinks()[0]!.attributes('href')!).searchParams.get('text')!
      expect(message).toContain('Hola, quiero Croqueta Nupec Cachorro 8 kg')
    })
  })

  describe('unit price', () => {
    it('shows the price per unit and «Ahorras N %» when every presentation shares the unit', async () => {
      withContents(['kg', 'kg', 'kg'])
      await mountPage()
      expect(get('[data-testid="catalog-detail-meta"]').text()).toBe(
        'Presentación 2 kg · $110.00 por kg',
      )
      expect(
        findAll('[data-testid="catalog-detail-presentation-unit"]').map((entry) => entry.text()),
      ).toEqual(['$110.00/kg', '$93.63/kg', '$84.45/kg'])
      const savings = findAll('[data-testid="catalog-detail-presentation-saving"]').map((entry) =>
        entry.text(),
      )
      expect(savings).toEqual(['Ahorras 15 % vs 2 kg', 'Ahorras 23 % vs 2 kg'])
      await choose('8 kg')
      expect(get('[data-testid="catalog-detail-meta"]').text()).toBe(
        'Presentación 8 kg · $93.63 por kg',
      )
    })

    it('shows nothing when the units differ or the data is absent (as today)', async () => {
      withContents(['kg', 'g', 'kg'])
      await mountPage()
      expect(find('[data-testid="catalog-detail-unit-price"]').exists()).toBe(false)
      expect(find('[data-testid="catalog-detail-presentation-unit"]').exists()).toBe(false)
      expect(find('[data-testid="catalog-detail-presentation-saving"]').exists()).toBe(false)
    })
  })

  describe('exact stock', () => {
    it('writes «Quedan N» for the selected presentation when the backend sends it', async () => {
      const detail = fake.detail.value!
      fake.detail.value = {
        ...detail,
        variants: detail.variants.map((variant) =>
          variant.id === 'v-2'
            ? {
                ...variant,
                stockPresentation: {
                  mode: 'SYSTEM_STATUS_EXACT_LOW_STOCK',
                  status: 'low_stock',
                  customQuantity: null,
                  exactQuantity: 3,
                },
              }
            : variant,
        ),
      }
      await mountPage()
      // The quantity lives in the availability pill and the tile, never on a line of its own.
      expect(get('[data-testid="catalog-detail-availability"]').text()).toBe(
        'Quedan 3 en Sucursal Centro',
      )
      expect(find('[data-testid="catalog-detail-quantity"]').exists()).toBe(false)
      expect(presentationInput('2 kg').element.closest('label')?.textContent).toContain('Quedan 3')
      await choose('8 kg')
      expect(get('[data-testid="catalog-detail-availability"]').text()).toBe(
        'Disponible en Sucursal Centro',
      )
    })
  })
})
