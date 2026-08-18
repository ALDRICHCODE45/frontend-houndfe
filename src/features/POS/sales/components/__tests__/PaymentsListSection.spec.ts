import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import PaymentsListSection from '../PaymentsListSection.vue'
import type { SaleDetailPayment } from '../../interfaces/sale.types'

function makePayment(overrides: Partial<SaleDetailPayment> = {}): SaleDetailPayment {
  return {
    paymentId: 'pay-1',
    method: 'CARD_DEBIT',
    amountCents: 127000,
    tenderedCents: 127000,
    changeCents: 0,
    reference: 'AUTH-1',
    paidAt: '2026-05-06T14:43:00.000Z',
    ...overrides,
  }
}

function mountSection(props: Record<string, unknown>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
  return mountWithUApp(PaymentsListSection, {
    props,
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })
}

describe('PaymentsListSection', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders one row per payment (3 rows for 3 payments)', async () => {
    mountSection({
      payments: [
        makePayment({ paymentId: 'pay-1', method: 'CASH', amountCents: 1000, reference: null }),
        makePayment({ paymentId: 'pay-2', method: 'CARD_DEBIT', amountCents: 5000, reference: 'AUTH-2' }),
        makePayment({ paymentId: 'pay-3', method: 'TRANSFER', amountCents: 2000, reference: 'TRF-3' }),
      ],
      loading: false,
    })
    await flushPromises()

    expect(document.querySelector('[data-testid="payment-row-pay-1"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="payment-row-pay-2"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="payment-row-pay-3"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="payments-count"]')?.textContent).toBe('3')
  })

  it('shows the edit button for non-CASH rows', async () => {
    mountSection({
      payments: [makePayment({ paymentId: 'pay-1', method: 'CARD_DEBIT' })],
      loading: false,
    })
    await flushPromises()

    expect(document.querySelector('[data-testid="payment-edit-pay-1"]')).not.toBeNull()
  })

  it('hides the edit button for CASH rows', async () => {
    mountSection({
      payments: [makePayment({ paymentId: 'pay-1', method: 'CASH', reference: null })],
      loading: false,
    })
    await flushPromises()

    expect(document.querySelector('[data-testid="payment-edit-pay-1"]')).toBeNull()
  })

  it('shows an empty hint when there are no payments and not loading', async () => {
    mountSection({ payments: [], loading: false })
    await flushPromises()

    const empty = document.querySelector('[data-testid="payments-list-empty"]')
    expect(empty).not.toBeNull()
    expect(empty?.textContent).toContain('Sin pagos registrados')
  })

  it('renders skeleton rows while loading', async () => {
    mountSection({ payments: [], loading: true })
    await flushPromises()

    expect(document.querySelector('[data-testid="payments-list-skeleton"]')).not.toBeNull()
  })

  it('clicking the edit button opens the slideover and submitting forwards the payload', async () => {
    const wrapper = mountSection({
      payments: [makePayment({ paymentId: 'pay-1', method: 'CARD_DEBIT', reference: 'AUTH-1' })],
      loading: false,
    })
    await flushPromises()

    const editBtn = document.querySelector('[data-testid="payment-edit-pay-1"]') as HTMLElement
    editBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    // The embedded slideover teleports to document.body.
    const input = document.querySelector('input[data-testid="edit-reference-input"]') as HTMLInputElement
    expect(input.value).toBe('AUTH-1')

    input.value = 'AUTH-99'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    const submitBtn = document.querySelector('[data-testid="edit-reference-submit"]') as HTMLElement
    submitBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { paymentId: 'pay-1', reference: 'AUTH-99' },
    ])
  })

  it('truncates reference longer than 20 chars with an ellipsis', async () => {
    const longRef = 'A'.repeat(30)
    mountSection({
      payments: [makePayment({ paymentId: 'pay-1', method: 'CARD_DEBIT', reference: longRef })],
      loading: false,
    })
    await flushPromises()

    const refCell = document.querySelector('[data-testid="payment-reference-pay-1"]') as HTMLElement
    expect(refCell.textContent).toContain('…')
    expect(refCell.textContent?.length ?? 0).toBeLessThan(longRef.length + 1)
  })

  it('shows "Sin referencia" italic when reference is null', async () => {
    mountSection({
      payments: [makePayment({ paymentId: 'pay-1', method: 'CARD_DEBIT', reference: null })],
      loading: false,
    })
    await flushPromises()

    expect(document.body.textContent).toContain('Sin referencia')
  })
})