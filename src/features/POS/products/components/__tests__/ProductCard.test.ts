import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import ProductCard from '../ProductCard.vue'
import type { Product } from '../../interfaces/product.types'

const product = {
  id: 'prod-1',
  name: 'Alpha',
  sku: 'ALPHA',
  barcode: null,
  categoryId: 'cat-1',
  categoryName: 'Food',
  brandId: 'brand-1',
  brandName: 'Brand',
  priceCents: 1299,
  quantity: 5,
  minQuantity: 1,
  useStock: true,
  hasVariants: false,
  useLotsAndExpirations: false,
  sellInPos: true,
  includeInOnlineCatalog: true,
  requiresPrescription: false,
  chargeProductTaxes: true,
  variantStockTotal: null,
  variantCount: null,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} satisfies Product

function mountComponent(overrideProps: Record<string, unknown> = {}) {
  return shallowMount(ProductCard, {
    props: {
      product,
      currencyFormatter: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
      ...overrideProps,
    },
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        AppBadge: { template: '<span><slot /></span>' },
        StatusDotBadge: { template: '<span><slot /></span>' },
        DotBadge: { template: '<span><slot /></span>' },
        EntityAvatar: { template: '<div data-testid="avatar" />' },
        UButton: { template: '<button><slot /></button>' },
        Button: { template: '<button><slot /></button>' },
        UDropdownMenu: {
          name: 'UDropdownMenu',
          template: `
            <div>
              <slot />
              <div v-for="(group, groupIndex) in items" :key="groupIndex">
                <span v-for="item in group" :key="item.label">{{ item.label }}</span>
              </div>
            </div>
          `,
          props: ['items'],
        },
        DropdownMenu: {
          template: `
            <div>
              <slot />
              <div v-for="(group, groupIndex) in items" :key="groupIndex">
                <span v-for="item in group" :key="item.label">{{ item.label }}</span>
              </div>
            </div>
          `,
          props: ['items'],
        },
      },
    },
  })
}

describe('ProductCard', () => {
  it('is keyboard accessible when card details are allowed', async () => {
    const wrapper = mountComponent({ canRead: true })
    const card = wrapper.get('article')

    expect(card.attributes('role')).toBe('button')
    expect(card.attributes('tabindex')).toBe('0')

    await card.trigger('keydown', { key: 'Enter' })
    await card.trigger('keydown', { key: ' ' })

    expect(wrapper.emitted('click')).toHaveLength(2)
    expect(wrapper.emitted('click')?.[0]).toEqual([product])
  })

  it('does not route to details when a key is pressed inside the actions menu', async () => {
    const wrapper = mountComponent({ canRead: true, canUpdate: true })
    const actionsWrapper = wrapper.get('[class*="absolute"]')

    await actionsWrapper.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('does not expose interactive semantics when details are not allowed', () => {
    const wrapper = mountComponent({ canRead: false })
    const card = wrapper.get('article')

    expect(card.attributes('role')).toBeUndefined()
    expect(card.attributes('tabindex')).toBeUndefined()
  })

  it('mirrors permission-gated actions for details, edit, and delete', () => {
    const wrapper = mountComponent({ canRead: true, canUpdate: true, canDelete: false })

    expect(wrapper.text()).toContain('Detalles')
    expect(wrapper.text()).toContain('Editar')
    expect(wrapper.text()).not.toContain('Eliminar')
  })
})
