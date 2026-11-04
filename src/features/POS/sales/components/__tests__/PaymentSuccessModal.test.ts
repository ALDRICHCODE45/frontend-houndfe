import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentSuccessModal from '../PaymentSuccessModal.vue'

const stubs = {
  UModal: {
    props: ['open', 'title', 'description', 'ui'],
    emits: ['update:open'],
    template: '<div><slot name="body" /><slot name="footer" /></div>',
  },
  Modal: {
    props: ['open', 'title', 'description', 'ui'],
    emits: ['update:open'],
    template: '<div><slot name="body" /><slot name="footer" /></div>',
  },
  UIcon: { template: '<span />' },
  UBadge: { props: ['color', 'variant'], template: '<span :data-color="color"><slot /></span>' },
  Badge: { props: ['color', 'variant'], template: '<span :data-color="color"><slot /></span>' },
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
  Button: { template: '<button v-bind="$attrs"><slot /></button>' },
}

function mountModal(overrides: Record<string, unknown> = {}) {
  return mount(PaymentSuccessModal, {
    props: {
      open: true,
      folio: 'A-1',
      totalCents: 10000,
      paidCents: 10000,
      changeDueCents: 0,
      confirmedAt: '2026-05-15T12:00:00.000Z',
      ...overrides,
    },
    global: { stubs },
  })
}

describe('PaymentSuccessModal', () => {
  it('hides debt section when debtCents is 0', () => {
    const wrapper = mountModal({ debtCents: 0, paymentStatus: 'PAID' })

    expect(wrapper.text()).not.toContain('Deuda generada')
  })

  it('shows debt row with warning badge for PARTIAL status', () => {
    const wrapper = mountModal({ debtCents: 3500, paymentStatus: 'PARTIAL' })

    expect(wrapper.text()).toContain('Deuda generada')
    expect(wrapper.text()).toContain('$35.00')
    expect(wrapper.text()).toContain('Parcial')
    expect(wrapper.find('[data-color="warning"]').exists()).toBe(true)
  })

  it('shows debt row with error badge for CREDIT status', () => {
    const wrapper = mountModal({ debtCents: 10000, paymentStatus: 'CREDIT' })

    expect(wrapper.text()).toContain('Deuda generada')
    expect(wrapper.text()).toContain('$100.00')
    expect(wrapper.text()).toContain('Crédito')
    expect(wrapper.find('[data-color="error"]').exists()).toBe(true)
  })

  it('Cambio dd renders heading ink when changeDueCents > 0 [PMT-REQ-003]', () => {
    const wrapper = mountModal({ changeDueCents: 500 })

    const cambioRow = wrapper.find('dd.text-\\(--hf-heading\\)')
    expect(cambioRow.exists()).toBe(true)
    expect(cambioRow.text()).toContain('$5.00')
  })

  it('Cerrar button takes the shared primary control [PMT-REQ-004]', () => {
    const wrapper = mountModal()

    const closeButton = wrapper.get('button')
    expect(closeButton.classes()).toContain('hf-primary-control')
    expect(closeButton.classes()).not.toContain('!bg-(--brand-action)')
  })
})
