import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { CalendarDate, CalendarDateTime } from '@internationalized/date'
import type { PendingRefundListRow } from '../../composables/usePendingRefundsList'

const settle = vi.hoisted(() => ({ submit: vi.fn(), reset: vi.fn() }))
vi.mock('../../composables/useSettleRefund', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue')
  return { useSettleRefund: () => ({ submit: settle.submit, reset: settle.reset, isSubmitting: ref(false) }) }
})

const cash = vi.hoisted(() => ({ sessions: [] as { id: string }[] }))
vi.mock('@/features/POS/cash-register/composables/useCashSaleSession', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue')
  return { useCashSaleSession: () => ({ availableSessions: computed(() => cash.sessions) }) }
})

const confirmLeave = vi.hoisted(() => vi.fn())
vi.mock('@/core/shared/composables/useLeaveGuard', () => ({
  useLeaveGuard: vi.fn(),
  confirmLeave,
}))

const toastAdd = vi.hoisted(() => vi.fn())
vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({ useToast: () => ({ add: toastAdd }) }))

import SettleRefundSlideover from '../SettleRefundSlideover.vue'

const SESSION = '7f1c2a90-3b4d-4e5f-8a6b-1c2d3e4f5a6b'

function refund(patch: Partial<PendingRefundListRow> = {}): PendingRefundListRow {
  return {
    id: 'cmw2iwsa00000r965efhf292s',
    saleId: '291e8f35-0c17-46df-8c87-6ad6cbfdcd46',
    method: 'cash',
    amountCents: 6555,
    settledCents: 2000,
    outstandingCents: 4555,
    reason: 'CUSTOMER_REQUEST',
    status: 'PENDING',
    createdAt: '2026-10-21T20:42:00.000Z',
    folioLabel: 'A-202611-000022',
    customerLabel: 'María Fernanda López',
    saleFound: true,
    ...patch,
  }
}

const USlideover = {
  name: 'USlideover',
  props: ['open'],
  emits: ['update:open', 'close:prevent'],
  template: '<div v-if="open" data-testid="slideover"><slot name="content" /></div>',
}

function mountPanel(row = refund()) {
  const open = ref(true)
  const wrapper = mount(SettleRefundSlideover, {
    attachTo: document.body,
    props: {
      open: open.value,
      refund: row,
      'onUpdate:open': (value: boolean) => {
        open.value = value
        void wrapper.setProps({ open: value })
      },
    },
    global: { stubs: { USlideover, Slideover: USlideover } },
  })
  return { wrapper, open }
}

const amountInput = (w: ReturnType<typeof mountPanel>['wrapper']) => w.get<HTMLInputElement>('#settle-amount')
const primary = (w: ReturnType<typeof mountPanel>['wrapper']) => w.get('[data-testid="settle-submit"]')

function settledResponse(outstandingCents: number, amountCents: number) {
  return {
    status: 'settled',
    request: { amountCents, method: 'cash', settledAt: 'x' },
    response: {
      settlementId: 'id',
      refundId: 'cmw2iwsa00000r965efhf292s',
      saleId: 's',
      amountCents,
      method: 'cash',
      reference: null,
      settledAt: '2026-11-05T17:05:00.000Z',
      settledCents: 6555 - outstandingCents,
      outstandingCents,
    },
  }
}

