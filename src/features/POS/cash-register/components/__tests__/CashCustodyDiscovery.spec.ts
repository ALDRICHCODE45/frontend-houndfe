/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
// CashCustodyDiscovery: access-not-empty, recipient-only receipt, FLOAT vs
// WITHDRAWAL, received != declared validity, and the no-reservation copy.
import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashCustodyDiscovery from '../CashCustodyDiscovery.vue'

const PENDING = [
  {
    id: 'h-1',
    sessionId: 's-1',
    kind: 'FLOAT',
    declaredCents: 30000,
    receivedCents: null,
    senderUserId: 'sender-1',
    receiverUserId: 'me',
    declaredAt: '2026-10-07T20:05:00.000Z',
    receivedAt: null,
    sourceRegisterId: 'r-1',
    sourceDrawerReleasedAt: null,
  },
  {
    id: 'h-2',
    sessionId: 's-2',
    kind: 'WITHDRAWAL',
    declaredCents: 12000,
    receivedCents: null,
    senderUserId: 'sender-1',
    receiverUserId: 'someone-else',
    declaredAt: '2026-10-07T20:00:00.000Z',
    receivedAt: null,
  },
]

const ELIGIBLE = [
  {
    id: 'f-1',
    sessionId: 's-3',
    kind: 'FLOAT',
    declaredCents: 30000,
    receivedCents: 29500,
    senderUserId: 'sender-1',
    receiverUserId: 'me',
    declaredAt: '2026-10-07T19:00:00.000Z',
    receivedAt: '2026-10-07T19:10:00.000Z',
    sourceRegisterId: 'r-other',
    sourceDrawerReleasedAt: '2026-10-07T19:30:00.000Z',
  },
]

function mountDiscovery(props = {}) {
  return mountWithUApp(CashCustodyDiscovery, {
    props: {
      allowed: true,
      currentUserId: 'me',
      canReceive: true,
      ...props,
    },
  })
}

describe('CashCustodyDiscovery · access state', () => {
  it('shows the missing-grant copy instead of an empty page without read:CashHandover', () => {
    const wrapper = mountWithUApp(CashCustodyDiscovery, { props: { allowed: false } })
    expect(wrapper.find('[data-testid="cash-custody-forbidden"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-custody-empty"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-custody-refresh"]').exists()).toBe(false)
  })

  it('renders loading, error and empty states', () => {
    const loading = mountDiscovery({ loading: true })
    expect(loading.find('[data-testid="cash-custody-loading"]').exists()).toBe(true)

    const error = mountDiscovery({ error: true, errorMessage: 'Falla de red' })
    expect(error.get('[data-testid="cash-custody-error"]').text()).toContain('Falla de red')

    const empty = mountDiscovery()
    expect(empty.find('[data-testid="cash-custody-empty"]').exists()).toBe(true)
  })
})

describe('CashCustodyDiscovery · receipt is recipient-only', () => {
  it('offers the receipt action ONLY for the designated recipient', () => {
    const wrapper = mountDiscovery({ pendingHandovers: PENDING })

    // h-1 is addressed to the current user → actionable.
    expect(wrapper.find('[data-testid="cash-custody-receive-h-1"]').exists()).toBe(true)
    // h-2 is addressed to someone else → explanation, never an action.
    expect(wrapper.find('[data-testid="cash-custody-receive-h-2"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-custody-not-mine-h-2"]').exists()).toBe(true)
  })

  it('hides the receipt action without update:CashHandover', () => {
    const wrapper = mountDiscovery({ pendingHandovers: PENDING, canReceive: false })
    expect(wrapper.find('[data-testid="cash-custody-receive-h-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-custody-receive-forbidden-h-1"]').exists()).toBe(true)
  })

  it('emits the explicit received amount the recipient declares', async () => {
    const wrapper = mountDiscovery({ pendingHandovers: PENDING })

    await wrapper.get('[data-testid="cash-custody-received-input-h-1"]').setValue('295.00')
    await wrapper
      .get('[data-testid="cash-custody-received-notes-h-1"]')
      .setValue('Recibido completo')
    await wrapper.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')

    expect(wrapper.emitted('receive')).toEqual([
      [{ id: 'h-1', receivedCents: 29500, notes: 'Recibido completo' }],
    ])
  })

  it('rejects a fraction beyond two decimals instead of coercing it', async () => {
    const wrapper = mountDiscovery({ pendingHandovers: PENDING })
    await wrapper.get('[data-testid="cash-custody-received-input-h-1"]').setValue('295.555')
    await wrapper.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')

    expect(wrapper.emitted('receive')).toBeUndefined()
    expect(wrapper.find('[data-testid="cash-custody-local-error"]').exists()).toBe(true)
  })

  it('separates the declared amount from what the recipient actually receives', () => {
    const wrapper = mountDiscovery({ pendingHandovers: PENDING })
    const card = wrapper.get('[data-testid="cash-custody-pending-h-1"]')
    expect(card.get('[data-testid="cash-custody-declared-h-1"]').text()).toMatch(/300[.,]00/)
    expect(card.text()).toMatch(/declarado/i)
    expect(card.get('[data-testid="cash-custody-received-input-h-1"]').exists()).toBe(true)
    // The declared amount is never presented as the amount already received.
    expect(card.get('[data-testid="cash-custody-declared-h-1"]').text()).not.toMatch(/recibido/i)
  })

  it('distinguishes FLOAT from WITHDRAWAL', () => {
    const wrapper = mountDiscovery({ pendingHandovers: PENDING })
    expect(wrapper.get('[data-testid="cash-custody-kind-h-1"]').text()).toMatch(/FLOAT/i)
    expect(wrapper.get('[data-testid="cash-custody-kind-h-2"]').text()).toMatch(/WITHDRAWAL/i)
  })
})

