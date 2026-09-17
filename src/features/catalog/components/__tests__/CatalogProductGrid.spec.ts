import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogProductGrid from '@/features/catalog/components/CatalogProductGrid.vue'

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
})
