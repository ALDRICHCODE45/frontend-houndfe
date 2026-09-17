import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h, ref, shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogView from '@/features/catalog/views/CatalogView.vue'

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
const priceContext = { priceListId: 'list-1', name: 'Lista pública', isCatalogDefault: true }
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

function waitForNavigation(router: ReturnType<typeof createRouter>) {
  return new Promise<void>((resolve) => {
    const remove = router.afterEach(() => {
      remove()
      resolve()
    })
  })
}

describe('CatalogView public browse', () => {
  beforeEach(() => {
    colorMode.value = 'light'
    catalogProductsOverride.current = null
    vi.restoreAllMocks()
  })

  it('selects a discovered branch through the URL, preserves query/hash, and renders its first real product page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(branches))
      .mockResolvedValueOnce(jsonResponse(productsResponse()))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountAt('/catalogo?source=home#top')

    await flushPromises()
    await wrapper.get('button[aria-label="Sucursal Centro"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/catalogo/centro?source=home#top')
    expect(wrapper.get('button[aria-label="Sucursal Centro"]').attributes('aria-current')).toBe(
      'page',
    )
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:3000/public/catalog/branches',
      'http://localhost:3000/public/catalog/centro/products',
    ])
    expect(wrapper.get('main h2').text()).toBe('Café molido')
    expect(
      wrapper.get('input[aria-label="Buscar en el catálogo"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.get('button[aria-label="Todas las categorías"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.get('button[aria-label="Ordenar catálogo"]').attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.get('button[aria-label="Ver carrito"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('[role="dialog"], a[href^="tel:"], a[href*="whatsapp"]').length).toBe(0)
  })

  it('loads a direct valid slug and keeps branch selection synchronized through back and forward navigation', async () => {
    const centroProduct = { ...product, id: 'centro-product', name: 'Producto Centro' }
    const norteProduct = { ...product, id: 'norte-product', name: 'Producto Norte' }
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/branches')) return Promise.resolve(jsonResponse(branches))
      if (url.endsWith('/centro/products'))
        return Promise.resolve(jsonResponse(productsResponse([centroProduct])))
      return Promise.resolve(jsonResponse(productsResponse([norteProduct])))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(wrapper.get('button[aria-label="Sucursal Centro"]').attributes('aria-current')).toBe(
      'page',
    )
    expect(wrapper.get('main h2').text()).toBe('Producto Centro')

    await router.push('/catalogo/norte')
    await flushPromises()
    expect(wrapper.get('button[aria-label="Sucursal Norte"]').attributes('aria-current')).toBe(
      'page',
    )
    expect(wrapper.get('main h2').text()).toBe('Producto Norte')

    const back = waitForNavigation(router)
    router.back()
    await back
    await flushPromises()
    expect(wrapper.get('button[aria-label="Sucursal Centro"]').attributes('aria-current')).toBe(
      'page',
    )
    expect(wrapper.get('main h2').text()).toBe('Producto Centro')

    const forward = waitForNavigation(router)
    router.forward()
    await forward
    await flushPromises()
    expect(wrapper.get('button[aria-label="Sucursal Norte"]').attributes('aria-current')).toBe(
      'page',
    )
    expect(wrapper.get('main h2').text()).toBe('Producto Norte')
  })

  it.each([
    ['/catalogo', 'Elige una sucursal para explorar el catálogo'],
    ['/catalogo/desconocida', 'Esta sucursal no está disponible'],
  ])('does not request products for %s', async (path, expectedHeading) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(branches))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt(path)

    await flushPromises()
    expect(wrapper.get('h1').text()).toBe(expectedHeading)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3000/public/catalog/branches')
  })

  it('does not claim a new branch selection when navigation is rejected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(branches))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, router } = await mountAt('/catalogo')
    const push = vi.spyOn(router, 'push').mockRejectedValueOnce(new Error('navigation blocked'))

    await flushPromises()
    await wrapper.get('button[aria-label="Sucursal Norte"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalled()
    expect(router.currentRoute.value.fullPath).toBe('/catalogo')
    expect(
      wrapper.get('button[aria-label="Sucursal Norte"]').attributes('aria-current'),
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
      if (failure === 'network') fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      else fetchMock.mockResolvedValueOnce(jsonResponse(productsResponse(), failure as number))
      fetchMock.mockResolvedValueOnce(jsonResponse(productsResponse([])))
      vi.stubGlobal('fetch', fetchMock)
      const { wrapper } = await mountAt('/catalogo/centro')

      await flushPromises()
      expect(wrapper.text()).toContain(expectedCopy)
      await wrapper.get('button[aria-label="Reintentar productos"]').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('Esta sucursal todavía no tiene productos publicados')
      expect(fetchMock).toHaveBeenCalledTimes(3)
    },
  )

  it('renders loading and guarded retry-pending product states before populated and empty outcomes', async () => {
    let resolveInitial!: (value: Response) => void
    let resolveRetry!: (value: Response) => void
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(branches))
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
    expect(wrapper.text()).toContain('Esta sucursal todavía no tiene productos publicados')

    void wrapper.get('button[aria-label="Reintentar productos"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Reintentando productos…')
    expect(wrapper.find('button[aria-label="Reintentar productos"]').exists()).toBe(false)
    resolveRetry(jsonResponse(productsResponse()))
    await flushPromises()
    expect(wrapper.get('main h2').text()).toBe('Café molido')
    expect(fetchMock).toHaveBeenCalledTimes(3)
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
      .mockResolvedValueOnce(jsonResponse({ ...productsResponse(), priceContext: listContext }))
      .mockResolvedValueOnce(jsonResponse(detailResponse({ priceContext: listContext })))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const card = wrapper.get('button[aria-label="Ver detalles de Café molido"]')
    await card.trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls[2]?.[0]).toBe(
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
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(branches))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = await mountAt('/catalogo/centro')

    await flushPromises()
    await wrapper.get('button[aria-label="Ver detalles de Café molido"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('clears selected detail and safely restores the clicked card focus when the user closes it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(branches))
      .mockResolvedValueOnce(jsonResponse(productsResponse()))
      .mockResolvedValueOnce(jsonResponse(detailResponse()))
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(branches))
      .mockResolvedValueOnce(jsonResponse(productsResponse()))
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveDetail = resolve
        }),
      )
      .mockResolvedValueOnce(jsonResponse(productsResponse([{ ...product, id: 'norte-product' }])))
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
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('passes detail error state and retry events through the modal boundary', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(branches))
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
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(wrapper.get('[role="dialog"] [data-testid="detail-id"]').text()).toBe(product.id)
  })
})
