import { afterEach, describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductCard from '../ProductCard.vue'
import type { Product } from '../../interfaces/product.types'

const product = {
  id: 'prod-1',
  name: 'Alpha',
  type: 'PRODUCT',
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
        StatusDotBadge: { template: '<span><slot /></span>' },
        DotBadge: { template: '<span><slot /></span>' },
        EntityAvatar: { template: '<div data-testid="avatar" />' },
        UButton: { template: '<button><slot /></button>' },
        Button: { template: '<button><slot /></button>' },
        UDropdownMenu: {
          name: 'UDropdownMenu',
          template: `
            <div data-testid="actions-menu" :data-ui-content="ui && ui.content">
              <slot />
              <div v-for="(group, groupIndex) in items" :key="groupIndex">
                <span v-for="item in group" :key="item.label">{{ item.label }}</span>
              </div>
            </div>
          `,
          props: ['items', 'ui'],
        },
        DropdownMenu: {
          name: 'DropdownMenu',
          template: `
            <div data-testid="actions-menu" :data-ui-content="ui && ui.content">
              <slot />
              <div v-for="(group, groupIndex) in items" :key="groupIndex">
                <span v-for="item in group" :key="item.label">{{ item.label }}</span>
              </div>
            </div>
          `,
          props: ['items', 'ui'],
        },
      },
    },
  })
}

    describe('ProductCard shrink containment (S2)', () => {
      it('keeps the card root shrinkable within its grid track', () => {
        const wrapper = mountComponent({ canRead: true })
        const card = wrapper.get('article')

        expect(card.classes()).toEqual(
          expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full']),
        )
      })

      it('truncates long SKU/brand fields and keeps the name line-clamped without a scroll container', () => {
        const longProduct = {
          ...product,
          name: 'Tinta para plotter de gran formato eco-solvente serie X edition',
          sku: 'SKU-PLT-XG-ECO-SOLVENT-2026-BLACK-1L-REFILL',
          brandName: 'Distribuidora Internacional de Insumos de Impresión',
        } satisfies Product
        const wrapper = mountComponent({ product: longProduct, canRead: true })
        const card = wrapper.get('article')

        // Long values render (readability) inside field-specific truncation
        // contracts — never asserted as jsdom geometry.
        expect(card.text()).toContain(longProduct.sku)
        expect(card.text()).toContain(longProduct.brandName)

        const paragraphs = card.findAll('p')
        expect(paragraphs.some((p) => p.classes().includes('line-clamp-2'))).toBe(true)
        expect(
          paragraphs.some((p) => p.classes().includes('truncate') && p.classes().includes('font-mono')),
        ).toBe(true)

        // Card mode must never become its own horizontal scroll container.
        expect(card.classes()).not.toContain('overflow-x-auto')
      })

      it('keeps the kebab absolutely pinned and propagation-guarded beside long content', async () => {
        const longProduct = { ...product, name: 'N'.repeat(120) } satisfies Product
        const wrapper = mountComponent({ product: longProduct, canRead: true, canUpdate: true })
        const actionsWrapper = wrapper.get('[class*="absolute"]')

        expect(Array.from(actionsWrapper.classes())).toEqual(
          expect.arrayContaining(['absolute', 'right-3', 'top-3', 'z-10']),
        )

        await actionsWrapper.trigger('click')
        expect(wrapper.emitted('click')).toBeUndefined()
      })

      it('retains field-specific truncation on SKU, brand, price, and date cells', () => {
        const wrapper = mountComponent({ canRead: true })

        const truncateParagraphs = wrapper
          .findAll('p')
          .filter((p) => p.classes().includes('truncate'))
        expect(truncateParagraphs.length).toBeGreaterThanOrEqual(4)
      })
    })

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

  it('uses theme-default surface + primary hover border (REQ: align to EmployeeCard tokens)', () => {
    const wrapper = mountComponent({ canRead: true })
    const card = wrapper.get('article')

    // EmployeeCard-aligned tokens: bg-default/border-default surface +
    // hover:border-primary/30. The legacy coco-neutral-50/950 surface and
    // hover:border-coco-gold-500/30 tokens are gone.
    expect(card.classes()).toEqual(
      expect.arrayContaining([
        'bg-default',
        'border-default',
        'hover:border-primary/30',
      ]),
    )
    expect(card.classes()).not.toContain('bg-coco-neutral-50')
    expect(card.classes()).not.toContain('hover:border-coco-gold-500/30')
  })

  it('carries the shared products-card hook and themes the teleported actions menu', () => {
    const wrapper = mountComponent({ canRead: true, canUpdate: true })

    // T2 pilot hook consumed by the T1 shared presentation stylesheet.
    expect(wrapper.get('article').classes()).toContain('products-card')

    // The dropdown is portaled out of the card, so the theme boundary must
    // travel through the native Nuxt UI `:ui.content` slot contract.
    const menu = wrapper.get('[data-testid="actions-menu"]')
    expect(menu.attributes('data-ui-content')).toBe(
      'hf-theme hf-ui hf-shell-products-portal',
    )

    // Actions stay reachable and permission-gated exactly as before.
    expect(wrapper.text()).toContain('Detalles')
    expect(wrapper.text()).toContain('Editar')
  })
})

// ─── Products-visual badge marker (T2 / S3) ──────────────────────────────────
// The card only carries an inert class hook on its badge calls; badge content,
// permissions, and events are untouched.

describe('ProductCard products-visual badge hook (T2 / S3)', () => {
  it('marks every badge call with the inert products-badge hook', () => {
    const wrapper = mountComponent({ canRead: true })

    // Category DotBadge + status StatusDotBadge + stock DotBadge.
    expect(wrapper.findAll('.products-badge')).toHaveLength(3)
  })
})

// ─── Product portal standalone palette (S1-S5) ────────────────────────────
// The row-action menu is teleported outside the (unmounted) shell ancestor,
// so the marker must reach the real installed DropdownMenu content. This is
// a real forwarding check, not an own-string assertion.

describe('ProductCard real installed actions portal (S1-S5)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('forwards the products portal hook into the installed dropdown content', async () => {
    const wrapper = mountWithUApp(ProductCard, {
      props: {
        product,
        currencyFormatter: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }),
        canRead: true,
        canUpdate: true,
      },
      global: {
        stubs: {
          StatusDotBadge: { template: '<span><slot /></span>' },
          DotBadge: { template: '<span><slot /></span>' },
          EntityAvatar: { template: '<div data-testid="avatar" />' },
        },
      },
    })

    await wrapper.get('button[aria-label="Acciones del producto"]').trigger('click')
    await nextTick()

    const content = document.body.querySelector<HTMLElement>(
      '[data-slot="content"].hf-shell-products-portal',
    )
    expect(
      content,
      'the installed actions menu content must carry the products portal hook',
    ).not.toBeNull()
    expect(content!.classList.contains('hf-theme')).toBe(true)
    expect(content!.classList.contains('hf-ui')).toBe(true)
  })
})
