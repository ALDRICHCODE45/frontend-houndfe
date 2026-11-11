import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogProductGrid from '../CatalogProductGrid.vue'

const product = {
  id: 'product-1',
  name: 'Café molido',
  slug: null,
  description: null,
  category: null,
  brand: null,
  image: null,
  price: { fromPriceCents: 2500, priceCents: 2500, hidden: false },
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

const stubs = {
  UIcon: defineComponent({ setup: () => () => h('span') }),
  // The card owns its own link to the detail page; the grid only lays cards out.
  CatalogProductCard: defineComponent({
    props: { product: { type: Object, required: true } },
    setup: (props) => () =>
      h('article', { 'data-catalog-product-id': (props.product as { id: string }).id }, [
        (props.product as { name: string }).name,
      ]),
  }),
}
const branches = [
  { id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null },
]
const mountGrid = (props: Partial<InstanceType<typeof CatalogProductGrid>['$props']> = {}) =>
  mount(CatalogProductGrid, {
    props: {
      selectionState: 'selected',
      products: [product],
      state: 'populated',
      contextState: 'context-ready',
      ...props,
    },
    global: { stubs },
  })

describe('CatalogProductGrid', () => {
  it('describes an empty public result without inventing a publication or exclusion cause', async () => {
    const wrapper = mountGrid({ state: 'empty', products: [] })
    expect(wrapper.text()).toContain('No hay productos disponibles en este momento')
    expect(wrapper.text()).not.toMatch(/publicados|excluidos|excludedCount/)
    await wrapper.get('[data-testid="catalog-retry-products"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('retries authoritative empty branch discovery without requesting products', async () => {
    const wrapper = mountGrid({ branchesState: 'empty', selectionState: 'none' })
    await wrapper
      .get('[data-testid="catalog-retry-branches"]')
      .trigger('click')
    expect(wrapper.emitted('retry-branches')).toEqual([[]])
    expect(wrapper.emitted('retry')).toBeUndefined()
    expect(wrapper.find('[data-catalog-product-id]').exists()).toBe(false)
  })

  it.each(['loading', 'retry-pending', 'network', 'server', 'rate-limit'] as const)(
    'never calls %s branch discovery an authoritative empty result',
    (branchesState) => {
      const wrapper = mountGrid({ branchesState, selectionState: 'invalid' })
      expect(wrapper.text()).not.toMatch(
        /No hay sucursales publicadas|Esta sucursal no está disponible/,
      )
      expect(wrapper.find('[data-catalog-product-id]').exists()).toBe(false)
    },
  )

  it('lays out one card per product and relays no detail event (the card is a link)', () => {
    const wrapper = mountGrid()

    expect(wrapper.findAll('[data-catalog-product-id]').map((card) => card.text())).toEqual([
      product.name,
    ])
    expect(wrapper.emitted('open-detail')).toBeUndefined()
  })

  it('offers the published branches when the URL names a branch without a catalog', async () => {
    const wrapper = mountGrid({ selectionState: 'invalid', branches })

    expect(wrapper.text()).toContain('Esta sucursal aún no publica su catálogo')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Ver catálogo de Sucursal Centro')!
      .trigger('click')
    expect(wrapper.emitted('select-branch')).toEqual([['centro']])
  })

  it('keeps two compact mobile columns, then three and four as the artboard draws them', () => {
    const wrapper = mountGrid()

    expect(wrapper.classes()).toContain('catalog-container')
    const grid = wrapper.get('[data-testid="catalog-product-grid"]')
    expect(grid.classes()).toEqual(
      expect.arrayContaining(['grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4']),
    )
    expect(grid.classes()).not.toContain('xl:grid-cols-5')
  })

  it.each([
    { branchesState: 'empty' as const },
    { selectionState: 'none' as const },
    { selectionState: 'invalid' as const },
    { contextState: 'context-empty' as const },
    { state: 'loading' as const },
    { state: 'empty' as const },
    { state: 'unavailable' as const },
    { state: 'network' as const },
  ])('keeps state headings below the shell hero h1 (%j)', (props) => {
    const wrapper = mountGrid(props)
    expect(wrapper.find('h1').exists()).toBe(false)
    // Each state has exactly one title: the shared EmptyState's, or the sr-only skeleton heading.
    expect(wrapper.findAll('h2').length + wrapper.findAll('.hf-empty-state__title').length).toBe(1)
  })

  it.each([
    ['none', 'loading'],
    ['invalid', 'loading'],
    ['selected', 'loading'],
    ['selected', 'retry-pending'],
    ['selected', 'empty'],
    ['selected', 'network'],
  ] as const)(
    'renders no card outside the populated state (%s, %s)',
    async (selectionState, state) => {
      const wrapper = mountGrid({ selectionState, state })

      expect(wrapper.find('[data-catalog-product-id]').exists()).toBe(false)
    },
  )

  it('renders context discovery loading without claiming a product failure', () => {
    const wrapper = mountGrid({ contextState: 'context-loading' })

    expect(wrapper.text()).toContain('Cargando listas de precios…')
    expect(wrapper.text()).not.toContain('No pudimos cargar los productos')
    expect(wrapper.find('[data-catalog-product-id]').exists()).toBe(false)
  })

  it.each([
    ['context-empty', 'Este catálogo todavía no tiene listas de precios publicadas'],
    ['context-unavailable', 'La lista de precios seleccionada no está disponible'],
    ['context-no-default', 'Elige una lista de precios para ver productos'],
    ['context-rate-limit', 'Demasiadas solicitudes. Intenta de nuevo más tarde.'],
    ['context-network', 'No se pudo conectar. Inténtalo de nuevo en un momento.'],
    ['context-server', 'No pudimos cargar las listas de precios.'],
  ] as const)(
    'surfaces the %s context state without claiming a product failure',
    (contextState, copy) => {
      const wrapper = mountGrid({ contextState })

      expect(wrapper.text()).toContain(copy)
      expect(wrapper.text()).not.toContain('No pudimos cargar los productos')
      expect(wrapper.text()).not.toContain('Esta sucursal todavía no tiene productos publicados')
      expect(wrapper.find('[data-catalog-product-id]').exists()).toBe(false)
    },
  )

  it.each(['context-empty', 'context-rate-limit', 'context-network', 'context-server'] as const)(
    'offers a separate context-discovery retry for %s',
    async (contextState) => {
      const wrapper = mountGrid({ contextState })

      const retry = wrapper.get('[data-testid="catalog-retry-context"]')
      await retry.trigger('click')

      expect(wrapper.emitted('retry-context')).toHaveLength(1)
      expect(wrapper.emitted('retry')).toBeUndefined()
    },
  )

  it.each(['context-unavailable', 'context-no-default'] as const)(
    'does not offer a blind discovery retry for %s',
    (contextState) => {
      const wrapper = mountGrid({ contextState })

      expect(
        wrapper.find('[data-testid="catalog-retry-context"]').exists(),
      ).toBe(false)
    },
  )

  it('lets the context gate win over an already populated product list', () => {
    const wrapper = mountGrid({ contextState: 'context-no-default', state: 'populated' })

    expect(wrapper.find('[data-catalog-product-id]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Elige una lista de precios para ver productos')
  })

  it('renders a products-state unavailable as a price-context state, never a generic product failure', () => {
    const wrapper = mountGrid({ state: 'unavailable' })

    expect(wrapper.text()).toContain('La lista de precios seleccionada no está disponible')
    expect(wrapper.text()).toContain('Elige otra lista de precios para ver el catálogo.')
    expect(wrapper.text()).not.toContain('No pudimos cargar los productos.')
    expect(wrapper.find('[data-testid="catalog-retry-products"]').exists()).toBe(false)
  })

  it.each(['loading', 'retry-pending'] as const)(
    'shapes the %s state as a card skeleton instead of a spinner',
    (state) => {
      const wrapper = mountGrid({ state, products: [] })
      const skeleton = wrapper.get('[data-testid="catalog-product-skeleton"]')

      expect(skeleton.attributes('aria-busy')).toBe('true')
      const cards = skeleton.findAll('[data-testid="catalog-product-skeleton-card"]')
      expect(cards.length).toBeGreaterThanOrEqual(4)
      // The artboard card shape: a square photo and five lines (brand, two title lines, price, action).
      expect(cards[0]!.findAll('.catalog-skeleton-media')).toHaveLength(1)
      expect(cards[0]!.findAll('.catalog-skeleton-body .catalog-skeleton')).toHaveLength(5)
      expect(wrapper.find('.animate-spin').exists()).toBe(false)
      expect(wrapper.text()).toContain(
        state === 'retry-pending' ? 'Reintentando productos…' : 'Cargando productos…',
      )
    },
  )

  it('marks the failed state as an error and keeps one retry action', async () => {
    const wrapper = mountGrid({ state: 'server', products: [] })
    const section = wrapper.get('[data-testid="catalog-state"]')

    expect(section.attributes('data-kind')).toBe('error')
    expect(section.get('.hf-empty-state__description').text()).toBe(
      'Revisa tu conexión e inténtalo de nuevo. Tus filtros y tu búsqueda se conservan.',
    )
    expect(wrapper.findAll('button')).toHaveLength(1)
    await wrapper.get('[data-testid="catalog-retry-products"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('marks the empty state as empty and never as an error', () => {
    const section = mountGrid({ state: 'empty', products: [] }).get('[data-testid="catalog-state"]')

    expect(section.attributes('data-kind')).toBe('empty')
  })

  it.each([
    ['branches', { branchesState: 'loading' as const, selectionState: 'none' as const }, 'Cargando sucursales…'],
    ['branches retry', { branchesState: 'retry-pending' as const, selectionState: 'none' as const }, 'Cargando sucursales…'],
    ['price lists', { contextState: 'context-loading' as const }, 'Cargando listas de precios…'],
    ['products', { state: 'loading' as const, products: [] }, 'Cargando productos…'],
  ])('shapes the %s loading state as card skeletons, never bare text', (_label, props, label) => {
    const wrapper = mountGrid(props)
    const skeleton = wrapper.get('[data-testid="catalog-product-skeleton"]')

    expect(skeleton.attributes('aria-busy')).toBe('true')
    expect(skeleton.get('.sr-only').text()).toBe(label)
    expect(skeleton.findAll('[data-testid="catalog-product-skeleton-card"]').length).toBeGreaterThanOrEqual(4)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it.each([
    ['branches', { branchesState: 'server' as const, selectionState: 'none' as const }, 'No pudimos cargar las sucursales.', 'catalog-retry-branches'],
    ['price lists', { contextState: 'context-network' as const }, 'No se pudo conectar. Inténtalo de nuevo en un momento.', 'catalog-retry-context'],
    ['products', { state: 'server' as const, products: [] }, 'No pudimos cargar el catálogo', 'catalog-retry-products'],
    ['products rate limit', { state: 'rate-limit' as const, products: [] }, 'Demasiadas consultas seguidas', 'catalog-retry-products'],
  ])('shows the %s failure through the shared error state with Reintentar', async (_label, props, title, retryId) => {
    const wrapper = mountGrid(props)
    const state = wrapper.get('[data-testid="catalog-state"]')

    expect(state.classes()).toContain('hf-empty-state')
    expect(state.attributes('data-kind')).toBe('error')
    expect(state.attributes('role')).toBe('alert')
    expect(state.get('.hf-empty-state__title').text()).toBe(title)
    expect(wrapper.find('.catalog-state-title').exists()).toBe(false)
    expect(wrapper.get(`[data-testid="${retryId}"]`).text()).toBe('Reintentar')
  })

  it('keeps an empty branch list as an empty state with its own Actualizar action', async () => {
    const wrapper = mountGrid({ branchesState: 'empty', selectionState: 'none' })
    const state = wrapper.get('[data-testid="catalog-state"]')

    expect(state.attributes('data-kind')).toBe('empty')
    expect(state.get('.hf-empty-state__description').text()).toContain('Vuelve a consultar más tarde')
    expect(wrapper.get('[data-testid="catalog-retry-branches"]').text()).toBe('Actualizar')
  })
})
