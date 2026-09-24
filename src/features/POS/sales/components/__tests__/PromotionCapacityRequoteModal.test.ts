import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PromotionCapacityRequoteModal from '../PromotionCapacityRequoteModal.vue'

const modalStub = {
  name: 'UModal',
  props: ['open', 'title', 'description', 'dismissible', 'close'],
  emits: ['update:open'],
  template:
    '<div role="dialog" :data-open="open"><h2 data-testid="requote-dialog-title">{{ title }}</h2><p data-testid="requote-dialog-description">{{ description }}</p><slot name="body" /><slot name="footer" /><button data-testid="stub-modal-close" @click="$emit(\'update:open\', false)">x</button></div>',
}

const buttonStub = {
  props: ['label', 'disabled', 'loading'],
  emits: ['click'],
  template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot />{{ label }}</button>',
}

const stubs = {
  UModal: modalStub,
  Modal: modalStub,
  UButton: buttonStub,
  Button: buttonStub,
  UBadge: { template: '<span><slot /></span>' },
  Badge: { template: '<span><slot /></span>' },
  UAlert: {
    props: ['title', 'description'],
    template: '<div role="alert"><p>{{ title }}</p><p>{{ description }}</p></div>',
  },
  UIcon: { template: '<span />' },
  Icon: { template: '<span />' },
}

const excludedPromotions = [
  { id: 'promo-line-1', label: 'Descuento de línea' },
  { id: 'promo-order-1', label: 'Promo de orden' },
]

function mountModal(props: Record<string, unknown> = {}) {
  return mount(PromotionCapacityRequoteModal, {
    props: {
      open: true,
      subtotalCents: 10000,
      discountCents: 1500,
      totalCents: 8500,
      excludedPromotions,
      ...props,
    },
    global: { stubs },
  })
}

describe('PromotionCapacityRequoteModal — content', () => {
  it('renders the newly accepted server subtotal, discount, and total', () => {
    const wrapper = mountModal()

    expect(wrapper.get('[data-testid="requote-subtotal"]').text()).toContain('$100.00')
    expect(wrapper.get('[data-testid="requote-discount"]').text()).toContain('$15.00')
    expect(wrapper.get('[data-testid="requote-total"]').text()).toContain('$85.00')
  })

  it('lists each excluded promotion marked as no longer applicable', () => {
    const wrapper = mountModal()

    const rows = wrapper.findAll('[data-testid="requote-excluded-promotion"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Descuento de línea')
    expect(rows[0]!.text()).toContain('Ya no aplicable')
    expect(rows[1]!.text()).toContain('Promo de orden')
    expect(rows[1]!.text()).toContain('Ya no aplicable')
  })

  it('instructs the cashier to review payments and confirm again (no auto-charge copy)', () => {
    const wrapper = mountModal()

    expect(wrapper.text()).toContain('Revisá los pagos y confirmá el cobro nuevamente')
  })

  it('omits the excluded list when no promotions were excluded', () => {
    const wrapper = mountModal({ excludedPromotions: [] })

    expect(wrapper.find('[data-testid="requote-excluded-list"]').exists()).toBe(false)
    // Totals still render — the re-quote is still valid with an empty subset.
    expect(wrapper.get('[data-testid="requote-total"]').text()).toContain('$85.00')
  })
})

describe('PromotionCapacityRequoteModal — accessibility and responsiveness', () => {
  it('exposes a dialog with a title and a description', () => {
    const wrapper = mountModal()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="requote-dialog-title"]').text().length).toBeGreaterThan(0)
    expect(wrapper.get('[data-testid="requote-dialog-description"]').text().length).toBeGreaterThan(
      0,
    )
  })

  it('renders the footer with the stacked-to-row responsive pattern', () => {
    const wrapper = mountModal()

    const footer = wrapper.get('[data-testid="requote-footer"]')
    expect(footer.classes()).toContain('flex-col')
    expect(footer.classes()).toContain('sm:flex-row')
  })
})

describe('PromotionCapacityRequoteModal — explicit acceptance gate', () => {
  it('renders UModal as non-dismissible and without a close affordance', () => {
    const wrapper = mountModal()

    const modal = wrapper.findComponent({ name: 'UModal' })
    expect(modal.props('dismissible')).toBe(false)
    expect(modal.props('close')).toBe(false)
  })

  it('emits accept only from the explicit accept control', async () => {
    const wrapper = mountModal()

    expect(wrapper.emitted('accept')).toBeUndefined()

    await wrapper.get('[data-testid="requote-accept"]').trigger('click')

    expect(wrapper.emitted('accept')).toHaveLength(1)
  })

  it('never forwards a dismiss-driven close and never accepts from dismissal', async () => {
    const wrapper = mountModal()

    // Nuxt UI dismissal (escape / backdrop / X) would emit update:open=false.
    await wrapper.get('[data-testid="stub-modal-close"]').trigger('click')

    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(wrapper.emitted('accept')).toBeUndefined()
  })
})
