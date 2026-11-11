import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { DOMWrapper, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWithUApp } from '../../../../test/mountWithUApp'
import CatalogView from '../CatalogView.vue'
import type { PublicCatalogPriceContextDto } from '../../interfaces/public-catalog-price-context.types'

const colorMode = shallowRef<'light' | 'dark'>('light')
const catalogProductsOverride = vi.hoisted(() => ({
  current: null as null | (() => unknown),
}))
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useColorMode: () => colorMode,
}))
vi.mock('@/features/catalog/composables/useCatalogProducts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/catalog/composables/useCatalogProducts')>()
  return {
    ...actual,
    useCatalogProducts: (...args: Parameters<typeof actual.useCatalogProducts>) =>
      (catalogProductsOverride.current?.() ?? actual.useCatalogProducts(...args)) as ReturnType<
        typeof actual.useCatalogProducts
      >,
  }
})

const UButton = defineComponent({
  inheritAttrs: false,
  props: { disabled: Boolean },
  setup:
    (props, { attrs, slots }) =>
    () =>
      h('button', { ...attrs, disabled: props.disabled }, [
        slots.leading?.(),
        slots.default?.(),
        slots.trailing?.(),
      ]),
})
const UInput = defineComponent({
  inheritAttrs: false,
  props: { modelValue: String, disabled: Boolean },
  setup:
    (props, { attrs }) =>
    () =>
      h('input', { ...attrs, value: props.modelValue, disabled: props.disabled }),
})
const stubs = {
  UButton,
  UInput,
  UIcon: defineComponent({ setup: () => () => h('span') }),
}

const branches = [
  { id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null },
  { id: 'b-2', name: 'Sucursal Norte', slug: 'norte', address: null, phone: null },
]
const priceContexts: PublicCatalogPriceContextDto[] = [
  { priceListId: 'list-1', name: 'Público', isCatalogDefault: true },
  { priceListId: 'list-mayoreo', name: 'Mayoreo', isCatalogDefault: false },
]
const priceContext = priceContexts[0]!
const product = {
  id: 'product-1',
  name: 'Café molido',
  slug: null,
  description: null,
  category: { id: 'coffee', name: 'Café' },
  brand: { name: 'Tostadores' },
  image: null,
  price: { fromPriceCents: 2500, priceCents: 2500, hidden: false },
  availability: 'available',
  stockPresentation: { mode: 'SYSTEM_STATUS', status: 'available', customQuantity: null },
  hasVariants: false,
  rating: null,
  featuredLabel: null,
}
const productsResponse = (items = [product]) => ({
  items,
  meta: { page: 1, limit: 20, total: items.length, totalPages: items.length === 0 ? 0 : 1 },
  facets: { categories: [] },
  excludedCount: 0,
  priceContext,
})
const productsResponseFor = (priceListId: string, items = [product]) => {
  const context = priceContexts.find((entry) => entry.priceListId === priceListId)
  return {
    ...productsResponse(items),
    priceContext: context ?? { priceListId, name: priceListId, isCatalogDefault: false },
  }
}
const detailResponse = (overrides = {}) => ({
  id: product.id,
  name: product.name,
  slug: null,
  description: null,
  category: null,
  brand: null,
  images: [],
  price: { priceCents: 2500, hidden: false },
  availability: 'available',
  stockPresentation: { mode: 'SYSTEM_STATUS', status: 'available', customQuantity: null },
  hasVariants: false,
  variants: [],
  rating: null,
  featuredLabel: null,
  priceContext,
  excludedCount: 0,
  ...overrides,
})
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const categoryId = '11111111-1111-4111-8111-111111111111'
const categoryFacets = [{ id: categoryId, name: 'Café', count: 3 }]
const toysId = '22222222-2222-4222-8222-222222222222'
const categoryPage = (filtered: boolean) => ({
  ...productsResponse(filtered ? [{ ...product, name: 'Café filtrado' }] : [product]),
  meta: { page: 1, limit: 20, total: filtered ? 1 : 4, totalPages: 1 },
  facets: { categories: filtered ? [] : categoryFacets },
})
const productsUrl = (slug: string) => `http://localhost:3000/public/catalog/${slug}/products`

const isBranchCardRequest = (input: RequestInfo | URL) =>
  /\/public\/catalog\/[^/]+\/branch(?:\?|$)/.test(String(input))
/**
 * Installs `fetchMock` as the global fetch, answering the footer's branch-card request
 * (GET /public/catalog/:slug/branch) with a 404, «no branch card». The request never reaches
 * `fetchMock`, so sequenced `mockResolvedValueOnce` chains and call counts stay about the listing.
 */
function stubCatalogFetch(
  fetchMock: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    isBranchCardRequest(input)
      ? Promise.resolve(new Response('{}', { status: 404 }))
      : fetchMock(input, init),
  )
}

type CatalogFetchOverrides = {
  contexts?: (slug: string) => Response | Promise<Response>
  products?: (slug: string, priceListId: string | null, url: URL) => Response | Promise<Response>
  detail?: () => Response | Promise<Response>
}