describe('CashCustodyDiscovery · eligible FLOAT is a hint', () => {
  it('shows the RECEIVED amount and accepts it differing from the declared one', () => {
    const wrapper = mountDiscovery({ eligibleFloat: ELIGIBLE })
    const received = wrapper.get('[data-testid="cash-custody-float-received-f-1"]').text()
    expect(received).toMatch(/295[.,]00/)
    expect(wrapper.get('[data-testid="cash-custody-float-f-1"]').text()).toMatch(/300[.,]00/)
  })

  it('displays an unreleased source drawer rather than filtering the FLOAT', () => {
    const wrapper = mountDiscovery({
      registerId: 'r-1',
      eligibleFloat: [{ ...ELIGIBLE[0], sourceRegisterId: 'r-1', sourceDrawerReleasedAt: null }],
    })
    const advisory = wrapper.get('[data-testid="cash-custody-float-drawer-f-1"]')
    expect(advisory.text()).toMatch(/misma caja/i)
  })

  it('never marks anything as reserved and states the hint explicitly', () => {
    const wrapper = mountDiscovery({ eligibleFloat: ELIGIBLE })
    const text = wrapper.text().toLowerCase()
    expect(text).toContain('no una reserva')
    expect(text).not.toContain('reservado')
  })
})

describe('CashCustodyDiscovery · received money is entered in pesos', () => {
  it('converts received pesos to exact integer cents in the emitted body', async () => {
    const wrapper = mountDiscovery({ pendingHandovers: PENDING })
    await wrapper
      .get('[data-testid="cash-custody-received-notes-h-1"]')
      .setValue('Diferencia aceptada')

    await wrapper.get('[data-testid="cash-custody-received-input-h-1"]').setValue('350.25')
    await wrapper.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')
    expect(wrapper.emitted('receive')?.[0]?.[0]?.receivedCents).toBe(35025)

    await wrapper.get('[data-testid="cash-custody-received-input-h-1"]').setValue('0.01')
    await wrapper.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')
    expect(wrapper.emitted('receive')?.[1]?.[0]?.receivedCents).toBe(1)
  })

  it('requires a note when the received amount differs from the declared one', async () => {
    const wrapper = mountDiscovery({ pendingHandovers: PENDING })
    await wrapper.get('[data-testid="cash-custody-received-input-h-1"]').setValue('300.01')
    await wrapper.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')
    expect(wrapper.emitted('receive')).toBeUndefined()
    expect(wrapper.find('[data-testid="cash-custody-local-error"]').exists()).toBe(true)

    await wrapper
      .get('[data-testid="cash-custody-received-notes-h-1"]')
      .setValue('Faltante de un centavo')
    await wrapper.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')
    expect(wrapper.emitted('receive')).toEqual([
      [{ id: 'h-1', receivedCents: 30001, notes: 'Faltante de un centavo' }],
    ])
  })

  it('needs no difference note when the received amount equals the declared one', async () => {
    const wrapper = mountDiscovery({ pendingHandovers: PENDING })
    await wrapper.get('[data-testid="cash-custody-received-input-h-1"]').setValue('300.00')
    await wrapper.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')
    expect(wrapper.emitted('receive')).toEqual([[{ id: 'h-1', receivedCents: 30000 }]])
  })

  it('accepts an explicit zero received amount and treats a blank as missing, never zero', async () => {
    const zero = mountDiscovery({ pendingHandovers: PENDING })
    await zero.get('[data-testid="cash-custody-received-input-h-1"]').setValue('0')
    await zero
      .get('[data-testid="cash-custody-received-notes-h-1"]')
      .setValue('Sin efectivo recibido')
    await zero.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')
    expect(zero.emitted('receive')).toEqual([
      [{ id: 'h-1', receivedCents: 0, notes: 'Sin efectivo recibido' }],
    ])

    const blank = mountDiscovery({ pendingHandovers: PENDING })
    await blank.get('[data-testid="cash-custody-received-input-h-1"]').setValue('')
    await blank.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')
    expect(blank.emitted('receive')).toBeUndefined()
    expect(blank.find('[data-testid="cash-custody-local-error"]').exists()).toBe(true)
  })

  it('rejects over-precision, exponent, negative and overflow received amounts without emitting', async () => {
    for (const value of ['295.555', '1e2', '-1', '21474836.48']) {
      const wrapper = mountDiscovery({ pendingHandovers: PENDING })
      await wrapper.get('[data-testid="cash-custody-received-input-h-1"]').setValue(value)
      await wrapper.get('[data-testid="cash-custody-receive-h-1"]').trigger('click')
      expect(wrapper.emitted('receive')).toBeUndefined()
      expect(wrapper.find('[data-testid="cash-custody-local-error"]').exists()).toBe(true)
    }
  })

  it('does not ask for centavos in the receipt entry', () => {
    const wrapper = mountDiscovery({ pendingHandovers: PENDING })
    expect(wrapper.text()).not.toMatch(/centavos/i)
    expect(
      wrapper.get('[data-testid="cash-custody-received-input-h-1"]').attributes('inputmode'),
    ).toBe('decimal')
  })
})
