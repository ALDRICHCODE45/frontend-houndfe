import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { DOMWrapper, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h, ref, shallowRef } from 'vue'
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
const CatalogProductDetailModal = defineComponent({
  props: { open: Boolean, detail: Object, state: String },
  emits: ['close', 'retry'],
  setup(props, { emit }) {
    return () =>
      props.open
        ? h('section', { role: 'dialog', 'data-state': props.state }, [
            h(
              'p',
              { 'data-testid': 'detail-id' },
              (props.detail as { id?: string } | null)?.id ?? '',
            ),
            h('button', {
              type: 'button',
              'aria-label': 'Cerrar detalle',
              onClick: () => emit('close'),
            }),
            h('button', {
              type: 'button',
              'aria-label': 'Reintentar detalle',
              onClick: () => emit('retry'),
            }),
          ])
        : null
  },
})
const stubs = {
  UButton,
  UInput,
  UIcon: defineComponent({ setup: () => () => h('span') }),
  CatalogProductDetailModal,
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
const categoryPage = (filtered: boolean) => ({
  ...productsResponse(filtered ? [{ ...product, name: 'Café filtrado' }] : [product]),
  meta: { page: 1, limit: 20, total: filtered ? 1 : 4, totalPages: 1 },
  facets: { categories: filtered ? [] : categoryFacets },
})
const productsUrl = (slug: string) => `http://localhost:3000/public/catalog/${slug}/products`

type CatalogFetchOverrides = {
  contexts?: (slug: string) => Response | Promise<Response>
  products?: (slug: string, priceListId: string | null, url: URL) => Response | Promise<Response>
  detail?: () => Response | Promise<Response>
}

/** URL-routed fetch double: branches, then per-slug discovery, then products/detail. */
function createCatalogFetch(overrides: CatalogFetchOverrides = {}) {
  return vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
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
    routes: [{ path: '/catalogo/:branchSlug?', name: 'public-catalog', component: CatalogView }],
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

describe('CatalogView public browse', () => {
  beforeEach(() => {
    colorMode.value = 'light'
    catalogProductsOverride.current = null
    vi.restoreAllMocks()
  })

  it('selects a discovered branch through the URL, preserves query/hash, and renders its first real product page', async () => {
    const fetchMock = createCatalogFetch()
    vi.stubGlobal('fetch', fetchMock)
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
    expect(branchTrigger(wrapper).text()).toContain('Sucursal Centro')
    expect(requestUrls(fetchMock)).toEqual([
      'http://localhost:3000/public/catalog/branches',
      'http://localhost:3000/public/catalog/centro/price-contexts',
      productsUrl('centro'),
    ])
    expect(findSelectMenu(wrapper).props('modelValue')).toBe('list-1')
    expect(wrapper.get('.catalog-product-card h2').text()).toBe('Café molido')
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
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(branchTrigger(wrapper).text()).toContain('Sucursal Centro')
    expect(wrapper.get('.catalog-product-card h2').text()).toBe('Producto Centro')

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
    expect(branchTrigger(wrapper).text()).toContain('Sucursal Norte')
    expect(wrapper.get('.catalog-product-card h2').text()).toBe('Producto Norte')

    const back = waitForNavigation(router)
    router.back()
    await back
    await flushPromises()
    expect(branchTrigger(wrapper).text()).toContain('Sucursal Centro')
    expect(wrapper.get('.catalog-product-card h2').text()).toBe('Producto Centro')

    const forward = waitForNavigation(router)
    router.forward()
    await forward
    await flushPromises()
    expect(branchTrigger(wrapper).text()).toContain('Sucursal Norte')
    expect(wrapper.get('.catalog-product-card h2').text()).toBe('Producto Norte')
  })

  it.each([
    ['/catalogo', 'Elige una sucursal para explorar el catálogo'],
    ['/catalogo/desconocida', 'Esta sucursal no está disponible'],
  ])('does not request products for %s', async (path, expectedHeading) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(branches))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt(path)

    await flushPromises()
    expect(wrapper.get('#catalogo .catalog-container > section h2').text()).toBe(expectedHeading)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3000/public/catalog/branches')
  })

  it('does not claim a new branch selection when navigation is rejected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(branches))
    vi.stubGlobal('fetch', fetchMock)
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
    [429, 'Demasiadas solicitudes. Intenta de nuevo más tarde.'],
    [500, 'No pudimos cargar los productos.'],
    ['network', 'No se pudo conectar. Revisa tu conexión.'],
  ])(
    'renders the %s product failure state and retries through the DOM',
    async (failure, expectedCopy) => {
      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(branches))
      fetchMock.mockResolvedValueOnce(jsonResponse(priceContexts))
      if (failure === 'network') fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      else fetchMock.mockResolvedValueOnce(jsonResponse(productsResponse(), failure as number))
      fetchMock.mockResolvedValueOnce(jsonResponse(productsResponse([])))
      vi.stubGlobal('fetch', fetchMock)
      const { wrapper } = await mountAt('/catalogo/centro')

      await flushPromises()
      expect(wrapper.text()).toContain(expectedCopy)
      await wrapper.get('button[aria-label="Reintentar productos"]').trigger('click')
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
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(wrapper.text()).toContain('Cargando productos…')
    resolveInitial(jsonResponse(productsResponse([])))
    await flushPromises()
    expect(wrapper.text()).toContain('No hay productos disponibles en este momento')

    void wrapper.get('button[aria-label="Reintentar productos"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Reintentando productos…')
    expect(wrapper.find('button[aria-label="Reintentar productos"]').exists()).toBe(false)
    resolveRetry(jsonResponse(productsResponse()))
    await flushPromises()
    expect(wrapper.get('.catalog-product-card h2').text()).toBe('Café molido')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('does not request detail before a real card activation and threads only the list price context into the detail identity', async () => {
    const listContext = {
      priceListId: 'list-from-response',
      name: 'Lista resuelta',
      isCatalogDefault: false,
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(branches))
      .mockResolvedValueOnce(jsonResponse(priceContexts))
      .mockResolvedValueOnce(jsonResponse({ ...productsResponse(), priceContext: listContext }))
      .mockResolvedValueOnce(jsonResponse(detailResponse({ priceContext: listContext })))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const card = wrapper.get('button[aria-label="Ver detalles de Café molido"]')
    await card.trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      'http://localhost:3000/public/catalog/centro/products/product-1?priceListId=list-from-response',
    )
    expect(wrapper.get('[role="dialog"] [data-testid="detail-id"]').text()).toBe(product.id)
  })

  it('does not open detail when the populated product list has no resolved price context', async () => {
    catalogProductsOverride.current = () => ({
      products: ref([product]),
      response: ref(null),
      state: ref('populated'),
      retry: vi.fn(),
    })
    const fetchMock = createCatalogFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    await wrapper.get('button[aria-label="Ver detalles de Café molido"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('clears selected detail and safely restores the clicked card focus when the user closes it', async () => {
    const fetchMock = createCatalogFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    const card = wrapper.get('button[aria-label="Ver detalles de Café molido"]')
    await card.trigger('click')
    await flushPromises()
    await wrapper.get('button[aria-label="Cerrar detalle"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(card.element)
  })

  it('clears selection on branch changes and never reopens stale detail when the old request resolves', async () => {
    let resolveDetail!: (response: Response) => void
    const fetchMock = createCatalogFetch({
      products: (slug) =>
        jsonResponse(
          slug === 'norte'
            ? productsResponseFor('list-1', [{ ...product, id: 'norte-product' }])
            : productsResponseFor('list-1'),
        ),
      detail: () =>
        new Promise<Response>((resolve) => {
          resolveDetail = resolve
        }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountAt('/catalogo/centro')

    await flushPromises()
    await wrapper.get('button[aria-label="Ver detalles de Café molido"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    await router.push('/catalogo/norte')
    await flushPromises()
    resolveDetail(jsonResponse(detailResponse()))
    await flushPromises()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(requestUrls(fetchMock).filter((url) => url.includes('/products/'))).toHaveLength(1)
    expect(requestUrls(fetchMock)).toEqual([
      'http://localhost:3000/public/catalog/branches',
      'http://localhost:3000/public/catalog/centro/price-contexts',
      productsUrl('centro'),
      'http://localhost:3000/public/catalog/centro/products/product-1?priceListId=list-1',
      'http://localhost:3000/public/catalog/norte/price-contexts',
      productsUrl('norte'),
    ])
  })

  it('closes stale detail and refetches under the explicit context when the visitor switches price list', async () => {
    const fetchMock = createCatalogFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountAt('/catalogo/centro')

    await flushPromises()
    await wrapper.get('button[aria-label="Ver detalles de Café molido"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    await router.push('/catalogo/centro?priceListId=list-mayoreo')
    await flushPromises()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(lastProductRequestUrl(fetchMock)).toBe(
      `${productsUrl('centro')}?priceListId=list-mayoreo`,
    )
    expect(findSelectMenu(wrapper).props('modelValue')).toBe('list-mayoreo')
  })

  it('uses the discovered default without inventing an explicit priceListId', async () => {
    const fetchMock = createCatalogFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(productRequestUrls(fetchMock)).toEqual([productsUrl('centro')])
    expect(findSelectMenu(wrapper).props('modelValue')).toBe('list-1')
    expect(wrapper.get('[aria-label="Lista de precios"]').text()).toContain('Público')
  })

  it('sends the exact Mayoreo context the visitor proposed', async () => {
    const fetchMock = createCatalogFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro?priceListId=list-mayoreo')

    await flushPromises()
    expect(productRequestUrls(fetchMock)).toEqual([
      `${productsUrl('centro')}?priceListId=list-mayoreo`,
    ])
    expect(findSelectMenu(wrapper).props('modelValue')).toBe('list-mayoreo')
  })

  it('writes the selected context into the URL and restores it on back and forward', async () => {
    const fetchMock = createCatalogFetch()
    vi.stubGlobal('fetch', fetchMock)
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
    vi.stubGlobal('fetch', fetchMock)
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
      vi.stubGlobal('fetch', fetchMock)
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
    vi.stubGlobal('fetch', fetchMock)
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
      'No se pudo conectar. Revisa tu conexión.',
    ],
  ])(
    'keeps the %s context discovery state separate from products and retries discovery only',
    async (_state, firstContexts, copy) => {
      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(branches))
      fetchMock.mockImplementationOnce(firstContexts as () => unknown)
      fetchMock
        .mockResolvedValueOnce(jsonResponse(priceContexts))
        .mockResolvedValueOnce(jsonResponse(productsResponse()))
      vi.stubGlobal('fetch', fetchMock)
      const { wrapper } = await mountAt('/catalogo/centro')

      await flushPromises()
      expect(wrapper.text()).toContain(copy)
      expect(productRequestUrls(fetchMock)).toEqual([])

      const retry = wrapper.get('button[aria-label="Reintentar carga de listas de precios"]')
      await retry.trigger('click')
      await flushPromises()

      expect(wrapper.get('.catalog-product-card h2').text()).toBe('Café molido')
      expect(fetchMock).toHaveBeenCalledTimes(4)
    },
  )

  it('renders a stale explicit context 404 as a price-context unavailable state, never a generic product failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(branches))
      .mockResolvedValueOnce(jsonResponse(priceContexts))
      .mockResolvedValueOnce(jsonResponse({}, 404))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro?priceListId=list-mayoreo')

    await flushPromises()
    expect(wrapper.text()).toContain('La lista de precios seleccionada no está disponible')
    expect(wrapper.text()).toContain('Elige otra lista de precios para ver el catálogo.')
    expect(wrapper.text()).not.toContain('No pudimos cargar los productos.')
    expect(wrapper.find('button[aria-label="Reintentar productos"]').exists()).toBe(false)
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
    vi.stubGlobal('fetch', fetchMock)
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
    vi.stubGlobal('fetch', fetchMock)
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
    vi.stubGlobal('fetch', fetchMock)
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
    expect(wrapper.find('main input[type="search"]').exists()).toBe(true)
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
    vi.stubGlobal('fetch', fetchMock)
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

  it('threads the real category facets and the result total into the informational category bar', async () => {
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
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    const bar = wrapper.get('[data-testid="catalog-category-bar"]')
    expect(bar.get('[data-testid="catalog-result-total"]').text()).toContain('4 productos')
    expect(bar.get('button[aria-label="Todas las categorías"]').text()).toContain('4')
    expect(bar.text()).toContain('Nuestro catálogo')
  })

  it('groups real informational categories in a labelled compact navigation band', async () => {
    const categories = [{ id: 'coffee', name: 'Café', count: 3 }]
    const fetchMock = createCatalogFetch({
      products: () =>
        jsonResponse({
          ...productsResponse(),
          meta: { page: 1, limit: 20, total: 4, totalPages: 1 },
          facets: { categories },
        }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    const bar = wrapper.get('[data-testid="catalog-category-bar"]')

    expect(bar.element.tagName).toBe('DIV')
    expect(bar.findAll('button')).toHaveLength(2)

    // Exactly one contained toolbar renders inside that band.
    expect(bar.element.children).toHaveLength(1)
    const toolbar = bar.get('[data-testid="catalog-category-toolbar"]')
    expect(bar.element.firstElementChild).toBe(toolbar.element)
    expect(toolbar.classes()).toContain('catalog-category-toolbar')
    expect(toolbar.get('[data-testid="catalog-result-total"]').text()).toContain('4 productos')
  })

  it('keeps the enabled control inventory exact while the branch selector is closed and adds only its own controls once it opens', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(branches))
    vi.stubGlobal('fetch', fetchMock)
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
    vi.stubGlobal('fetch', discoveryFetch)
    const discovery = await mountAt('/catalogo')

    await flushPromises()
    expect(discovery.wrapper.find('[data-testid="catalog-result-total"]').exists()).toBe(false)
    expect(discovery.wrapper.text()).not.toContain('0 productos')
    expect(discoveryFetch).toHaveBeenCalledTimes(1)

    const emptyFetch = createCatalogFetch({
      products: () => jsonResponse({ ...productsResponse([]), excludedCount: 2 }),
    })
    vi.stubGlobal('fetch', emptyFetch)
    const selected = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(selected.wrapper.get('[data-testid="catalog-result-total"]').text()).toBe('0 productos')
    expect(selected.wrapper.get('main').text()).toContain(
      'No hay productos disponibles en este momento',
    )
    expect(selected.wrapper.get('main').text()).not.toMatch(/publicados|excluidos|excludedCount/)
  })

  it('announces in-progress branch discovery inside the polite chooser region once the selector is open', async () => {
    let resolveBranches!: (value: Response) => void
    const fetchMock = vi.fn().mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveBranches = resolve
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
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
      'No se pudo conectar. Revisa tu conexión.',
    ],
  ])(
    'keeps the %s branch state and its retry reachable inside the polite chooser region',
    async (_state, firstResponse, copy) => {
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(firstResponse)
        .mockResolvedValue(jsonResponse(branches))
      vi.stubGlobal('fetch', fetchMock)
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
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountAt(
      '/catalogo/centro?priceListId=list-mayoreo&page=2&keep=yes#catalogo',
    )
    await flushPromises()
    await wrapper.get('button[aria-label="Categoría Café"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({
      priceListId: 'list-mayoreo',
      keep: 'yes',
      categoryId,
    })
    expect(router.currentRoute.value.hash).toBe('#catalogo')
    expect(wrapper.text()).toContain('Café filtrado')
    expect(wrapper.get('button[aria-label="Categoría Café"]').attributes('aria-pressed')).toBe(
      'true',
    )
    expect(wrapper.get('button[aria-label="Todas las categorías"]').text()).toContain('4')
    expect(wrapper.get('[data-testid="catalog-result-total"]').text()).toBe('1 producto')
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      `${productsUrl('centro')}?priceListId=list-mayoreo&categoryId=${categoryId}`,
    )
    await wrapper.get('button[aria-label="Todas las categorías"]').trigger('click')
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
    vi.stubGlobal('fetch', fetchMock)
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
    vi.stubGlobal('fetch', fetchMock)
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
    expect(wrapper.find('button[aria-label="Categoría Café"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Limpiar categoría')
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      `${productsUrl('centro')}?categoryId=${unknown}`,
    )
  })

  it('retries failed baseline without substituting its cards for a failed filtered listing', async () => {
    let failBaseline = true
    const fetchMock = createCatalogFetch({
      products: (_slug, _price, url) =>
        url.searchParams.has('categoryId') || failBaseline
          ? jsonResponse({}, 500)
          : jsonResponse(categoryPage(false)),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt(`/catalogo/centro?categoryId=${categoryId}`)
    await flushPromises()
    expect(wrapper.text()).toContain('No pudimos cargar las categorías.')
    expect(wrapper.find('button[aria-label="Todas las categorías"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Limpiar categoría')
    failBaseline = false
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Reintentar categorías')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.get('button[aria-label="Todas las categorías"]').text()).toContain('4')
    expect(wrapper.get('button[aria-label="Categoría Café"]').text()).toContain('3')
    expect(wrapper.find('[data-testid="catalog-product-grid"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Café molido')
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
    const select = () => wrapper.get('button[aria-label="Categoría Café"]')
    const push = vi.spyOn(router, 'push').mockRejectedValueOnce(new Error('blocked'))
    await select().trigger('click')
    await flushPromises()
    expect(select().attributes('aria-pressed')).toBe('false')
    expect(router.currentRoute.value.query.categoryId).toBeUndefined()
    push.mockRestore()
    await select().trigger('click')
    await flushPromises()
    expect(select().attributes('aria-pressed')).toBe('true')
    router.back()
    await flushPromises()
    expect(select().attributes('aria-pressed')).toBe('false')
    router.forward()
    await flushPromises()
    expect(select().attributes('aria-pressed')).toBe('true')
  })

  it.each([`categoryId=${categoryId}`, 'page=2', 'q=caf%C3%A9'])(
    'cancels pending detail on %s without late reopening or focus restoration',
    async (query) => {
      let finish!: (response: Response) => void
      const fetchMock = createCatalogFetch({
        products: () => jsonResponse(categoryPage(false)),
        detail: () =>
          new Promise<Response>((resolve) => {
            finish = resolve
          }),
      })
      vi.stubGlobal('fetch', fetchMock)
      const { wrapper, router } = await mountAt('/catalogo/centro')
      await flushPromises()
      const invoker = wrapper.get<HTMLButtonElement>(
        'button[aria-label="Ver detalles de Café molido"]',
      )
      const focus = vi.spyOn(invoker.element, 'focus')
      await invoker.trigger('click')
      await flushPromises()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      await router.push('/catalogo/centro?keep=yes#catalogo')
      await flushPromises()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      const signal = fetchMock.mock.calls.find(([url]) =>
        String(url).includes('/products/product-1'),
      )![1]!.signal!
      await router.push(`/catalogo/centro?${query}`)
      await flushPromises()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      expect(signal.aborted).toBe(true)
      finish(jsonResponse(detailResponse()))
      await flushPromises()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      expect(focus).not.toHaveBeenCalled()
    },
  )

  it('guards mismatched resolved baseline facets while retaining filtered cards/detail and manual recovery', async () => {
    let baselineContext = priceContexts[0]
    const fetchMock = createCatalogFetch({
      products: (_slug, _price, url) =>
        jsonResponse({
          ...categoryPage(url.searchParams.has('categoryId')),
          priceContext: url.searchParams.has('categoryId') ? priceContexts[1] : baselineContext,
        }),
      detail: () => jsonResponse(detailResponse({ priceContext: priceContexts[1] })),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt(`/catalogo/centro?categoryId=${categoryId}&q=café`)
    await flushPromises()
    expect(wrapper.find('button[aria-label="Categoría Café"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Todas las categorías"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Limpiar categoría')
    expect(wrapper.text()).toContain('Las categorías no coinciden con la lista de precios actual.')
    expect(wrapper.get('[data-testid="catalog-result-total"]').text()).toBe('1 producto')
    const retry = wrapper.findAll('button').find((b) => b.text() === 'Reintentar categorías')!
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/products'))).toHaveLength(
      2,
    )
    await wrapper.get('button[aria-label="Ver detalles de Café filtrado"]').trigger('click')
    await flushPromises()
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      `${productsUrl('centro')}/product-1?priceListId=list-mayoreo`,
    )
    expect(wrapper.get('[role="dialog"] [data-testid="detail-id"]').text()).toBe(product.id)
    await wrapper.get('button[aria-label="Cerrar detalle"]').trigger('click')
    baselineContext = priceContexts[1]
    await retry.trigger('click')
    await flushPromises()
    expect(wrapper.find('button[aria-label="Categoría Café"]').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="Todas las categorías"]').text()).toContain('4')
    expect(wrapper.text()).not.toContain('Las categorías no coinciden')
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
    expect(wrapper.find('button[aria-label="Categoría Café"]').exists()).toBe(true)
    await router.push('/catalogo/centro?priceListId=list-mayoreo')
    await flushPromises()
    expect(wrapper.find('button[aria-label="Categoría Café"]').exists()).toBe(false)
    finish(jsonResponse({ ...productsResponseFor('list-mayoreo'), facets: { categories: [] } }))
    await flushPromises()
    expect(wrapper.find('button[aria-label="Categoría Café"]').exists()).toBe(false)
  })

  describe('committed search', () => {
    const input = (wrapper: VueWrapper) => wrapper.get<HTMLInputElement>('input[type="search"]')
    const clear = (wrapper: VueWrapper) =>
      wrapper.findAll('button').find((b) => b.text() === 'Limpiar búsqueda')!
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
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    it('submits and clears exact drafts only on commitment, preserving filters, hash and baseline', async () => {
      const fetchMock = installSearch()
      const { wrapper, router } = await mountAt(
        `/catalogo/centro?categoryId=${categoryId}&priceListId=list-mayoreo&page=2&keep=yes#catalogo`,
      )
      await flushPromises()
      expect(wrapper.get('label[for="catalog-search"]').text()).toBe('Buscar productos o marcas')
      expect(input(wrapper).attributes('placeholder')).toBe('¿Qué necesita tu compañero?')
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
      expect(wrapper.get('button[aria-label="Todas las categorías"]').text()).toContain('52')
      expect(wrapper.get('button[aria-label="Categoría Café"]').text()).toContain('3')
      await wrapper
        .findAll('button')
        .find((b) => b.text() === 'Siguiente')!
        .trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query).toMatchObject({ page: '2', q: ' café &+ ' })
      await wrapper.get('button[aria-label="Todas las categorías"]').trigger('click')
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
        await clear(wrapper).trigger('click')
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
      vi.stubGlobal('fetch', fetchMock)
      const { wrapper } = await mountAt('/catalogo/centro?q=café')
      await flushPromises()
      expect(wrapper.text()).not.toContain('Café molido')
      expect(wrapper.find('nav[aria-label="Paginación del catálogo"]').exists()).toBe(false)
      expect(wrapper.get('button[aria-label="Todas las categorías"]').text()).toContain('4')
      const before = fetchMock.mock.calls.length
      await input(wrapper).setValue('draft')
      await flushPromises()
      expect(fetchMock).toHaveBeenCalledTimes(before)
      failing = false
      await wrapper.get('button[aria-label="Reintentar productos"]').trigger('click')
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
      vi.stubGlobal('fetch', fetchMock)
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
      expect(wrapper.get('button[aria-label="Todas las categorías"]').text()).toContain('52')
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
      await wrapper.get('button[aria-label="Reintentar productos"]').trigger('click')
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
        expect(wrapper.text()).toContain('No hay productos disponibles')
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

  it('passes detail error state and retry events through the modal boundary', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(branches))
      .mockResolvedValueOnce(jsonResponse(priceContexts))
      .mockResolvedValueOnce(jsonResponse(productsResponse()))
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse(detailResponse()))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    await wrapper.get('button[aria-label="Ver detalles de Café molido"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="dialog"]').attributes('data-state')).toBe('server')

    await wrapper.get('button[aria-label="Reintentar detalle"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(wrapper.get('[role="dialog"] [data-testid="detail-id"]').text()).toBe(product.id)
  })
})
