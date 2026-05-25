import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentTotalsRow from '../PaymentTotalsRow.vue'

describe('PaymentTotalsRow', () => {
  it('renders received amount formatted', () => {
    const wrapper = mount(PaymentTotalsRow, {
      props: {
        totalCents: 80000,
        receivedCents: 30000,
      },
    })

    expect(wrapper.text()).toContain('Recibido')
    expect(wrapper.text()).toContain('$300.00')
  })

  it('renders remaining amount (total - received) formatted', () => {
    const wrapper = mount(PaymentTotalsRow, {
      props: {
        totalCents: 80000,
        receivedCents: 30000,
      },
    })

    expect(wrapper.text()).toContain('Restante')
    expect(wrapper.text()).toContain('$500.00')
  })

  it('shows warning style when remaining > 0 and success style when remaining is 0', async () => {
    const wrapper = mount(PaymentTotalsRow, {
      props: {
        totalCents: 80000,
        receivedCents: 30000,
      },
    })

    expect(wrapper.get('[data-testid="payment-remaining-value"]').classes()).toContain('text-error-500')

    await wrapper.setProps({ receivedCents: 80000 })

    expect(wrapper.get('[data-testid="payment-remaining-value"]').classes()).toContain('text-success-600')
  })

  it('shows aggregate error text when error prop is set', () => {
    const wrapper = mount(PaymentTotalsRow, {
      props: {
        totalCents: 80000,
        receivedCents: 20000,
        error: 'El total supera la deuda',
      },
    })

    expect(wrapper.text()).toContain('El total supera la deuda')
  })
})
