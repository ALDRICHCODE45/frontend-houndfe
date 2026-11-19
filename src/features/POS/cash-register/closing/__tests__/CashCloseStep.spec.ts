/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention).
/**
 * CashCloseStep — supervisor «Cerrar caja»: checklist without checkboxes, the
 * disabled reason, the closing note required on a difference, the confirm
 * modal, success → `closed`, and every server error as one live summary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import { CASHIER, CLOSING, ME, cashError, makeReadyDetail, makeSession } from './closingFixtures'

const close = vi.fn()
const isClosing = ref(false)
vi.mock('../useCashClosing', () => ({
  useCashClose: () => ({ close, isClosing }),
}))

import CashCloseStep from '../CashCloseStep.vue'

const ConfirmModalStub = defineComponent({
  name: 'ConfirmModal',
  props: ['open', 'title', 'description', 'confirmLabel', 'loading'],
  emits: ['confirm', 'update:open', 'cancel'],
  setup(props, { emit }) {
    return () =>
      props.open
        ? h('div', { 'data-testid': 'confirm-modal' }, [
            h('p', props.description),
            h('button', { 'data-testid': 'confirm-modal-confirm', onClick: () => emit('confirm') }, props.confirmLabel),
          ])
        : null
  },
})

function mountStep(props = {}) {
  return mountWithUApp(CashCloseStep, {
    props: { detail: makeReadyDetail(), currentUserId: ME, canClose: true, ...props },
    global: { stubs: { ConfirmModal: ConfirmModalStub } },
  })
}

function differenceDetail() {
  const base = makeReadyDetail()
  const declaration = base.counts[0]
  const lines = [{ channelKey: 'CASH', amountCents: 148000 }, declaration.lines[1]]
  return {
    ...base,
    handovers: [base.handovers[0], { ...base.handovers[1], declaredCents: 98000 }],
    counts: [{ ...declaration, lines, notes: 'Faltó cambio' }, { ...base.counts[1], lines }],
  }
}

beforeEach(() => {
  close.mockReset()
  isClosing.value = false
})

describe('CashCloseStep', () => {
  it('renders every requirement as a status row (no checkboxes)', () => {
    const wrapper = mountStep()
    const rows = wrapper.findAll('[data-testid^="cash-close-requirement-"]')
    expect(rows).toHaveLength(7)
    expect(rows.every((row) => row.attributes('data-state') === 'met')).toBe(true)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('the cashier sees who closes it, never the action', () => {
    const wrapper = mountStep({ currentUserId: CASHIER })
    expect(wrapper.get('[data-testid="cash-close-cashier"]').text()).toMatch(/La cierra un supervisor/)
    expect(wrapper.find('[data-testid="cash-close-submit"]').exists()).toBe(false)
  })

  it('without create:CashClosing explains the missing permission', () => {
    const wrapper = mountStep({ canClose: false })
    expect(wrapper.get('[data-testid="cash-close-forbidden"]').text()).toMatch(/«Cerrar caja»/)
    expect(wrapper.find('[data-testid="cash-close-submit"]').exists()).toBe(false)
  })

  it('disables «Cerrar caja» with the first pending reason, linked by aria-describedby', () => {
    const wrapper = mountStep({
      detail: makeReadyDetail({ session: makeSession({ drawerReleasedAt: null }) }),
    })
    const button = wrapper.get('[data-testid="cash-close-submit"]')
    expect(button.attributes('disabled')).toBeDefined()
    const reason = wrapper.get('[data-testid="cash-close-reason"]')
    expect(reason.text()).toMatch(/Falta liberar el cajón: Ana Cajera debe liberarlo antes del cierre/)
    expect(button.attributes('aria-describedby')).toContain(reason.attributes('id'))
    expect(wrapper.get('[data-testid="cash-close-requirement-drawerReleased"]').attributes('data-state')).toBe(
      'pending',
    )
  })

  it('keeps the closing note optional even with a difference (contract §5)', async () => {
    const wrapper = mountStep({ detail: differenceDetail() })
    const label = wrapper.get('[data-testid="cash-close-notes-label"]').text()
    expect(label).toMatch(/opcional/)
    expect(label).not.toMatch(/obligatoria/)
    expect(wrapper.get('textarea').attributes('aria-required')).toBeUndefined()
    expect(wrapper.get('[data-testid="cash-close-submit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="cash-close-reason"]').text()).not.toMatch(/Escribe la nota de cierre/)

    close.mockResolvedValue(CLOSING)
    await wrapper.get('[data-testid="cash-close-submit"]').trigger('click')
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(close).toHaveBeenCalledWith(expect.any(String), undefined)
  })

  it('the note stays optional without a difference', () => {
    const wrapper = mountStep()
    expect(wrapper.get('[data-testid="cash-close-notes-label"]').text()).toMatch(/opcional/)
    expect(wrapper.get('[data-testid="cash-close-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('confirms, closes with the note and emits the closing', async () => {
    close.mockResolvedValue(CLOSING)
    const wrapper = mountStep()
    await wrapper.get('[data-testid="cash-close-notes"]').setValue('  Cierre sin novedad ')
    await wrapper.get('[data-testid="cash-close-submit"]').trigger('click')
    expect(close).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="confirm-modal"]').text()).toMatch(/No se puede deshacer/)

    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()

    expect(close).toHaveBeenCalledWith(makeReadyDetail().session.id, 'Cierre sin novedad')
    expect(wrapper.emitted('closed')?.[0]).toEqual([CLOSING])
  })

  it('shows a 422 as one summary near the action, in a live region', async () => {
    close.mockRejectedValue(cashError('CASH_CUSTODY_NOT_RECEIVED', { handoverId: 'h-1' }))
    const wrapper = mountStep()
    await wrapper.get('[data-testid="cash-close-submit"]').trigger('click')
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()

    const summary = wrapper.get('[data-testid="cash-close-error"]')
    expect(summary.attributes('role')).toBe('alert')
    expect(summary.text()).toMatch(/Falta recibir una entrega/)
    expect(wrapper.findAll('[data-testid="cash-close-error"]')).toHaveLength(1)
    expect(wrapper.emitted('closed')).toBeUndefined()
  })

  it('once closed, shows the folio and opens the corte', async () => {
    const wrapper = mountStep({
      detail: makeReadyDetail({
        session: makeSession({ status: 'CLOSED' }),
        closing: { id: CLOSING.id, sessionId: CLOSING.sessionId, folio: CLOSING.folio, createdAt: CLOSING.createdAt },
      }),
    })
    expect(wrapper.get('[data-testid="cash-close-closed"]').text()).toContain(CLOSING.folio)
    await wrapper.get('[data-testid="cash-close-view-closing"]').trigger('click')
    expect(wrapper.emitted('view-closing')?.[0]).toEqual([CLOSING.id])
  })
})
