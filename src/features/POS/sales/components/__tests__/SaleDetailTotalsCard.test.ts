import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleDetailTotalsCard from '../SaleDetailTotalsCard.vue'

// WU-E: global stubs so the test environment provides a pass-through UCard
// (testid + classes pass via $attrs) and a neutral UButton. The card's
// header + body now live inside the UCard, so we need it to render its
// slots and forward attrs to the root div to keep testid lookups working.
const globalStubs = {
  UCard: { template: '<div v-bind="$attrs"><slot /></div>' },
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
}

// Helper so every `mount(SaleDetailTotalsCard, ...)` call picks up the WU-E
// stubs without per-test boilerplate. We intentionally relax the options
// type to `any` here so each call site keeps its precise props payload
// without dragging the full MountingOptions generic through.
function mountCard(options: Record<string, any> = {}) {
  const stubs = { ...globalStubs, ...(options.global?.stubs ?? {}) }
  const global = { ...(options.global ?? {}), stubs }
  return mount(SaleDetailTotalsCard as any, { ...options, global })
}

describe('SaleDetailTotalsCard', () => {
  it('renders subtotal discount and total values', () => {
    const wrapper = mountCard({
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
    const wrapper = mountCard({
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
    const wrapper = mountCard({
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
    const wrapper = mountCard({
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
    const wrapper = mountCard({
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
    const wrapper = mountCard({
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
    const wrapper = mountCard({
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
    const wrapper = mountCard({
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
    const wrapper = mountCard({
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
    const wrapper = mountCard({
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
    const wrapper = mountCard({
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
    const wrapper = mountCard({
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
    const wrapper = mountCard({
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

  // HST-REQ-003: register-debt-payment UButton follows the Cobrar precedent
  // (gold action background, !text-black override, rounded-xl, font-semibold,
  // shadow-sm) so both the totals card and the header CTA open the same modal
  // with identical visual prominence.
  it('pins Cobrar precedent on the Registrar Pago button (HST-REQ-003)', () => {
    const wrapper = mountCard({
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

    const button = wrapper.get('[data-testid="register-debt-payment"]')
    expect(button.classes()).toEqual(expect.arrayContaining(['!bg-(--brand-action)', '!text-black', 'rounded-xl', 'font-semibold', 'shadow-sm']))
  })

  // ── sale-detail-redesign WU-E — wrap totals in UCard with header
  describe('SaleDetailTotalsCard card wrapping (WU-E)', () => {
    it('wraps the totals in a UCard with "Totales" header inside the header slot', () => {
      const wrapper = mountCard({
        props: {
          subtotalCents: 100000,
          discountCents: 0,
          totalCents: 100000,
          paidCents: 100000,
          debtCents: 0,
          changeDueCents: 0,
        },
      })

      // "Totales" title is rendered inside an <h3> (header text)
      const headers = wrapper.findAll('h3').filter((h) => h.text().includes('Totales'))
      expect(headers.length).toBeGreaterThan(0)
      expect(headers[0]?.text()).toBe('Totales')

      // Strong structural assertion: the root element rendered by the
      // component is now the UCard wrapper (data-slot="root" on real UCard,
      // or our pass-through stub div carrying the UCard signature). The
      // previous <section> root is gone.
      const root = wrapper.element as HTMLElement
      // The component root no longer has the "space-y-2" classes the old
      // <section> used — those moved into the inner content div.
      expect(root.className).not.toContain('space-y-2')
    })

    it('preserves all totals-* testids inside the UCard body', () => {
      const wrapper = mountCard({
        props: {
          subtotalCents: 100000,
          discountCents: 5000,
          totalCents: 95000,
          paidCents: 50000,
          debtCents: 45000,
          changeDueCents: 0,
        },
      })

      expect(wrapper.find('[data-testid="totals-subtotal-value"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="totals-discount-row"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="totals-discount-value"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="totals-total-value"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="totals-paid-row"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="totals-debt-row"]').exists()).toBe(true)
    })
  })
})