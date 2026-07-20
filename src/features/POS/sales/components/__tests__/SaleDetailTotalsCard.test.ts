import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleDetailTotalsCard from '../SaleDetailTotalsCard.vue'

describe('SaleDetailTotalsCard', () => {
  it('renders subtotal discount and total values', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 127000,
        discountCents: 0,
        totalCents: 127000,
        paidCents: 127000,
        debtCents: 0,
        changeDueCents: 0,
      },
    })

    expect(wrapper.text()).toContain('Subtotal')
    expect(wrapper.text()).toContain('$1,270.00')
  })

  it('hides Descuentos row when discountCents is 0', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 0,
        totalCents: 100000,
        paidCents: 100000,
        debtCents: 0,
        changeDueCents: 0,
      },
    })

    expect(wrapper.text()).not.toContain('Descuentos')
  })

  it('shows Descuentos row when discountCents > 0', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 5000,
        totalCents: 95000,
        paidCents: 95000,
        debtCents: 0,
        changeDueCents: 0,
      },
    })

    expect(wrapper.text()).toContain('Descuentos')
    expect(wrapper.text()).toContain('$50.00')
  })

  it('renders discount value with a leading minus sign', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 340000,
        discountCents: 14000,
        totalCents: 326000,
        paidCents: 326000,
        debtCents: 0,
        changeDueCents: 0,
      },
    })

    const discountValue = wrapper.get('[data-testid="totals-discount-value"]')
    expect(discountValue.text()).toBe('-$140.00')
  })

  // sales-detail-redesign: receipt totals now show the full payment
  // summary (Pagado, Deuda, Cambio) below the highlighted Total, matching
  // the PDF receipt layout.
  it('always renders Pagado and Deuda rows with the formatted cents', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 0,
        totalCents: 100000,
        paidCents: 60000,
        debtCents: 40000,
        changeDueCents: 0,
      },
    })

    expect(wrapper.text()).toContain('Pagado')
    expect(wrapper.text()).toContain('$600.00')
    expect(wrapper.text()).toContain('Deuda')
    expect(wrapper.text()).toContain('$400.00')
  })

  it('hides Cambio row when changeDueCents is 0', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 0,
        totalCents: 100000,
        paidCents: 100000,
        debtCents: 0,
        changeDueCents: 0,
      },
    })

    expect(wrapper.find('[data-testid="totals-change-row"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Cambio')
  })

  it('shows Cambio row when changeDueCents > 0', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 0,
        totalCents: 100000,
        paidCents: 110000,
        debtCents: 0,
        changeDueCents: 10000,
      },
    })

    expect(wrapper.find('[data-testid="totals-change-row"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('$100.00')
  })

  it('colors Deuda red when there is outstanding debt', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 0,
        totalCents: 100000,
        paidCents: 50000,
        debtCents: 50000,
        changeDueCents: 0,
      },
    })

    const debtRow = wrapper.get('[data-testid="totals-debt-row"]')
    const valueSpan = debtRow.findAll('span').find((s) => s.text().includes('$500.00'))
    expect(valueSpan).toBeDefined()
    expect(valueSpan?.classes()).toContain('text-error-600')
  })

  it('colors Deuda green when there is no debt', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 0,
        totalCents: 100000,
        paidCents: 100000,
        debtCents: 0,
        changeDueCents: 0,
      },
    })

    const debtRow = wrapper.get('[data-testid="totals-debt-row"]')
    const valueSpan = debtRow.findAll('span').find((s) => s.text().includes('$0.00'))
    expect(valueSpan).toBeDefined()
    expect(valueSpan?.classes()).toContain('text-success-600')
  })

  it('hides Registrar Pago button when canRegisterPayment is false or unset', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 0,
        totalCents: 100000,
        paidCents: 100000,
        debtCents: 0,
        changeDueCents: 0,
      },
    })

    expect(wrapper.find('[data-testid="register-debt-payment"]').exists()).toBe(false)
  })

  it('shows Registrar Pago button when canRegisterPayment is true', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 0,
        totalCents: 100000,
        paidCents: 50000,
        debtCents: 50000,
        changeDueCents: 0,
        canRegisterPayment: true,
      },
    })

    expect(wrapper.find('[data-testid="register-debt-payment"]').exists()).toBe(true)
  })

  it('disables Registrar Pago button while isPaymentSubmitting is true', () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 0,
        totalCents: 100000,
        paidCents: 50000,
        debtCents: 50000,
        changeDueCents: 0,
        canRegisterPayment: true,
        isPaymentSubmitting: true,
      },
    })

    const button = wrapper.get('[data-testid="register-debt-payment"]')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('emits register-payment when Registrar Pago button is clicked', async () => {
    const wrapper = mount(SaleDetailTotalsCard, {
      props: {
        subtotalCents: 100000,
        discountCents: 0,
        totalCents: 100000,
        paidCents: 50000,
        debtCents: 50000,
        changeDueCents: 0,
        canRegisterPayment: true,
      },
    })

    await wrapper.get('[data-testid="register-debt-payment"]').trigger('click')
    expect(wrapper.emitted('register-payment')).toBeTruthy()
  })
})