/** URL-routed fetch double: branches, then per-slug discovery, then products/detail. */
function createCatalogFetch(overrides: CatalogFetchOverrides = {}) {
  return vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (isBranchCardRequest(input)) return Promise.resolve(new Response('{}', { status: 404 }))
    if (url.endsWith('/public/catalog/branches')) return Promise.resolve(jsonResponse(branches))

    const contextsMatch = url.match(/\/public\/catalog\/([^/]+)\/price-contexts$/)
    if (contextsMatch) {
      return Promise.resolve(
        overrides.contexts ? overrides.contexts(contextsMatch[1]!) : jsonResponse(priceContexts),
      )
    }

    const detailMatch = url.match(/\/public\/catalog\/([^/]+)\/products\/([^/?]+)/)
    if (detailMatch) {
      return Promise.resolve(overrides.detail ? overrides.detail() : jsonResponse(detailResponse()))
    }

    const productsMatch = url.match(/\/public\/catalog\/([^/]+)\/products/)
    if (productsMatch) {
      const slug = productsMatch[1]!
      const priceListId = new URL(url).searchParams.get('priceListId')
      return Promise.resolve(
        overrides.products
          ? overrides.products(slug, priceListId, new URL(url))
          : jsonResponse(productsResponseFor(priceListId ?? 'list-1')),
      )
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`))
  })
}

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/catalogo/:branchSlug?', name: 'public-catalog', component: CatalogView },
      // The card links to the detail page (T2); the listing never renders it.
      {
        path: '/catalogo/:branchSlug/p/:productId',
        name: 'public-catalog-product',
        component: defineComponent({ setup: () => () => h('p', 'detalle') }),
      },
    ],
  })
  await router.push(path)
  await router.isReady()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mountWithUApp(CatalogView, {
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient }], [router]], stubs },
  })
  return { wrapper, router }
}

function findSelectMenu(wrapper: VueWrapper) {
  return wrapper.getComponent({ name: 'SelectMenu' })
}

/** Teleported branch dialogs never leak into the next test's document queries. */
afterEach(() => {
  document.body.innerHTML = ''
})

const branchTrigger = (wrapper: VueWrapper) =>
  wrapper.get('button[aria-label="Explorar sucursales"]')

async function openBranchSelector(wrapper: VueWrapper) {
  await branchTrigger(wrapper).trigger('click')
  await flushPromises()
}

/** The open dialog is reached through the trigger's native `aria-controls`, never a global query. */
function branchDialogElement(wrapper: VueWrapper) {
  const controls = branchTrigger(wrapper).element.getAttribute('aria-controls')
  return controls === null ? null : document.getElementById(controls)
}

function branchDialog(wrapper: VueWrapper) {
  const element = branchDialogElement(wrapper)
  expect(element, 'the branch selector dialog must be open').not.toBeNull()
  return new DOMWrapper(element!)
}

/** Every enabled control anywhere on the page, keyed by its accessible label. */
function enabledControlLabels() {
  return [...document.querySelectorAll('button')]
    .filter((button) => !button.disabled)
    .map((button) => button.getAttribute('aria-label') ?? (button.textContent ?? '').trim())
    .sort()
}

function waitForNavigation(router: ReturnType<typeof createRouter>) {
  return new Promise<void>((resolve) => {
    const remove = router.afterEach(() => {
      remove()
      resolve()
    })
  })
}

const requestUrls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(([url]) => String(url))
const productRequestUrls = (fetchMock: ReturnType<typeof vi.fn>) =>
  requestUrls(fetchMock).filter((url) => url.includes('/products'))
const lastProductRequestUrl = (fetchMock: ReturnType<typeof vi.fn>) => {
  const urls = productRequestUrls(fetchMock)
  return urls[urls.length - 1]
}
/** Card markup belongs to the card (T2); the listing only promises the names in its grid. */
const gridText = (wrapper: VueWrapper) => wrapper.get('[data-testid="catalog-product-grid"]').text()

/** The header «Categorías» menu: a closed disclosure until the visitor opens it. */
const categoriesTrigger = (wrapper: VueWrapper) =>
  wrapper.get('.catalog-header-categories button[aria-expanded]')
async function openCategories(wrapper: VueWrapper) {
  if (categoriesTrigger(wrapper).attributes('aria-expanded') !== 'true') {
    await categoriesTrigger(wrapper).trigger('click')
    await flushPromises()
  }
  return wrapper.get('[data-testid="catalog-category-menu"]')
}
/** A menu entry by its leading label (`Café 3`, `Todas las categorías 4`). */
async function categoryEntry(wrapper: VueWrapper, label: string) {
  const menu = await openCategories(wrapper)
  return menu.findAll('button').find((button) => button.text().startsWith(`${label} `))
}
const chipButton = (wrapper: VueWrapper, label: string) =>
  wrapper.find(`[aria-label="Filtros activos"] button[aria-label="${label}"]`)

describe('CatalogView public browse', () => {
  beforeEach(() => {
    colorMode.value = 'light'
    catalogProductsOverride.current = null
    vi.restoreAllMocks()
  })

  it('selects a discovered branch through the URL, preserves query/hash, and renders its first real product page', async () => {
    const fetchMock = createCatalogFetch()
    stubCatalogFetch(fetchMock)
    const { wrapper, router } = await mountAt('/catalogo?source=home#top')

    await flushPromises()
    expect(branchTrigger(wrapper).attributes('aria-haspopup')).toBe('dialog')
    expect(branchTrigger(wrapper).attributes('aria-expanded')).toBe('false')
    expect(branchTrigger(wrapper).text()).toContain('Elegir sucursal')
    expect(branchDialogElement(wrapper)).toBeNull()
    expect(wrapper.find('button[aria-label="Sucursal Centro"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="catalog-price-context-selector"]').exists()).toBe(false)
    expect(wrapper.get('.catalog-hero img').attributes('src')).toBe(
      '/images/catalog-companions.png',
    )
    expect(wrapper.get('.catalog-hero a').attributes('href')).toBe('#catalogo')
    expect(wrapper.get('#catalogo').attributes('tabindex')).toBe('-1')

    await openBranchSelector(wrapper)
    await branchDialog(wrapper).get('button[aria-label="Sucursal Centro"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/catalogo/centro?source=home#top')
    expect(branchTrigger(wrapper).attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('button[aria-label="Sucursal Centro"]').exists()).toBe(false)
    expect(branchTrigger(wrapper).get('strong').text()).toBe('Centro')
    expect(requestUrls(fetchMock)).toEqual([
      'http://localhost:3000/public/catalog/branches',
      'http://localhost:3000/public/catalog/centro/price-contexts',
      productsUrl('centro'),
    ])
    expect(findSelectMenu(wrapper).props('modelValue')).toBe('list-1')
    expect(gridText(wrapper)).toContain('Café molido')
    for (const label of ['Buscar en el catálogo', 'Ver carrito', 'Ordenar catálogo']) {
      expect(wrapper.find(`[aria-label="${label}"]`).exists()).toBe(false)
    }
    expect(wrapper.findAll('[role="dialog"], a[href^="tel:"], a[href*="whatsapp"]').length).toBe(0)
  })

  it('loads a direct valid slug and keeps branch selection synchronized through back and forward navigation', async () => {
    const centroProduct = { ...product, id: 'centro-product', name: 'Producto Centro' }
    const norteProduct = { ...product, id: 'norte-product', name: 'Producto Norte' }
    const fetchMock = createCatalogFetch({
      products: (slug) =>
        jsonResponse(
          productsResponseFor('list-1', [slug === 'centro' ? centroProduct : norteProduct]),
        ),
    })
    stubCatalogFetch(fetchMock)
    const { wrapper, router } = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(branchTrigger(wrapper).get('strong').text()).toBe('Centro')
    expect(gridText(wrapper)).toContain('Producto Centro')

    await openBranchSelector(wrapper)
    const dialog = branchDialog(wrapper)
    expect(dialog.get('button[aria-label="Sucursal Centro"]').attributes('aria-current')).toBe(
      'page',
    )
    expect(
      dialog.get('button[aria-label="Sucursal Norte"]').attributes('aria-current'),
    ).toBeUndefined()
    await dialog.get('button[aria-label="Cerrar selección de sucursal"]').trigger('click')
    await flushPromises()
    expect(branchDialogElement(wrapper)).toBeNull()
    expect(branchTrigger(wrapper).element).toBe(document.activeElement)

    await router.push('/catalogo/norte')
    await flushPromises()
    expect(branchTrigger(wrapper).get('strong').text()).toBe('Norte')
    expect(gridText(wrapper)).toContain('Producto Norte')

    const back = waitForNavigation(router)
    router.back()
    await back
    await flushPromises()
    expect(branchTrigger(wrapper).get('strong').text()).toBe('Centro')
    expect(gridText(wrapper)).toContain('Producto Centro')

    const forward = waitForNavigation(router)
    router.forward()
    await forward
    await flushPromises()
    expect(branchTrigger(wrapper).get('strong').text()).toBe('Norte')
    expect(gridText(wrapper)).toContain('Producto Norte')
  })

  it.each([
    ['/catalogo', 'Elige una sucursal para explorar el catálogo'],
    ['/catalogo/desconocida', 'Esta sucursal aún no publica su catálogo'],
  ])('does not request products for %s', async (path, expectedHeading) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(branches))
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt(path)

    await flushPromises()
    expect(
      wrapper.get('#catalogo :is(.hf-empty-state__title, .catalog-listing-state h3)').text(),
    ).toBe(expectedHeading)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3000/public/catalog/branches')
  })

  it('does not claim a new branch selection when navigation is rejected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(branches))
    stubCatalogFetch(fetchMock)
    const { wrapper, router } = await mountAt('/catalogo')
    const push = vi.spyOn(router, 'push').mockRejectedValueOnce(new Error('navigation blocked'))

    await flushPromises()
    await openBranchSelector(wrapper)
    await branchDialog(wrapper).get('button[aria-label="Sucursal Norte"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/catalogo')
    expect(branchTrigger(wrapper).text()).toContain('Elegir sucursal')

    await openBranchSelector(wrapper)
    expect(
      branchDialog(wrapper).get('button[aria-label="Sucursal Norte"]').attributes('aria-current'),
    ).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    [429, 'Demasiadas consultas seguidas'],
    [500, 'No pudimos cargar el catálogo'],
    ['network', 'No pudimos cargar el catálogo'],
  ])(
    'renders the %s product failure state and retries through the DOM',
    async (failure, expectedCopy) => {
      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(branches))
      fetchMock.mockResolvedValueOnce(jsonResponse(priceContexts))
      if (failure === 'network') fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      else fetchMock.mockResolvedValueOnce(jsonResponse(productsResponse(), failure as number))
      fetchMock.mockResolvedValueOnce(jsonResponse(productsResponse([])))
      stubCatalogFetch(fetchMock)
      const { wrapper } = await mountAt('/catalogo/centro')

      await flushPromises()
      expect(wrapper.text()).toContain(expectedCopy)
      await wrapper.get('[data-testid="catalog-retry-products"]').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('No hay productos disponibles en este momento')
      expect(fetchMock).toHaveBeenCalledTimes(4)
    },
  )

  it('renders loading and guarded retry-pending product states before populated and empty outcomes', async () => {
    let resolveInitial!: (value: Response) => void
    let resolveRetry!: (value: Response) => void
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(branches))
      .mockResolvedValueOnce(jsonResponse(priceContexts))
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveInitial = resolve
        }),
      )
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveRetry = resolve
        }),
      )
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(wrapper.text()).toContain('Cargando productos…')
    resolveInitial(jsonResponse(productsResponse([])))
    await flushPromises()
    expect(wrapper.text()).toContain('No hay productos disponibles en este momento')

    void wrapper.get('[data-testid="catalog-retry-products"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Reintentando productos…')
    expect(wrapper.find('[data-testid="catalog-retry-products"]').exists()).toBe(false)
    resolveRetry(jsonResponse(productsResponse()))
    await flushPromises()
    expect(gridText(wrapper)).toContain('Café molido')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('refetches under the explicit context when the visitor switches price list', async () => {
    const fetchMock = createCatalogFetch()
    stubCatalogFetch(fetchMock)
    const { wrapper, router } = await mountAt('/catalogo/centro')

    await flushPromises()
    await router.push('/catalogo/centro?priceListId=list-mayoreo')
    await flushPromises()

    expect(lastProductRequestUrl(fetchMock)).toBe(
      `${productsUrl('centro')}?priceListId=list-mayoreo`,
    )
    expect(findSelectMenu(wrapper).props('modelValue')).toBe('list-mayoreo')
  })

  it('uses the discovered default without inventing an explicit priceListId', async () => {
    const fetchMock = createCatalogFetch()
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(productRequestUrls(fetchMock)).toEqual([productsUrl('centro')])
    expect(findSelectMenu(wrapper).props('modelValue')).toBe('list-1')
    expect(wrapper.get('[aria-label="Lista de precios"]').text()).toContain('Público')
  })

  it('sends the exact Mayoreo context the visitor proposed', async () => {
    const fetchMock = createCatalogFetch()
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro?priceListId=list-mayoreo')

    await flushPromises()
    expect(productRequestUrls(fetchMock)).toEqual([
      `${productsUrl('centro')}?priceListId=list-mayoreo`,
    ])
    expect(findSelectMenu(wrapper).props('modelValue')).toBe('list-mayoreo')
  })

  it('writes the selected context into the URL and restores it on back and forward', async () => {
    const fetchMock = createCatalogFetch()
    stubCatalogFetch(fetchMock)
    const { wrapper, router } = await mountAt('/catalogo/centro')

    await flushPromises()
    findSelectMenu(wrapper).vm.$emit('update:modelValue', 'list-mayoreo')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/catalogo/centro?priceListId=list-mayoreo')
    expect(lastProductRequestUrl(fetchMock)).toBe(
      `${productsUrl('centro')}?priceListId=list-mayoreo`,
    )

    const back = waitForNavigation(router)
    router.back()
    await back
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/catalogo/centro')
    expect(findSelectMenu(wrapper).props('modelValue')).toBe('list-1')

    const forward = waitForNavigation(router)
    router.forward()
    await forward
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/catalogo/centro?priceListId=list-mayoreo')
    expect(findSelectMenu(wrapper).props('modelValue')).toBe('list-mayoreo')
  })

  it('drops only the previous priceListId when the branch changes while preserving query and hash', async () => {
    const fetchMock = createCatalogFetch()
    stubCatalogFetch(fetchMock)
    const { wrapper, router } = await mountAt(
      '/catalogo/centro?priceListId=list-mayoreo&source=home#top',
    )

    await flushPromises()
    await openBranchSelector(wrapper)
    await branchDialog(wrapper).get('button[aria-label="Sucursal Norte"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/catalogo/norte?source=home#top')
    expect(lastProductRequestUrl(fetchMock)).toBe(productsUrl('norte'))
  })

  it.each([
    ['/catalogo/centro?priceListId=%20', 'blank'],
    ['/catalogo/centro?priceListId=list-1&priceListId=list-mayoreo', 'array'],
    ['/catalogo/centro?priceListId=list-unknown', 'unknown'],
    ['/catalogo/centro?priceListId=%20list-1%20', 'padded'],
  ])(
    'never requests products for a %s explicit context and never selects the default',
    async (path) => {
      const fetchMock = createCatalogFetch()
      stubCatalogFetch(fetchMock)
      const { wrapper } = await mountAt(path)

      await flushPromises()
      expect(productRequestUrls(fetchMock)).toEqual([])
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(wrapper.text()).toContain('La lista de precios seleccionada no está disponible')
      // An invalid/unknown/padded proposal must not show the discovered default as selected.
      expect(findSelectMenu(wrapper).props('modelValue')).toBeNull()
    },
  )

  it('never invents a context when discovery publishes no default', async () => {
    const noDefaultContexts: PublicCatalogPriceContextDto[] = [
      { priceListId: 'list-mayoreo', name: 'Mayoreo', isCatalogDefault: false },
    ]
    const fetchMock = createCatalogFetch({ contexts: () => jsonResponse(noDefaultContexts) })
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(productRequestUrls(fetchMock)).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Elige una lista de precios para ver productos')
    expect(wrapper.text()).not.toContain('No pudimos cargar los productos')
    // A populated selector without a default stays usable and unselected.
    expect(findSelectMenu(wrapper).props('disabled')).toBe(false)
    expect(findSelectMenu(wrapper).props('modelValue')).toBeNull()
    expect(
      (findSelectMenu(wrapper).props('items') as PublicCatalogPriceContextDto[]).map(
        (item) => item.priceListId,
      ),
    ).toEqual(['list-mayoreo'])
  })

  it.each([
    [
      'empty',
      () => jsonResponse([]),
      'Este catálogo todavía no tiene listas de precios publicadas',
    ],
    [
      'rate-limit',
      () => jsonResponse({ message: 'throttled' }, 429),
      'Demasiadas solicitudes. Intenta de nuevo más tarde.',
    ],
    [
      'server',
      () => jsonResponse({ message: 'boom' }, 500),
      'No pudimos cargar las listas de precios.',
    ],
    [
      'network',
      () => Promise.reject(new TypeError('Failed to fetch')),
      'No se pudo conectar. Inténtalo de nuevo en un momento.',
    ],
  ])(
    'keeps the %s context discovery state separate from products and retries discovery only',
    async (_state, firstContexts, copy) => {
      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(branches))
      fetchMock.mockImplementationOnce(firstContexts as () => unknown)
      fetchMock
        .mockResolvedValueOnce(jsonResponse(priceContexts))
        .mockResolvedValueOnce(jsonResponse(productsResponse()))
      stubCatalogFetch(fetchMock)
      const { wrapper } = await mountAt('/catalogo/centro')

      await flushPromises()
      expect(wrapper.text()).toContain(copy)
      expect(productRequestUrls(fetchMock)).toEqual([])

      const retry = wrapper.get('[data-testid="catalog-retry-context"]')
      await retry.trigger('click')
      await flushPromises()

      expect(gridText(wrapper)).toContain('Café molido')
      expect(fetchMock).toHaveBeenCalledTimes(4)
    },
  )

  it('renders a stale explicit context 404 as a price-context unavailable state, never a generic product failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(branches))
      .mockResolvedValueOnce(jsonResponse(priceContexts))
      .mockResolvedValueOnce(jsonResponse({}, 404))
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro?priceListId=list-mayoreo')

    await flushPromises()
    expect(wrapper.text()).toContain('La lista de precios seleccionada no está disponible')
    expect(wrapper.text()).toContain('Elige otra lista de precios para ver el catálogo.')
    expect(wrapper.text()).not.toContain('No pudimos cargar los productos.')
    expect(wrapper.find('[data-testid="catalog-retry-products"]').exists()).toBe(false)
  })

  it('prefers the authoritative list response context and keeps a stale one selectable', async () => {
    const staleContext = {
      priceListId: 'list-from-response',
      name: 'Lista resuelta',
      isCatalogDefault: false,
    }
    const fetchMock = createCatalogFetch({
      contexts: () => jsonResponse([priceContexts[0]!]),
      products: () => jsonResponse({ ...productsResponse(), priceContext: staleContext }),
    })
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    const menu = findSelectMenu(wrapper)
    expect(menu.props('modelValue')).toBe('list-from-response')
    expect(
      (menu.props('items') as PublicCatalogPriceContextDto[]).map((item) => item.priceListId),
    ).toEqual(['list-1', 'list-from-response'])
    expect(wrapper.get('[aria-label="Lista de precios"]').text()).toContain('Lista resuelta')
  })

  it('does not claim a context selection when navigation is rejected', async () => {
    const fetchMock = createCatalogFetch()
    stubCatalogFetch(fetchMock)
    const { wrapper, router } = await mountAt('/catalogo/centro')
    await flushPromises()
    const push = vi.spyOn(router, 'push').mockRejectedValueOnce(new Error('navigation blocked'))

    findSelectMenu(wrapper).vm.$emit('update:modelValue', 'list-mayoreo')
    await flushPromises()

    expect(push).toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/catalogo/centro')
    expect(findSelectMenu(wrapper).props('modelValue')).toBe('list-1')
    expect(productRequestUrls(fetchMock).some((url) => url.includes('priceListId'))).toBe(false)
  })

  it('keeps real controls compact without unsupported header clutter', async () => {
    const fetchMock = createCatalogFetch()
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    const controls = wrapper.get('[data-testid="catalog-header-controls"]')
    expect(controls.classes()).toContain('catalog-header-controls')
    const selector = wrapper.get('[data-testid="catalog-price-context-selector"]')
    expect(selector.classes()).toEqual(expect.arrayContaining(['w-full', 'min-w-0']))

    expect(wrapper.find('button[aria-label="Explorar sucursales"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Cambiar tema"]').exists()).toBe(false)
    expect(wrapper.get('header img').attributes('src')).toBe('/hounfeLogos/primary.png')
    expect(wrapper.get('main h1').text()).toBe('Todo para quienes te acompañan.')
    expect(wrapper.find('button[aria-label="Ver carrito"]').exists()).toBe(false)
    expect(wrapper.find('header input[type="search"]').exists()).toBe(true)
  })

  it('renders the branch selector dialog with a real address, a neutral address fallback and the current branch state', async () => {
    const publishedBranches = [
      {
        id: 'b-1',
        name: 'Sucursal Centro',
        slug: 'centro',
        address: 'Av. Juárez 120, Centro',
        phone: null,
      },
      { id: 'b-2', name: 'Sucursal Norte', slug: 'norte', address: null, phone: null },
    ]
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(publishedBranches))
      .mockResolvedValueOnce(jsonResponse(priceContexts))
      .mockResolvedValueOnce(jsonResponse(productsResponse()))
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(branchDialogElement(wrapper)).toBeNull()

    await openBranchSelector(wrapper)
    expect(branchTrigger(wrapper).attributes('aria-expanded')).toBe('true')
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1)

    const dialog = branchDialog(wrapper)
    expect(dialog.get('[data-slot="title"]').text()).toBe('Seleccionar sucursal')
    expect(dialog.get('[data-slot="description"]').text()).toBe(
      'Elige la sucursal para ver sus productos.',
    )

    const list = dialog.get('ul[aria-label="Sucursales disponibles"]')
    const selected = list.get('button[aria-label="Sucursal Centro"]')
    const unselected = list.get('button[aria-label="Sucursal Norte"]')
    expect(selected.attributes('aria-current')).toBe('page')
    expect(unselected.attributes('aria-current')).toBeUndefined()
    expect(selected.text()).toContain('Av. Juárez 120, Centro')
    expect(unselected.text()).toContain('Dirección no publicada')
  })

  it('threads the real category facets into the «Categorías» menu and the total into the heading', async () => {
    const categories = [
      { id: 'coffee', name: 'Café', count: 3 },
      { id: 'tea', name: 'Té', count: 1 },
    ]
    const fetchMock = createCatalogFetch({
      products: () =>
        jsonResponse({
          ...productsResponse(),
          meta: { page: 1, limit: 20, total: 4, totalPages: 1 },
          facets: { categories },
        }),
    })
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(wrapper.get('[data-testid="catalog-result-total"]').text()).toBe('4 productos')
    expect(wrapper.get('#catalogo h2').text()).toContain('Nuestro catálogo')
    expect(wrapper.find('[data-testid="catalog-category-menu"]').exists()).toBe(false)
    const menu = await openCategories(wrapper)
    expect(menu.findAll('button').map((button) => button.text().replace(/\s+/g, ' '))).toEqual([
      'Todas las categorías 4',
      'Café 3',
      'Té 1',
    ])
  })

  it('keeps the enabled control inventory exact while the branch selector is closed and adds only its own controls once it opens', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(branches))
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt('/catalogo')

    await flushPromises()
    expect(enabledControlLabels()).toEqual(['Explorar sucursales'])

    await openBranchSelector(wrapper)
    expect(enabledControlLabels()).toEqual(
      [
        'Explorar sucursales',
        'Cerrar selección de sucursal',
        'Sucursal Centro',
        'Sucursal Norte',
      ].sort(),
    )
  })

  it('withholds the result total copy before a product response exists and preserves a real zero afterwards', async () => {
    const discoveryFetch = vi.fn().mockResolvedValueOnce(jsonResponse(branches))
    stubCatalogFetch(discoveryFetch)
    const discovery = await mountAt('/catalogo')

    await flushPromises()
    expect(discovery.wrapper.find('[data-testid="catalog-result-total"]').exists()).toBe(false)
    expect(discovery.wrapper.text()).not.toContain('0 productos')
    expect(discoveryFetch).toHaveBeenCalledTimes(1)

    const emptyFetch = createCatalogFetch({
      products: () => jsonResponse({ ...productsResponse([]), excludedCount: 2 }),
    })
    stubCatalogFetch(emptyFetch)
    const selected = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(selected.wrapper.get('main').text()).toContain(
      'No hay productos disponibles en este momento',
    )
    expect(selected.wrapper.get('main').text()).not.toMatch(/publicados|excluidos|excludedCount/)
    expect(selected.wrapper.find('[data-testid="catalog-result-total"]').exists()).toBe(false)
  })

  it('keeps the search, the count and the category chips off a catalog with no products at all', async () => {
    vi.stubGlobal(
      'fetch',
      createCatalogFetch({ products: () => jsonResponse(productsResponse([])) }),
    )
    const { wrapper } = await mountAt('/catalogo/centro')
    await flushPromises()

    expect(wrapper.get('main').text()).toContain('No hay productos disponibles en este momento')
    expect(wrapper.find('form[role="search"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="catalog-result-total"]').exists()).toBe(false)
    expect(wrapper.find('.catalog-header-categories').exists()).toBe(false)
    expect(wrapper.find('[data-testid="catalog-no-results"]').exists()).toBe(false)
  })

  it('keeps the search and the real zero count when a search matches nothing', async () => {
    vi.stubGlobal(
      'fetch',
      createCatalogFetch({ products: () => jsonResponse(productsResponse([])) }),
    )
    const { wrapper } = await mountAt('/catalogo/centro?q=correa')
    await flushPromises()

    expect(wrapper.find('form[role="search"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="catalog-result-total"]').text()).toBe('0 productos')
    const state = wrapper.get('[data-testid="catalog-no-results"]')
    expect(state.get('h3').text()).toBe('No encontramos «correa»')
    expect(chipButton(wrapper, 'Quitar búsqueda: correa').exists()).toBe(true)
  })

  it('announces in-progress branch discovery inside the polite chooser region once the selector is open', async () => {
    let resolveBranches!: (value: Response) => void
    const fetchMock = vi.fn().mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveBranches = resolve
      }),
    )
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt('/catalogo')

    await flushPromises()
    await openBranchSelector(wrapper)
    const chooser = branchDialog(wrapper).get('[data-testid="catalog-branch-choices"]')
    expect(chooser.attributes('aria-live')).toBe('polite')
    const announcement = chooser.get('[role="status"]')
    expect(announcement.attributes('aria-busy')).toBeDefined()
    expect(announcement.text()).toBe('Cargando sucursales…')
    expect(wrapper.get('main').text()).toContain('Cargando sucursales…')
    expect(wrapper.get('main').text()).not.toContain('No hay sucursales publicadas')

    resolveBranches(jsonResponse(branches))
    await flushPromises()
    expect(branchDialog(wrapper).find('button[aria-label="Sucursal Centro"]').exists()).toBe(true)
  })

  it.each([
    ['empty', () => jsonResponse([]), 'No hay sucursales publicadas'],
    [
      'rate-limit',
      () => jsonResponse({ message: 'throttled' }, 429),
      'Demasiadas solicitudes. Intenta de nuevo más tarde.',
    ],
    ['server', () => jsonResponse({ message: 'boom' }, 500), 'No pudimos cargar las sucursales.'],
    [
      'network',
      () => Promise.reject(new TypeError('Failed to fetch')),
      'No se pudo conectar. Inténtalo de nuevo en un momento.',
    ],
  ])(
    'keeps the %s branch state and its retry reachable inside the polite chooser region',
    async (_state, firstResponse, copy) => {
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(firstResponse)
        .mockResolvedValue(jsonResponse(branches))
      stubCatalogFetch(fetchMock)
      const { wrapper } = await mountAt('/catalogo')

      await flushPromises()
      expect(wrapper.get('main').text()).toContain(copy)
      expect(wrapper.get('main').text()).not.toContain('Selecciona una sucursal publicada')
      if (_state !== 'empty') {
        expect(wrapper.get('main').text()).not.toContain('No hay sucursales publicadas')
      }
      await openBranchSelector(wrapper)
      const chooser = branchDialog(wrapper).get('[data-testid="catalog-branch-choices"]')
      expect(chooser.attributes('aria-live')).toBe('polite')
      expect(chooser.text()).toContain(copy)

      const retry = chooser.get('button[aria-label="Reintentar sucursales"]')
      expect(retry.text()).toBe('Reintentar')
      await retry.trigger('click')
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(branchDialog(wrapper).find('button[aria-label="Sucursal Centro"]').exists()).toBe(true)
      expect(wrapper.find('button[aria-label="Explorar sucursales"]').exists()).toBe(true)
    },
  )

  it('selects and clears a server category, resetting page while preserving price, query and hash', async () => {
    const fetchMock = createCatalogFetch({
      products: (_slug, _price, url) =>
        jsonResponse({
          ...categoryPage(url.searchParams.has('categoryId')),
          priceContext: priceContexts[1],
        }),
    })
    stubCatalogFetch(fetchMock)
    const { wrapper, router } = await mountAt(
      '/catalogo/centro?priceListId=list-mayoreo&page=2&keep=yes#catalogo',
    )
    await flushPromises()
    await (await categoryEntry(wrapper, 'Café'))!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({
      priceListId: 'list-mayoreo',
      keep: 'yes',
      categoryId,
    })
    expect(router.currentRoute.value.hash).toBe('#catalogo')
    expect(wrapper.text()).toContain('Café filtrado')
    expect((await categoryEntry(wrapper, 'Café'))!.attributes('aria-pressed')).toBe('true')
    expect((await categoryEntry(wrapper, 'Todas las categorías'))!.text()).toContain('4')
    expect(wrapper.get('[data-testid="catalog-result-total"]').text()).toBe('1 producto')
    expect(chipButton(wrapper, 'Quitar filtro: Café').exists()).toBe(true)
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      `${productsUrl('centro')}?priceListId=list-mayoreo&categoryId=${categoryId}`,
    )
    await (await categoryEntry(wrapper, 'Todas las categorías'))!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ priceListId: 'list-mayoreo', keep: 'yes' })
    expect(wrapper.text()).toContain('Café molido')
  })

  it.each([
    '?categoryId',
    '?categoryId=',
    '?categoryId=bad&page=2',
    `?categoryId=%20${categoryId}`,
    `?categoryId=${categoryId}%20`,
    `?categoryId=${categoryId}&categoryId=${categoryId}`,
    '?page=0',
    '?page=-1',
    '?page=1.5',
    '?page=9007199254740992',
    '?page=1&page=2',
    '?page=',
  ])('suppresses invalid listing %s and offers targeted recovery', async (query) => {
    const fetchMock = createCatalogFetch({ products: () => jsonResponse(categoryPage(false)) })
    stubCatalogFetch(fetchMock)
    const { wrapper, router } = await mountAt(`/catalogo/centro${query}&keep=yes#catalogo`)
    await flushPromises()
    expect(wrapper.find('[data-testid="catalog-product-grid"]').exists()).toBe(false)
    expect(wrapper.find('nav[aria-label="Paginación del catálogo"]').exists()).toBe(false)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/products'))).toHaveLength(
      1,
    )
    const categoryError = query.includes('categoryId')
    expect(wrapper.text()).toContain(categoryError ? 'Categoría no válida.' : 'Página no válida.')
    const recovery = wrapper
      .findAll('button')
      .find(
        (button) => button.text() === (categoryError ? 'Limpiar categoría' : 'Restablecer página'),
      )!
    await recovery.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ keep: 'yes' })
    expect(router.currentRoute.value.hash).toBe('#catalogo')
    expect(wrapper.find('[data-testid="catalog-product-grid"]').exists()).toBe(true)
  })

  it('recovers only page, forwarding an unknown valid UUID to a truthful empty result', async () => {
    const fetchMock = createCatalogFetch({
      products: (_slug, _price, url) =>
        jsonResponse(
          url.searchParams.has('categoryId') ? productsResponse([]) : categoryPage(false),
        ),
    })
    stubCatalogFetch(fetchMock)
    const unknown = '22222222-2222-4222-8222-222222222222'
    const { wrapper, router } = await mountAt(
      `/catalogo/centro?categoryId=${unknown}&page=no&keep=yes`,
    )
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Restablecer página')!
      .trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ categoryId: unknown, keep: 'yes' })
    expect(wrapper.get('[data-testid="catalog-result-total"]').text()).toBe('0 productos')
    expect(wrapper.text()).not.toContain('Café molido')
    expect(await categoryEntry(wrapper, 'Café')).toBeDefined()
    // A category the facets cannot name is still a removable filter, never a raw id.
    expect(chipButton(wrapper, 'Quitar filtro: Categoría').exists()).toBe(true)
    expect(wrapper.get('[data-testid="catalog-no-results"] h3').text()).toBe(
      'No hay productos en Categoría',
    )
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      `${productsUrl('centro')}?categoryId=${unknown}`,
    )
  })

  it('shows ONE error when the baseline and the filtered listing both fail, and its Reintentar recovers both', async () => {
    let failBaseline = true
    const fetchMock = createCatalogFetch({
      products: (_slug, _price, url) =>
        url.searchParams.has('categoryId') || failBaseline
          ? jsonResponse({}, 500)
          : jsonResponse(categoryPage(false)),
    })
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt(`/catalogo/centro?categoryId=${categoryId}`)
    await flushPromises()
    const main = wrapper.get('main')
    // One combined failure: the grid's, never a second one for the categories.
    expect(main.findAll('[data-kind="error"]')).toHaveLength(1)
    expect(main.text()).toContain('No pudimos cargar el catálogo')
    // The menu stays quiet: the listing already says it, and its Reintentar recovers both.
    const menu = await openCategories(wrapper)
    expect(menu.text()).not.toContain('No pudimos cargar las categorías')
    expect(menu.find('[data-testid="catalog-retry-categories"]').exists()).toBe(false)
    expect(chipButton(wrapper, 'Quitar filtro: Categoría').exists()).toBe(true)
    failBaseline = false
    await wrapper.get('[data-testid="catalog-retry-products"]').trigger('click')
    await flushPromises()
    expect((await categoryEntry(wrapper, 'Todas las categorías'))!.text()).toContain('4')
    expect((await categoryEntry(wrapper, 'Café'))!.text()).toContain('3')
    expect(wrapper.find('[data-testid="catalog-product-grid"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Café molido')
  })

  it('shows the categories error inside the menu with its own Reintentar when only the baseline fails', async () => {
    let failBaseline = true
    const fetchMock = createCatalogFetch({
      products: (_slug, _price, url) =>
        url.searchParams.has('categoryId')
          ? jsonResponse(categoryPage(true))
          : failBaseline
            ? jsonResponse({}, 500)
            : jsonResponse(categoryPage(false)),
    })
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt(`/catalogo/centro?categoryId=${categoryId}`)
    await flushPromises()
    const menu = await openCategories(wrapper)
    expect(menu.text()).toContain('No pudimos cargar las categorías')
    expect(wrapper.get('main').findAll('[data-kind="error"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('Café filtrado')
    failBaseline = false
    await menu.get('[data-testid="catalog-retry-categories"]').trigger('click')
    await flushPromises()
    expect((await openCategories(wrapper)).text()).not.toContain('No pudimos cargar las categorías')
    expect((await categoryEntry(wrapper, 'Todas las categorías'))!.text()).toContain('4')
  })

  it('keeps route selection on rejected navigation and restores it with back/forward history', async () => {
    vi.stubGlobal(
      'fetch',
      createCatalogFetch({
        products: (_slug, _price, url) =>
          jsonResponse(categoryPage(url.searchParams.has('categoryId'))),
      }),
    )
    const { wrapper, router } = await mountAt('/catalogo/centro')
    await flushPromises()
    const select = async () => (await categoryEntry(wrapper, 'Café'))!
    const push = vi.spyOn(router, 'push').mockRejectedValueOnce(new Error('blocked'))
    await (await select()).trigger('click')
    await flushPromises()
    expect((await select()).attributes('aria-pressed')).toBe('false')
    expect(router.currentRoute.value.query.categoryId).toBeUndefined()
    push.mockRestore()
    await (await select()).trigger('click')
    await flushPromises()
    expect((await select()).attributes('aria-pressed')).toBe('true')
    router.back()
    await flushPromises()
    expect((await select()).attributes('aria-pressed')).toBe('false')
    router.forward()
    await flushPromises()
    expect((await select()).attributes('aria-pressed')).toBe('true')
  })

  it('guards mismatched resolved baseline facets while retaining filtered cards and manual recovery', async () => {
    let baselineContext = priceContexts[0]
    const fetchMock = createCatalogFetch({
      products: (_slug, _price, url) =>
        jsonResponse({
          ...categoryPage(url.searchParams.has('categoryId')),
          priceContext: url.searchParams.has('categoryId') ? priceContexts[1] : baselineContext,
        }),
    })
    stubCatalogFetch(fetchMock)
    const { wrapper } = await mountAt(`/catalogo/centro?categoryId=${categoryId}&q=café`)
    await flushPromises()
    const menu = await openCategories(wrapper)
    expect(menu.text()).not.toContain('Todas las categorías')
    expect(menu.text()).toContain('Las categorías no coinciden con la lista de precios actual.')
    expect(chipButton(wrapper, 'Quitar filtro: Categoría').exists()).toBe(true)
    expect(wrapper.get('[data-testid="catalog-result-total"]').text()).toBe('1 producto')
    expect(gridText(wrapper)).toContain('Café filtrado')
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/products'))).toHaveLength(
      2,
    )
    baselineContext = priceContexts[1]
    await menu.get('[data-testid="catalog-retry-categories"]').trigger('click')
    await flushPromises()
    expect((await categoryEntry(wrapper, 'Café'))!.attributes('aria-pressed')).toBe('true')
    expect((await categoryEntry(wrapper, 'Todas las categorías'))!.text()).toContain('4')
    expect((await openCategories(wrapper)).text()).not.toContain('Las categorías no coinciden')
  })

  it('never shows baseline facets from the previous price context while the new context is pending', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      createCatalogFetch({
        products: (_slug, price) =>
          price === 'list-mayoreo'
            ? new Promise<Response>((resolve) => {
                finish = resolve
              })
            : jsonResponse(categoryPage(false)),
      }),
    )
    const { wrapper, router } = await mountAt('/catalogo/centro')
    await flushPromises()
    expect(await categoryEntry(wrapper, 'Café')).toBeDefined()
    await router.push('/catalogo/centro?priceListId=list-mayoreo')
    await flushPromises()
    // While the new context is pending the menu only says it is loading.
    const pending = await openCategories(wrapper)
    expect(pending.text()).toContain('Cargando categorías…')
    expect(pending.text()).not.toContain('Café')
    finish(jsonResponse({ ...productsResponseFor('list-mayoreo'), facets: { categories: [] } }))
    await flushPromises()
    expect(await categoryEntry(wrapper, 'Café')).toBeUndefined()
  })

  describe('committed search', () => {
    const input = (wrapper: VueWrapper) => wrapper.get<HTMLInputElement>('input[type="search"]')
    /** The committed search is removed from its active-filter chip. */
    const clear = (wrapper: VueWrapper) =>
      wrapper
        .findAll('[aria-label="Filtros activos"] button')
        .find((b) => (b.attributes('aria-label') ?? '').startsWith('Quitar búsqueda'))!
    const installSearch = () => {
      const fetchMock = createCatalogFetch({
        products: (_slug, price, url) =>
          jsonResponse({
            ...categoryPage(url.searchParams.has('q')),
            meta: {
              page: Number(url.searchParams.get('page') ?? 1),
              limit: 20,
              total: url.searchParams.has('q') ? 21 : 52,
              totalPages: 3,
            },
            priceContext:
              priceContexts.find((context) => context.priceListId === price) ?? priceContext,
          }),
      })
      stubCatalogFetch(fetchMock)
      return fetchMock
    }

    it('shows a removable search chip only for a committed search, never for a typed draft', async () => {
      installSearch()
      const { wrapper } = await mountAt('/catalogo/centro')
      await flushPromises()
      expect(wrapper.find('[aria-label="Filtros activos"]').exists()).toBe(false)
      await input(wrapper).setValue('café')
      expect(wrapper.find('[aria-label="Filtros activos"]').exists()).toBe(false)

      const withQuery = await mountAt('/catalogo/centro?q=correa')
      await flushPromises()
      expect(chipButton(withQuery.wrapper, 'Quitar búsqueda: correa').text()).toBe('“correa”')
    })

    it('submits and clears exact drafts only on commitment, preserving filters, hash and baseline', async () => {
      const fetchMock = installSearch()
      const { wrapper, router } = await mountAt(
        `/catalogo/centro?categoryId=${categoryId}&priceListId=list-mayoreo&page=2&keep=yes#catalogo`,
      )
      await flushPromises()
      expect(wrapper.get('label[for="catalog-search"]').text()).toBe('Buscar productos o marcas')
      expect(input(wrapper).attributes('placeholder')).toBe('Buscar productos o marcas')
      expect(wrapper.find('header form[role="search"]').exists()).toBe(true)
      const before = fetchMock.mock.calls.length
      await input(wrapper).setValue(' café &+ ')
      await flushPromises()
      expect(fetchMock).toHaveBeenCalledTimes(before)
      await wrapper.get('form[role="search"]').trigger('submit')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({
        categoryId,
        priceListId: 'list-mayoreo',
        keep: 'yes',
        q: ' café &+ ',
      })
      expect(router.currentRoute.value.hash).toBe('#catalogo')
      expect(wrapper.text()).toContain('Café filtrado')
      expect(wrapper.get('[data-testid="catalog-result-total"]').text()).toBe('21 productos')
      expect((await categoryEntry(wrapper, 'Todas las categorías'))!.text()).toContain('52')
      expect((await categoryEntry(wrapper, 'Café'))!.text()).toContain('3')
      await wrapper
        .findAll('button')
        .find((b) => b.text() === 'Siguiente')!
        .trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query).toMatchObject({ page: '2', q: ' café &+ ' })
      await (await categoryEntry(wrapper, 'Todas las categorías'))!.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.categoryId).toBeUndefined()
      expect(router.currentRoute.value.query.page).toBeUndefined()
      expect(router.currentRoute.value.query.q).toBe(' café &+ ')
      await router.push({
        query: { ...router.currentRoute.value.query, categoryId, page: '2' },
        hash: '#catalogo',
      })
      await clear(wrapper).trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({
        categoryId,
        priceListId: 'list-mayoreo',
        keep: 'yes',
      })
      expect(router.currentRoute.value.hash).toBe('#catalogo')
      expect(input(wrapper).element.value).toBe('')
      const baselineCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith('/products?priceListId=list-mayoreo'),
      )
      expect(baselineCalls).toHaveLength(1)
    })

    it('synchronizes direct entry, history and rejected/aborted submission and clear drafts', async () => {
      installSearch()
      const { wrapper, router } = await mountAt('/catalogo/centro?q=original&page=2')
      await flushPromises()
      expect(input(wrapper).element.value).toBe('original')
      for (const aborted of [false, true]) {
        const removeGuard = aborted ? router.beforeEach(() => false) : () => {}
        for (const clearing of [false, true]) {
          const push = aborted
            ? null
            : vi.spyOn(router, 'push').mockRejectedValueOnce(new Error('blocked'))
          await input(wrapper).setValue('uncommitted')
          if (clearing) await clear(wrapper).trigger('click')
          else await wrapper.get('form[role="search"]').trigger('submit')
          await flushPromises()
          expect(input(wrapper).element.value).toBe('original')
          expect(router.currentRoute.value.query).toEqual({ q: 'original', page: '2' })
          push?.mockRestore()
        }
        removeGuard()
      }
      await input(wrapper).setValue('next')
      await wrapper.get('form[role="search"]').trigger('submit')
      await flushPromises()
      await input(wrapper).setValue('unsubmitted')
      router.back()
      await flushPromises()
      expect(input(wrapper).element.value).toBe('original')
      router.forward()
      await flushPromises()
      expect(input(wrapper).element.value).toBe('next')
    })

    it.each(['?q', '?q=a&q=b'])(
      'recovers invalid search %s by removing only q and page',
      async (query) => {
        const fetchMock = installSearch()
        const { wrapper, router } = await mountAt(
          `/catalogo/centro${query}&categoryId=${categoryId}&page=2&keep=yes#catalogo`,
        )
        await flushPromises()
        expect(wrapper.text()).toContain('Búsqueda no válida.')
        expect(wrapper.find('[data-testid="catalog-product-grid"]').exists()).toBe(false)
        expect(
          fetchMock.mock.calls.filter(([url]) => String(url).includes('/products')),
        ).toHaveLength(1)
        const recover = wrapper.get('[data-testid="catalog-filter-recover"]')
        expect(recover.text()).toBe('Limpiar búsqueda')
        await recover.trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.query).toEqual({ categoryId, keep: 'yes' })
        expect(router.currentRoute.value.hash).toBe('#catalogo')
        expect(wrapper.find('[data-testid="catalog-product-grid"]').exists()).toBe(true)
      },
    )

    it('keeps failed search distinct from baseline and retries only by explicit action', async () => {
      let failing = true
      const fetchMock = createCatalogFetch({
        products: (_slug, _price, url) =>
          url.searchParams.has('q') && failing
            ? jsonResponse({}, 500)
            : jsonResponse(categoryPage(url.searchParams.has('q'))),
      })
      stubCatalogFetch(fetchMock)
      const { wrapper } = await mountAt('/catalogo/centro?q=café')
      await flushPromises()
      expect(wrapper.text()).not.toContain('Café molido')
      expect(wrapper.find('nav[aria-label="Paginación del catálogo"]').exists()).toBe(false)
      expect((await categoryEntry(wrapper, 'Todas las categorías'))!.text()).toContain('4')
      const before = fetchMock.mock.calls.length
      await input(wrapper).setValue('draft')
      await flushPromises()
      expect(fetchMock).toHaveBeenCalledTimes(before)
      failing = false
      await wrapper.get('[data-testid="catalog-retry-products"]').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('Café filtrado')
      expect(String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![0])).toContain(
        'q=caf%C3%A9',
      )
    })

    it('canonicalizes an empty direct-entry search to the baseline request', async () => {
      const fetchMock = installSearch()
      const { wrapper } = await mountAt('/catalogo/centro?q=')
      await flushPromises()
      expect(input(wrapper).element.value).toBe('')
      expect(
        fetchMock.mock.calls.filter(([url]) => String(url).includes('/products')),
      ).toHaveLength(1)
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(productsUrl('centro'))
    })
  })

  describe('metadata-driven pagination', () => {
    const pager = (wrapper: VueWrapper) => wrapper.get('nav[aria-label="Paginación del catálogo"]')
    const button = (wrapper: VueWrapper, label: string) =>
      pager(wrapper)
        .findAll('button')
        .find((entry) => entry.text() === label)!
    const paged = (page: number, total = 52, totalPages = 3) => ({
      ...categoryPage(false),
      items: page > totalPages ? [] : [product],
      meta: { page, limit: 20, total, totalPages },
    })
    const installPages = () => {
      const fetchMock = createCatalogFetch({
        products: (_slug, price, url) =>
          jsonResponse({
            ...paged(Number(url.searchParams.get('page') ?? 1)),
            priceContext:
              priceContexts.find((context) => context.priceListId === price) ?? priceContext,
          }),
      })
      stubCatalogFetch(fetchMock)
      return fetchMock
    }

    it('uses response metadata for first/middle/last boundaries and preserves URL context', async () => {
      const fetchMock = installPages()
      const { wrapper, router } = await mountAt(
        `/catalogo/centro?categoryId=${categoryId}&priceListId=list-mayoreo&q=sin%20buscar&keep=yes#catalogo`,
      )
      await flushPromises()
      expect(pager(wrapper).text()).toContain('Página 1 de 3')
      expect(button(wrapper, 'Anterior').attributes('disabled')).toBeDefined()
      expect(button(wrapper, 'Siguiente').attributes('disabled')).toBeUndefined()
      await button(wrapper, 'Siguiente').trigger('click')
      await flushPromises()
      expect(pager(wrapper).text()).toContain('Página 2 de 3')
      expect(button(wrapper, 'Anterior').attributes('disabled')).toBeUndefined()
      expect(button(wrapper, 'Siguiente').attributes('disabled')).toBeUndefined()
      expect(router.currentRoute.value.query).toEqual({
        categoryId,
        priceListId: 'list-mayoreo',
        q: 'sin buscar',
        keep: 'yes',
        page: '2',
      })
      expect(router.currentRoute.value.hash).toBe('#catalogo')
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
        `${productsUrl('centro')}?priceListId=list-mayoreo&categoryId=${categoryId}&page=2&q=sin%20buscar`,
      )
      expect((await categoryEntry(wrapper, 'Todas las categorías'))!.text()).toContain('52')
      await button(wrapper, 'Siguiente').trigger('click')
      await flushPromises()
      expect(pager(wrapper).text()).toContain('Página 3 de 3')
      expect(button(wrapper, 'Siguiente').attributes('disabled')).toBeDefined()
      await button(wrapper, 'Anterior').trigger('click')
      await flushPromises()
      await button(wrapper, 'Anterior').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.page).toBeUndefined()
      expect(router.currentRoute.value.query.q).toBe('sin buscar')
      router.back()
      await flushPromises()
      expect(pager(wrapper).text()).toContain('Página 2 de 3')
      router.forward()
      await flushPromises()
      expect(pager(wrapper).text()).toContain('Página 1 de 3')
    })

    it('retains the committed page when navigation is rejected or aborted', async () => {
      installPages()
      const { wrapper, router } = await mountAt('/catalogo/centro')
      await flushPromises()
      const push = vi.spyOn(router, 'push').mockRejectedValueOnce(new Error('blocked'))
      await button(wrapper, 'Siguiente').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.page).toBeUndefined()
      expect(pager(wrapper).text()).toContain('Página 1 de 3')
      push.mockRestore()
      router.beforeEach(() => false)
      await button(wrapper, 'Siguiente').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.page).toBeUndefined()
      expect(pager(wrapper).text()).toContain('Página 1 de 3')
    })

    it('hides stale pagination during loading and error, then restores it after manual retry', async () => {
      let finish!: (response: Response) => void
      let retry = false
      vi.stubGlobal(
        'fetch',
        createCatalogFetch({
          products: (_slug, _price, url) =>
            url.searchParams.get('page') === '2'
              ? retry
                ? jsonResponse(paged(2))
                : new Promise<Response>((resolve) => {
                    finish = resolve
                  })
              : jsonResponse(paged(1)),
        }),
      )
      const { wrapper } = await mountAt('/catalogo/centro')
      await flushPromises()
      await button(wrapper, 'Siguiente').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('Cargando productos')
      expect(wrapper.find('nav[aria-label="Paginación del catálogo"]').exists()).toBe(false)
      finish(jsonResponse({}, 500))
      await flushPromises()
      expect(wrapper.find('nav[aria-label="Paginación del catálogo"]').exists()).toBe(false)
      retry = true
      await wrapper.get('[data-testid="catalog-retry-products"]').trigger('click')
      await flushPromises()
      expect(pager(wrapper).text()).toContain('Página 2 de 3')
    })

    it.each([
      [52, 3],
      [0, 0],
    ])('manually recovers an exhausted page with total %i and pages %i', async (total, pages) => {
      vi.stubGlobal(
        'fetch',
        createCatalogFetch({
          products: (_slug, _price, url) =>
            jsonResponse(paged(Number(url.searchParams.get('page') ?? 1), total, pages)),
        }),
      )
      const { wrapper, router } = await mountAt(
        `/catalogo/centro?categoryId=${categoryId}&page=8&q=keep&keep=yes#catalogo`,
      )
      await flushPromises()
      expect(router.currentRoute.value.query.page).toBe('8')
      expect(wrapper.text()).toContain('Página fuera de rango')
      expect(wrapper.text()).not.toContain('No hay productos disponibles')
      expect(wrapper.find('[data-testid="catalog-no-results"]').exists()).toBe(false)
      expect(wrapper.find('nav[aria-label="Paginación del catálogo"]').exists()).toBe(false)
      const recovery = () =>
        wrapper
          .findAll('button')
          .find((entry) => entry.text() === 'Ir a la última página disponible')!
      const push = vi.spyOn(router, 'push').mockRejectedValueOnce(new Error('blocked'))
      await recovery().trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.page).toBe('8')
      expect(wrapper.text()).toContain('Página fuera de rango')
      push.mockRestore()
      await recovery().trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({
        categoryId,
        q: 'keep',
        keep: 'yes',
        ...(pages ? { page: '3' } : {}),
      })
      expect(router.currentRoute.value.hash).toBe('#catalogo')
      expect(wrapper.text()).not.toContain('Página fuera de rango')
      if (pages) expect(pager(wrapper).text()).toContain('Página 3 de 3')
      else {
        // With a search and a category still active, zero products is «no results», not an empty catalog.
        expect(wrapper.get('[data-testid="catalog-no-results"] h3').text()).toBe(
          'No encontramos «keep» en Café',
        )
        expect(wrapper.text()).not.toContain('Página 1 de 0')
      }
    })

    it('permits metadata navigation after a successful empty in-range response', async () => {
      vi.stubGlobal(
        'fetch',
        createCatalogFetch({
          products: (_slug, _price, url) =>
            jsonResponse({
              ...paged(Number(url.searchParams.get('page') ?? 1)),
              items: [],
            }),
        }),
      )
      const { wrapper, router } = await mountAt('/catalogo/centro?page=2')
      await flushPromises()
      expect(pager(wrapper).text()).toContain('Página 2 de 3')
      await button(wrapper, 'Siguiente').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.page).toBe('3')
    })

    it('keeps a zero-result first page ordinary and never renders page 1 of 0', async () => {
      vi.stubGlobal(
        'fetch',
        createCatalogFetch({ products: () => jsonResponse(productsResponse([])) }),
      )
      const { wrapper } = await mountAt('/catalogo/centro')
      await flushPromises()
      expect(wrapper.text()).toContain('No hay productos disponibles')
      expect(wrapper.text()).not.toContain('Página fuera de rango')
      expect(wrapper.find('nav[aria-label="Paginación del catálogo"]').exists()).toBe(false)
    })
  })

  describe('attribute facets', () => {
    const cat = 'animal.target:ani.dom.cat'
    /** A category group needs two real choices to be worth a section. */
    const twoCategories = [...categoryFacets, { id: toysId, name: 'Juguetes', count: 1 }]
    const dog = 'animal.target:ani.dom.dog'
    const adult = 'life.stage:adult'
    const kibble = 'food.format:food.format.kibble'
    /** Counts depend on the request so the tests prove tiles come from the baseline and groups from the filtered response. */
    const facetsFor = (selected: string[]) => [
      {
        code: 'animal.target',
        label: 'Especie',
        options: [
          { code: 'ani.dom.cat', label: 'Gato', count: selected.length ? 5 : 2 },
          { code: 'ani.dom.dog', label: 'Perro', count: 1 },
        ],
      },
      {
        code: 'life.stage',
        label: 'Etapa de vida',
        options: [
          { code: 'adult', label: 'Adulto', count: 3 },
          { code: 'puppy', label: 'Cachorro', count: 2 },
        ],
      },
      {
        code: 'food.format',
        label: 'Formato del alimento',
        options: [
          { code: 'food.format.kibble', label: 'Croquetas', count: 2 },
          { code: 'food.format.wet', label: 'Húmedo', count: 1 },
        ],
      },
    ]
    const facetPage = (url: URL, attributes = facetsFor(url.searchParams.getAll('facet'))) => {
      const selected = url.searchParams.getAll('facet')
      return {
        ...productsResponseFor(
          url.searchParams.get('priceListId') ?? 'list-1',
          selected.length ? [{ ...product, name: 'Café filtrado' }] : [product],
        ),
        meta: { page: 1, limit: 20, total: selected.length ? 1 : 38, totalPages: 1 },
        facets: { categories: selected.length ? [] : twoCategories, attributes },
      }
    }
    const install = (
      products: (url: URL) => Response | Promise<Response> = (url) => jsonResponse(facetPage(url)),
    ) => {
      const fetchMock = createCatalogFetch({ products: (_slug, _price, url) => products(url) })
      stubCatalogFetch(fetchMock)
      return fetchMock
    }
    const facetsOf = (url: string | undefined) => new URL(url!).searchParams.getAll('facet')
    const sidebar = (wrapper: VueWrapper) =>
      wrapper.find('aside[aria-label="Filtros del catálogo"]')
    const row = (wrapper: VueWrapper, label: string) =>
      sidebar(wrapper)
        .findAll('button[aria-pressed]')
        .find((button) => (button.attributes('aria-label') ?? '').startsWith(label))!
    const tiles = (wrapper: VueWrapper) =>
      wrapper.findAll('section[aria-label="Explorar por destinatario"] button')
    const tile = (wrapper: VueWrapper, label: string) =>
      tiles(wrapper).find((button) => (button.attributes('aria-label') ?? '').startsWith(label))!
    const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

    it('shows tiles from the unfiltered animal.target facet and only Categoría plus a hint in the sidebar', async () => {
      const fetchMock = install()
      const { wrapper } = await mountAt('/catalogo/centro')
      await flushPromises()
      expect(productRequestUrls(fetchMock)).toEqual([productsUrl('centro')])
      expect(tiles(wrapper).map((button) => squash(button.text()))).toEqual([
        'Todos 38',
        'Gato 2',
        'Perro 1',
      ])
      expect(tile(wrapper, 'Todos').attributes('aria-pressed')).toBe('true')
      expect(tile(wrapper, 'Gato').attributes('aria-pressed')).toBe('false')
      expect(sidebar(wrapper).exists()).toBe(true)
      expect(row(wrapper, 'Categoría: Café').attributes('aria-pressed')).toBe('false')
      expect(sidebar(wrapper).text()).toContain('Elige un destinatario')
      expect(sidebar(wrapper).text()).not.toContain('Etapa de vida')
      expect(sidebar(wrapper).text()).not.toContain('Especie')
      expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    })

    it('toggles a recipient tile into repeated URL params, drops page, keeps the rest and unlocks the other groups', async () => {
      const fetchMock = install()
      const { wrapper, router } = await mountAt(
        '/catalogo/centro?priceListId=list-mayoreo&page=2&keep=yes#catalogo',
      )
      await flushPromises()
      await tile(wrapper, 'Gato').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({
        priceListId: 'list-mayoreo',
        keep: 'yes',
        facet: cat,
      })
      expect(router.currentRoute.value.hash).toBe('#catalogo')
      expect(facetsOf(lastProductRequestUrl(fetchMock))).toEqual([cat])
      expect(new URL(lastProductRequestUrl(fetchMock)!).searchParams.has('page')).toBe(false)
      expect(wrapper.text()).toContain('Café filtrado')
      expect(tile(wrapper, 'Gato').attributes('aria-pressed')).toBe('true')
      expect(tile(wrapper, 'Todos').attributes('aria-pressed')).toBe('false')
      // Tile counts stay the baseline's; they do not follow the filtered response (5).
      expect(squash(tile(wrapper, 'Gato').text())).toBe('Gato 2')
      expect(sidebar(wrapper).text()).toContain('Etapa de vida')
      expect(sidebar(wrapper).text()).not.toContain('Elige un destinatario')

      await tile(wrapper, 'Gato').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.facet).toBeUndefined()
    })

    it('«Todos» clears only the recipient filter and keeps every other facet', async () => {
      install()
      const { wrapper, router } = await mountAt(
        `/catalogo/centro?facet=${cat}&facet=${dog}&facet=${adult}&page=2&q=caf#catalogo`,
      )
      await flushPromises()
      expect(tile(wrapper, 'Gato').attributes('aria-pressed')).toBe('true')
      expect(tile(wrapper, 'Perro').attributes('aria-pressed')).toBe('true')
      await tile(wrapper, 'Todos').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({ q: 'caf', facet: adult })
      expect(router.currentRoute.value.hash).toBe('#catalogo')
    })

    it('applies a sidebar row at once through the URL and keeps the rest of the query', async () => {
      const fetchMock = install()
      const { wrapper, router } = await mountAt(`/catalogo/centro?facet=${cat}&keep=yes&page=3`)
      await flushPromises()
      expect(row(wrapper, 'Etapa de vida: Adulto').attributes('aria-pressed')).toBe('false')
      await row(wrapper, 'Etapa de vida: Adulto').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({ facet: [cat, adult], keep: 'yes' })
      expect(facetsOf(lastProductRequestUrl(fetchMock))).toEqual([cat, adult])
      expect(row(wrapper, 'Etapa de vida: Adulto').attributes('aria-pressed')).toBe('true')

      await row(wrapper, 'Formato del alimento: Croquetas').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.facet).toEqual([cat, adult, kibble])

      await row(wrapper, 'Etapa de vida: Adulto').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.facet).toEqual([cat, kibble])
    })

    it('toggles every code of a merged same-label row together, keeping raw tokens in the URL', async () => {
      const dogAdult = 'life.stage:life.dog.adult'
      const catAdult = 'life.stage:life.cat.adult'
      const fetchMock = install((url) =>
        jsonResponse(
          facetPage(url, [
            ...facetsFor(url.searchParams.getAll('facet')).slice(0, 1),
            {
              code: 'life.stage',
              label: 'Etapa de vida',
              options: [
                { code: 'life.dog.adult', label: 'Adulto', count: 4 },
                { code: 'life.cat.adult', label: 'Adulto', count: 2 },
                { code: 'life.dog.puppy', label: 'Cachorro', count: 1 },
              ],
            },
          ]),
        ),
      )
      const { wrapper, router } = await mountAt(`/catalogo/centro?facet=${cat}`)
      await flushPromises()
      await row(wrapper, 'Etapa de vida: Adulto').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.facet).toEqual([cat, dogAdult, catAdult])
      expect(facetsOf(lastProductRequestUrl(fetchMock))).toEqual([cat, dogAdult, catAdult])
      expect(row(wrapper, 'Etapa de vida: Adulto').attributes('aria-pressed')).toBe('true')

      await row(wrapper, 'Etapa de vida: Adulto').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.facet).toBe(cat)
    })

    it('selects and unselects a category row through categoryId and drops the page', async () => {
      install()
      const { wrapper, router } = await mountAt('/catalogo/centro?page=2&keep=yes')
      await flushPromises()
      await row(wrapper, 'Categoría: Café').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({ categoryId, keep: 'yes' })
      expect(row(wrapper, 'Categoría: Café').attributes('aria-pressed')).toBe('true')
      await row(wrapper, 'Categoría: Café').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({ keep: 'yes' })
    })

    it('shows five options and «Ver más (n)» for the rest of a group', async () => {
      const options = Array.from({ length: 7 }, (_, index) => ({
        code: `opt.${index}`,
        label: `Opción ${index}`,
        count: index + 1,
      }))
      install((url) =>
        jsonResponse(
          facetPage(url, [
            ...facetsFor(url.searchParams.getAll('facet')).slice(0, 1),
            { code: 'many.def', label: 'Muchas', options },
          ]),
        ),
      )
      const { wrapper } = await mountAt(`/catalogo/centro?facet=${cat}`)
      await flushPromises()
      const group = () => sidebar(wrapper).get('[data-facet="many.def"]')
      expect(group().findAll('button[aria-pressed]')).toHaveLength(5)
      const more = group().get('button[aria-expanded]')
      expect(more.text()).toContain('Ver más (2)')
      await more.trigger('click')
      expect(group().findAll('button[aria-pressed]')).toHaveLength(7)
    })

    it('shows no tiles when the response has no animal.target facet, and lists every group without a hint', async () => {
      install((url) => jsonResponse(facetPage(url, facetsFor([]).slice(1))))
      const { wrapper } = await mountAt('/catalogo/centro')
      await flushPromises()
      expect(tiles(wrapper)).toHaveLength(0)
      expect(wrapper.find('section[aria-label="Explorar por destinatario"]').exists()).toBe(false)
      expect(sidebar(wrapper).text()).toContain('Etapa de vida')
      expect(sidebar(wrapper).text()).toContain('Formato del alimento')
      expect(sidebar(wrapper).text()).not.toContain('Elige un destinatario')
    })

    it('ignores malformed tokens, dedupes and caps the facet params at 50', async () => {
      const fetchMock = install()
      const many = Array.from({ length: 60 }, (_, index) => `def.${index}:opt.${index}`)
      const query = [
        'facet=nocolon',
        'facet=bad%20space:opt',
        `facet=${'a'.repeat(121)}:opt`,
        'facet=def:',
        `facet=${cat}`,
        `facet=${cat}`,
        ...many.map((token) => `facet=${token}`),
      ].join('&')
      const { wrapper } = await mountAt(`/catalogo/centro?${query}`)
      await flushPromises()
      const sent = facetsOf(lastProductRequestUrl(fetchMock))
      expect(sent).toEqual([cat, ...many.slice(0, 49)])
      expect(wrapper.find('[data-testid="catalog-product-grid"]').exists()).toBe(true)
      expect(wrapper.text()).not.toContain('no válida')
    })

    it('keeps the request byte-identical to today when every facet token is malformed', async () => {
      const fetchMock = install()
      await mountAt('/catalogo/centro?facet=nocolon&facet=')
      await flushPromises()
      expect(productRequestUrls(fetchMock)).toEqual([productsUrl('centro')])
    })

    it('drops stale facets from the URL and reloads the list on FACET_NOT_AVAILABLE', async () => {
      const fetchMock = install((url) =>
        url.searchParams.has('facet')
          ? jsonResponse(
              {
                statusCode: 400,
                error: 'FACET_NOT_AVAILABLE',
                message: 'Facet is not available: animal.target:ani.dom.cat',
              },
              400,
            )
          : jsonResponse(facetPage(url)),
      )
      const { wrapper, router } = await mountAt(
        `/catalogo/centro?facet=${cat}&page=2&q=caf&keep=yes#catalogo`,
      )
      const push = vi.spyOn(router, 'push')
      const replace = vi.spyOn(router, 'replace')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({ q: 'caf', keep: 'yes' })
      expect(router.currentRoute.value.hash).toBe('#catalogo')
      expect(new URL(lastProductRequestUrl(fetchMock)!).searchParams.has('facet')).toBe(false)
      expect(new URL(lastProductRequestUrl(fetchMock)!).searchParams.get('q')).toBe('caf')
      expect(wrapper.text()).toContain('Café molido')
      expect(wrapper.find('[data-testid="catalog-product-grid"]').exists()).toBe(true)
      // Replaced, not pushed: going back never returns to the stale facet.
      expect(replace).toHaveBeenCalledTimes(1)
      expect(push).not.toHaveBeenCalled()
    })

    it('keeps any other 400 an ordinary listing failure', async () => {
      install((url) =>
        url.searchParams.has('facet')
          ? jsonResponse(
              { statusCode: 400, error: 'Bad Request', message: 'FACET_NOT_AVAILABLE' },
              400,
            )
          : jsonResponse(facetPage(url)),
      )
      const { wrapper, router } = await mountAt(`/catalogo/centro?facet=${cat}`)
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({ facet: cat })
      expect(wrapper.text()).toContain('Reintentar')
    })

    it('keeps the sidebar rows mounted while the next filtered page loads', async () => {
      let release!: () => void
      install((url) =>
        url.searchParams.getAll('facet').length > 1
          ? new Promise<Response>((resolve) => {
              release = () => resolve(jsonResponse(facetPage(url)))
            })
          : jsonResponse(facetPage(url)),
      )
      const { wrapper } = await mountAt(`/catalogo/centro?facet=${cat}`)
      await flushPromises()
      const adultRow = row(wrapper, 'Etapa de vida: Adulto')
      await adultRow.trigger('click')
      await flushPromises()
      expect(row(wrapper, 'Etapa de vida: Adulto').element).toBe(adultRow.element)
      expect(row(wrapper, 'Etapa de vida: Adulto').attributes('aria-pressed')).toBe('true')
      release()
      await flushPromises()
      expect(row(wrapper, 'Etapa de vida: Adulto').attributes('aria-pressed')).toBe('true')
    })

    it('shows no tiles and no attribute groups when the listing has no attribute facets (switch off)', async () => {
      install((url) =>
        jsonResponse({
          ...productsResponse(),
          facets: { categories: twoCategories },
          _u: String(url),
        }),
      )
      const { wrapper } = await mountAt('/catalogo/centro')
      await flushPromises()
      expect(tiles(wrapper)).toHaveLength(0)
      expect(sidebar(wrapper).findAll('section')).toHaveLength(1)
      expect(sidebar(wrapper).text()).toContain('Categoría')
    })
  })

  describe('mobile filters sheet', () => {
    const cat = 'animal.target:ani.dom.cat'
    const twoCategories = [...categoryFacets, { id: toysId, name: 'Juguetes', count: 1 }]
    const adult = 'life.stage:adult'
    const attributes = [
      {
        code: 'animal.target',
        label: 'Especie',
        options: [
          { code: 'ani.dom.cat', label: 'Gato', count: 2 },
          { code: 'ani.dom.dog', label: 'Perro', count: 1 },
        ],
      },
      {
        code: 'life.stage',
        label: 'Etapa de vida',
        options: [
          { code: 'adult', label: 'Adulto', count: 3 },
          { code: 'puppy', label: 'Cachorro', count: 2 },
        ],
      },
    ]
    /** Listing requests carry a page of products; probes carry `limit=1` and answer a total by filters. */
    const install = () => {
      const fetchMock = createCatalogFetch({
        products: (_slug, _price, url) => {
          const facets = url.searchParams.getAll('facet')
          const probe = url.searchParams.get('limit') === '1'
          return jsonResponse({
            ...productsResponse(),
            meta: {
              page: 1,
              limit: probe ? 1 : 20,
              total: probe ? 7 - facets.length : 38,
              totalPages: 1,
            },
            facets: { categories: twoCategories, attributes },
          })
        },
      })
      stubCatalogFetch(fetchMock)
      return fetchMock
    }
    const probes = (fetchMock: ReturnType<typeof vi.fn>) =>
      productRequestUrls(fetchMock)
        .map((url) => new URL(url))
        .filter((url) => url.searchParams.get('limit') === '1')
    const trigger = (wrapper: VueWrapper) =>
      wrapper
        .findAll('button')
        .find(
          (button) =>
            button.attributes('aria-haspopup') === 'dialog' && button.text().startsWith('Filtros'),
        )!
    const sheet = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
    const sheetButton = (label: string) =>
      [...sheet()!.querySelectorAll('button')].find((button) =>
        (button.getAttribute('aria-label') ?? button.textContent ?? '').trim().startsWith(label),
      )!
    const apply = () =>
      sheet()!.querySelector<HTMLButtonElement>('[data-testid="catalog-filter-apply"]')!
    async function press(element: Element) {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushPromises()
    }
    const waitDebounce = async () => {
      await new Promise((resolve) => setTimeout(resolve, 380))
      await flushPromises()
    }

    it('shows «Filtros» with the active count and opens a dialog without probing before it opens', async () => {
      const fetchMock = install()
      const { wrapper } = await mountAt(`/catalogo/centro?facet=${cat}`)
      await flushPromises()
      expect(trigger(wrapper).text()).toContain('1')
      expect(trigger(wrapper).attributes('aria-expanded')).toBe('false')
      expect(sheet()).toBeNull()
      expect(probes(fetchMock)).toHaveLength(0)
      await trigger(wrapper).trigger('click')
      await flushPromises()
      expect(sheet()).not.toBeNull()
      expect(probes(fetchMock)).toHaveLength(1)
      expect(probes(fetchMock)[0]!.searchParams.getAll('facet')).toEqual([cat])
      expect(apply().textContent!.trim()).toBe('Ver 6 productos')
    })

    it('keeps changes as a draft until «Ver N productos», then applies them to the URL without the page', async () => {
      const fetchMock = install()
      const { wrapper, router } = await mountAt(`/catalogo/centro?facet=${cat}&page=2&keep=yes`)
      await flushPromises()
      await trigger(wrapper).trigger('click')
      await flushPromises()
      await press(sheet()!.querySelectorAll('[data-testid="catalog-filter-group-toggle"]')[1]!)
      await press(sheetButton('Etapa de vida: Adulto'))
      // Nothing reaches the URL while the draft is open.
      expect(router.currentRoute.value.query).toEqual({ facet: cat, page: '2', keep: 'yes' })
      await waitDebounce()
      const last = probes(fetchMock).slice(-1)[0]!
      expect(last.searchParams.getAll('facet')).toEqual([cat, adult])
      expect(last.searchParams.has('page')).toBe(false)
      expect(apply().textContent!.trim()).toBe('Ver 5 productos')

      await press(apply())
      expect(router.currentRoute.value.query).toEqual({ facet: [cat, adult], keep: 'yes' })
      expect(sheet()).toBeNull()
    })

    it('closes with Escape without applying the draft', async () => {
      install()
      const { wrapper, router } = await mountAt(`/catalogo/centro?facet=${cat}`)
      await flushPromises()
      await trigger(wrapper).trigger('click')
      await flushPromises()
      await press(sheetButton('Quitar filtro: Gato'))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()
      expect(sheet()).toBeNull()
      expect(router.currentRoute.value.query).toEqual({ facet: cat })
    })

    it('«Limpiar» empties the draft and confirming removes the filters from the URL', async () => {
      install()
      const { wrapper, router } = await mountAt(`/catalogo/centro?facet=${cat}&q=caf`)
      await flushPromises()
      await trigger(wrapper).trigger('click')
      await flushPromises()
      await press(sheetButton('Limpiar'))
      expect(router.currentRoute.value.query).toEqual({ facet: cat, q: 'caf' })
      await press(apply())
      expect(router.currentRoute.value.query).toEqual({ q: 'caf' })
    })

    it('falls back to «Ver productos» when the probe fails', async () => {
      const fetchMock = createCatalogFetch({
        products: (_slug, _price, url) =>
          url.searchParams.get('limit') === '1'
            ? jsonResponse({}, 500)
            : jsonResponse({
                ...productsResponse(),
                facets: { categories: twoCategories, attributes },
              }),
      })
      stubCatalogFetch(fetchMock)
      const { wrapper } = await mountAt(`/catalogo/centro?facet=${cat}`)
      await flushPromises()
      await trigger(wrapper).trigger('click')
      await flushPromises()
      expect(apply().textContent!.trim()).toBe('Ver productos')
    })
  })

  describe('listing chrome (design v0)', () => {
    const pagedFetch = (total = 38, limit = 12) =>
      createCatalogFetch({
        products: (_slug, _price, url) => {
          const page = Number(url.searchParams.get('page') ?? 1)
          return jsonResponse({
            ...categoryPage(url.searchParams.has('categoryId')),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
          })
        },
      })

    it('sends the order from the URL, never «Relevancia», and changes it from page 1', async () => {
      const fetchMock = pagedFetch()
      stubCatalogFetch(fetchMock)
      const { wrapper, router } = await mountAt('/catalogo/centro?sort=price_desc&page=2&keep=yes')
      await flushPromises()
      expect(new URL(lastProductRequestUrl(fetchMock)!).searchParams.get('sort')).toBe('price_desc')
      const select = wrapper.get<HTMLSelectElement>('#catalogo select')
      expect(select.element.value).toBe('price_desc')
      expect(select.findAll('option').map((option) => option.text())).toEqual([
        'Novedades',
        'Precio menor',
        'Precio mayor',
      ])
      expect(wrapper.text()).not.toContain('Relevancia')

      await select.setValue('price_asc')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({ sort: 'price_asc', keep: 'yes' })
      expect(new URL(lastProductRequestUrl(fetchMock)!).searchParams.get('sort')).toBe('price_asc')

      await wrapper.get<HTMLSelectElement>('#catalogo select').setValue('newest')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({ keep: 'yes' })
      expect(lastProductRequestUrl(fetchMock)).toBe(productsUrl('centro'))
    })

    it.each(['?sort=newest', '?sort=relevance', '?sort=bogus'])(
      'keeps the default request byte-identical for %s',
      async (query) => {
        const fetchMock = createCatalogFetch()
        stubCatalogFetch(fetchMock)
        await mountAt(`/catalogo/centro${query}`)
        await flushPromises()
        expect(productRequestUrls(fetchMock)).toEqual([productsUrl('centro')])
      },
    )

    it.each([
      ['/catalogo/centro', true],
      ['/catalogo/centro?sort=price_asc', true],
      ['/catalogo/centro?q=', true],
      ['/catalogo/centro?q=correa', false],
      [`/catalogo/centro?categoryId=${categoryId}`, false],
      ['/catalogo/centro?facet=animal.target:ani.dom.cat', false],
      ['/catalogo/centro?page=2', false],
    ])('shows the full hero only on the unfiltered first page (%s → %s)', async (path, full) => {
      stubCatalogFetch(pagedFetch())
      const { wrapper } = await mountAt(path)
      await flushPromises()
      expect(wrapper.find('.catalog-hero').exists()).toBe(full)
      expect(wrapper.find('.catalog-hero-bar').exists()).toBe(!full)
      expect(wrapper.findAll('h1')).toHaveLength(1)
      if (!full) {
        expect(wrapper.get('.catalog-hero-bar').text()).toContain(
          'Precios y disponibilidad de Sucursal Centro.',
        )
      }
    })

    it('reads «Mostrando a–b de N» from the meta and numbers the pages', async () => {
      stubCatalogFetch(pagedFetch())
      const { wrapper, router } = await mountAt('/catalogo/centro?page=2')
      await flushPromises()
      const pager = wrapper.get('nav[aria-label="Paginación del catálogo"]')
      expect(pager.text()).toContain('Mostrando 13–24 de 38 productos')
      expect(pager.get('[aria-current="page"]').text()).toBe('2')
      await pager.get('button[aria-label="Página 4"]').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.page).toBe('4')

      const first = await mountAt('/catalogo/centro')
      await flushPromises()
      expect(first.wrapper.get('.catalog-results-range').text()).toBe(
        'Mostrando 1–12 de 38 productos',
      )
    })

    it('lists every active filter as a chip and clears them all with «Limpiar todo»', async () => {
      vi.stubGlobal(
        'fetch',
        createCatalogFetch({
          products: (_slug, _price, url) =>
            jsonResponse({
              ...categoryPage(url.searchParams.has('categoryId')),
              facets: {
                categories: categoryFacets,
                attributes: [
                  {
                    code: 'animal.target',
                    label: 'Especie',
                    options: [{ code: 'ani.dom.dog', label: 'Perros', count: 1 }],
                  },
                ],
              },
            }),
        }),
      )
      const { wrapper, router } = await mountAt(
        `/catalogo/centro?categoryId=${categoryId}&facet=animal.target:ani.dom.dog&q=croqueta&page=2&sort=price_asc&priceListId=list-1`,
      )
      await flushPromises()
      const chips = wrapper.get('[aria-label="Filtros activos"]')
      expect(
        chips.findAll('button').map((button) => button.attributes('aria-label') ?? button.text()),
      ).toEqual([
        'Quitar filtro: Café',
        'Quitar filtro: Perros',
        'Quitar búsqueda: croqueta',
        'Limpiar todo',
      ])
      await chipButton(wrapper, 'Quitar filtro: Perros').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.facet).toBeUndefined()
      expect(router.currentRoute.value.query.q).toBe('croqueta')

      await wrapper
        .findAll('[aria-label="Filtros activos"] button')
        .find((button) => button.text() === 'Limpiar todo')!
        .trigger('click')
      await flushPromises()
      // The order and the price list are not filters: they stay.
      expect(router.currentRoute.value.query).toEqual({ sort: 'price_asc', priceListId: 'list-1' })
      expect(wrapper.find('[aria-label="Filtros activos"]').exists()).toBe(false)
    })

    it('turns an empty filtered listing into «no results» with its ways out', async () => {
      vi.stubGlobal(
        'fetch',
        createCatalogFetch({
          products: (_slug, _price, url) =>
            url.searchParams.has('q')
              ? jsonResponse({ ...productsResponse([]), facets: { categories: [] } })
              : jsonResponse(categoryPage(false)),
        }),
      )
      const { wrapper, router } = await mountAt(
        `/catalogo/centro?q=salm%C3%B3n&categoryId=${categoryId}`,
      )
      await flushPromises()
      const state = wrapper.get('[data-testid="catalog-no-results"]')
      expect(state.get('h3').text()).toBe('No encontramos «salmón» en Café')
      expect(state.findAll('button').map((button) => button.text())).toEqual([
        'Limpiar todo',
        'Quitar «Café»',
      ])
      expect(wrapper.html()).not.toMatch(/whatsapp|wa\.me/i)
      await state.findAll('button')[1]!.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({ q: 'salmón' })
    })

    it('offers the published branches when the URL names a branch without a catalog', async () => {
      const fetchMock = createCatalogFetch()
      stubCatalogFetch(fetchMock)
      const { wrapper, router } = await mountAt('/catalogo/norte-viejo?keep=yes')
      await flushPromises()
      expect(wrapper.text()).toContain('Esta sucursal aún no publica su catálogo')
      expect(productRequestUrls(fetchMock)).toEqual([])
      await wrapper
        .findAll('#catalogo button')
        .find((button) => button.text() === 'Ver catálogo de Sucursal Centro')!
        .trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.fullPath).toBe('/catalogo/centro?keep=yes')
    })

    it('says «Precios en MXN» with the branch and hides the selector with a single price list', async () => {
      vi.stubGlobal(
        'fetch',
        createCatalogFetch({ contexts: () => jsonResponse([priceContexts[0]!]) }),
      )
      const { wrapper } = await mountAt('/catalogo/centro')
      await flushPromises()
      expect(wrapper.find('[data-testid="catalog-price-context-selector"]').exists()).toBe(false)
      expect(wrapper.get('.catalog-listing-context').text()).toBe(
        'Precios en MXN · Sucursal Centro',
      )
      expect(wrapper.get('footer').text()).toContain(
        'Catálogo de Sucursal Centro. Precios en pesos mexicanos (MXN).',
      )
    })
  })
})
