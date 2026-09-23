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

const stubs = { UIcon: defineComponent({ setup: () => () => h('span') }) }
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
  it('relays the exact product ID from a populated real card', async () => {
    const wrapper = mountGrid()

    const card = wrapper.get(`button[aria-label="Ver detalles de ${product.name}"]`)
    await card.trigger('click')

    expect(wrapper.emitted('open-detail')).toEqual([[product.id, card.element]])
  })

  it('lays out one compact column, two tablet columns and four desktop columns', () => {
    const wrapper = mountGrid()

    const grid = wrapper.get('[data-testid="catalog-product-grid"]')
    expect(grid.classes()).toEqual(
      expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4']),
    )
  })

  it.each([
    ['none', 'loading'],
    ['invalid', 'loading'],
    ['selected', 'loading'],
    ['selected', 'retry-pending'],
    ['selected', 'empty'],
    ['selected', 'network'],
  ] as const)(
    'does not emit detail events outside populated cards (%s, %s)',
    async (selectionState, state) => {
      const wrapper = mountGrid({ selectionState, state })

      expect(wrapper.find('[data-catalog-product-id]').exists()).toBe(false)
      expect(wrapper.emitted('open-detail')).toBeUndefined()
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
    ['context-network', 'No se pudo conectar. Revisa tu conexión.'],
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

      const retry = wrapper.get('button[aria-label="Reintentar carga de listas de precios"]')
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
        wrapper.find('button[aria-label="Reintentar carga de listas de precios"]').exists(),
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
    expect(wrapper.find('button[aria-label="Reintentar productos"]').exists()).toBe(false)
  })
})