describe('SettleRefundSlideover', () => {
  beforeEach(() => {
    settle.submit.mockReset()
    settle.reset.mockReset()
    confirmLeave.mockReset()
    cash.sessions = []
    toastAdd.mockReset()
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('summarizes the refund and prefills the outstanding amount', () => {
    const { wrapper } = mountPanel()
    const summary = wrapper.get('[data-testid="settle-summary"]').text()
    expect(summary).toContain('$65.55')
    expect(summary).toContain('$20.00')
    expect(summary).toContain('$45.55')
    expect(wrapper.text()).toContain('A-202611-000022 · María Fernanda López')
    expect(amountInput(wrapper).element.value).toBe('45.55')
    expect(primary(wrapper).text()).toBe('Liquidar $45.55')
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('31')
  })

  it('shows a large amount with thousands separators and still reads it as the same cents', async () => {
    const { wrapper } = mountPanel(refund({ amountCents: 1780590, settledCents: 0, outstandingCents: 1780590 }))
    expect(amountInput(wrapper).element.value).toBe('17,805.90')
    expect(primary(wrapper).text()).toBe('Liquidar $17,805.90')
    expect(wrapper.get('[data-testid="settle-all"]').attributes('disabled')).toBeDefined()

    await amountInput(wrapper).setValue('1234.5')
    await amountInput(wrapper).trigger('blur')
    expect(amountInput(wrapper).element.value).toBe('1,234.50')
    expect(primary(wrapper).text()).toBe('Liquidar $1,234.50')
  })

  it('«Devolver todo» puts the outstanding amount back', async () => {
    const { wrapper } = mountPanel()
    await amountInput(wrapper).setValue('10')
    expect(primary(wrapper).text()).toBe('Liquidar $10.00')
    await wrapper.get('[data-testid="settle-all"]').trigger('click')
    expect(amountInput(wrapper).element.value).toBe('45.55')
  })

  it('validates the amount before sending', async () => {
    const { wrapper } = mountPanel()
    await amountInput(wrapper).setValue('45.56')
    await wrapper.get('form').trigger('submit')
    expect(settle.submit).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('No puede ser mayor que lo pendiente ($45.55).')

    await amountInput(wrapper).setValue('0')
    expect(wrapper.text()).toContain('El monto debe ser mayor que $0.00.')
  })

  it('a partial return keeps the panel open with the new balance and says what is left', async () => {
    settle.submit.mockResolvedValueOnce(settledResponse(2555, 2000))
    const { wrapper, open } = mountPanel()
    await amountInput(wrapper).setValue('20')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(settle.submit).toHaveBeenCalledWith(
      'cmw2iwsa00000r965efhf292s',
      expect.objectContaining({ amount: '20', method: 'cash', settledAt: null }),
      { cashSessionId: null, saleId: '291e8f35-0c17-46df-8c87-6ad6cbfdcd46' },
    )
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Devolución parcial registrada. Quedan $25.55 por devolver.' }),
    )
    expect(open.value).toBe(true)
    expect(amountInput(wrapper).element.value).toBe('25.55')
    expect(wrapper.get('[data-testid="settle-summary"]').text()).toContain('$25.55')
  })

  it('a full return closes the panel without asking', async () => {
    settle.submit.mockResolvedValueOnce(settledResponse(0, 4555))
    const { wrapper, open } = mountPanel()
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Devolución completada.' }))
    expect(open.value).toBe(false)
    expect(confirmLeave).not.toHaveBeenCalled()
  })

  it('shows SETTLEMENT_EXCEEDS_REFUND in place and keeps the form', async () => {
    settle.submit.mockResolvedValueOnce({
      status: 'failed',
      error: { code: 'SETTLEMENT_EXCEEDS_REFUND', message: 'El monto es mayor que lo pendiente. Actualizamos el saldo; revisa el monto.', fieldErrors: {} },
    })
    const { wrapper } = mountPanel()
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('El monto es mayor que lo pendiente.')
    expect(wrapper.find('form').exists()).toBe(true)

    // The refetched list lowers the balance: the live validation names the new limit.
    await wrapper.setProps({ refund: refund({ settledCents: 5555, outstandingCents: 1000 }) })
    expect(wrapper.text()).toContain('No puede ser mayor que lo pendiente ($10.00).')
  })

  it('REFUND_ALREADY_SETTLED says so and leaves only «Cerrar»', async () => {
    settle.submit.mockResolvedValueOnce({
      status: 'failed',
      error: { code: 'REFUND_ALREADY_SETTLED', message: 'Este reembolso ya se completó.', fieldErrors: {} },
    })
    const { wrapper } = mountPanel()
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Este reembolso ya se completó.')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('[data-testid="settle-submit"]').exists()).toBe(false)
  })

  it('offers «Registrar como salida de mi caja» only with one open session and never for credit', async () => {
    const plain = mountPanel()
    expect(plain.wrapper.find('[data-testid="settle-cash-session"]').exists()).toBe(false)
    plain.wrapper.unmount()

    cash.sessions = [{ id: SESSION }]
    const credit = mountPanel(refund({ method: 'credit' }))
    expect(credit.wrapper.find('[data-testid="settle-cash-session"]').exists()).toBe(false)
    credit.wrapper.unmount()

    settle.submit.mockResolvedValueOnce(settledResponse(2555, 2000))
    const { wrapper } = mountPanel()
    expect(wrapper.find('[data-testid="settle-cash-session"]').exists()).toBe(true)
    await wrapper.get('[data-testid="settle-cash-session"] input, [data-testid="settle-cash-session"] button').trigger('click')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(settle.submit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ useCashSession: true }),
      expect.objectContaining({ cashSessionId: SESSION }),
    )
  })

  it('asks before closing a dirty form', async () => {
    confirmLeave.mockResolvedValue(false)
    const { wrapper, open } = mountPanel()
    await amountInput(wrapper).setValue('10')
    await wrapper.get('[data-testid="settle-close"]').trigger('click')
    await flushPromises()
    expect(confirmLeave).toHaveBeenCalled()
    expect(open.value).toBe(true)
  })

  describe('the date and time of the return', () => {
    const NOW = new Date(2026, 10, 5, 12, 0, 0)
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    const visibleNativeDates = (w: ReturnType<typeof mountPanel>['wrapper']) =>
      [...w.element.querySelectorAll('input[type="datetime-local"], input[type="date"], input[type="time"]')].filter(
        (item) => item.getAttribute('aria-hidden') !== 'true',
      )
    const dateField = (w: ReturnType<typeof mountPanel>['wrapper']) => w.findComponent({ name: 'InputDate' })

    it('uses the calendar field (never the native one), keeps minute precision and sends the same local value', async () => {
      settle.submit.mockResolvedValueOnce(settledResponse(0, 4555))
      const { wrapper } = mountPanel()
      expect(dateField(wrapper).exists()).toBe(false)
      await wrapper.get('[data-testid="settle-date-change"]').trigger('click')

      expect(visibleNativeDates(wrapper)).toHaveLength(0)
      const field = dateField(wrapper)
      expect(field.exists()).toBe(true)
      expect(field.props('granularity')).toBe('minute')
      expect(String(field.props('modelValue'))).toBe('2026-11-05T12:00:00')
      expect(wrapper.get('#settle-date-label').text()).toContain('Fecha y hora en que se devolvió el dinero')
      expect(wrapper.get('[aria-labelledby="settle-date-label"]').attributes('aria-describedby')).toBe('settle-date-label-message')

      field.vm.$emit('update:modelValue', new CalendarDateTime(2026, 11, 4, 18, 30))
      await flushPromises()
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(settle.submit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ settledAt: '2026-11-04T18:30' }),
        expect.anything(),
      )
    })

    it('picking a day in the calendar keeps the time already chosen', async () => {
      const { wrapper } = mountPanel()
      await wrapper.get('[data-testid="settle-date-change"]').trigger('click')
      dateField(wrapper).vm.$emit('update:modelValue', new CalendarDateTime(2026, 11, 4, 18, 30))
      await flushPromises()
      wrapper.findComponent({ name: 'Popover' }).vm.$emit('update:open', true)
      await flushPromises()
      const calendar = wrapper.findComponent({ name: 'Calendar' })
      expect(calendar.exists()).toBe(true)
      calendar.vm.$emit('update:modelValue', new CalendarDate(2026, 11, 2))
      await flushPromises()
      expect(String(dateField(wrapper).props('modelValue'))).toBe('2026-11-02T18:30:00')
    })

    it('refuses a moment after now and an emptied field, and «Usar ahora» goes back to «Ahora»', async () => {
      const { wrapper } = mountPanel()
      await wrapper.get('[data-testid="settle-date-change"]').trigger('click')
      dateField(wrapper).vm.$emit('update:modelValue', new CalendarDateTime(2026, 11, 7, 9, 0))
      await flushPromises()
      await wrapper.get('form').trigger('submit')
      expect(settle.submit).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('La fecha no puede ser posterior a este momento.')

      dateField(wrapper).vm.$emit('update:modelValue', undefined)
      await flushPromises()
      expect(wrapper.text()).toContain('Elige la fecha y hora de la devolución.')

      await wrapper.findAll('button').find((item) => item.text() === 'Usar ahora')!.trigger('click')
      expect(dateField(wrapper).exists()).toBe(false)
      expect(wrapper.text()).toContain('Ahora')
    })
  })
})
