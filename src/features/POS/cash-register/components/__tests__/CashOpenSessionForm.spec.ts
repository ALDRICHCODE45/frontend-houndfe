/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
// CashOpenSessionForm: explicit opening confirmation, the RECEIVED FLOAT amount
// as the opening fund, the same-register drawer block, and the custody gate.
import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashOpenSessionForm from '../CashOpenSessionForm.vue'

function makeFloat(overrides = {}) {
  return {
    id: 'f-1',
    sessionId: 's-0',
    kind: 'FLOAT',
    declaredCents: 60000,
    receivedCents: 50000,
    senderUserId: 'sender-1',
    receiverUserId: 'recipient-1',
    declaredAt: '2026-10-07T19:00:00.000Z',
    receivedAt: '2026-10-07T19:10:00.000Z',
    sourceRegisterId: 'r-other',
    sourceDrawerReleasedAt: '2026-10-07T19:30:00.000Z',
    ...overrides,
  }
}

async function mountOpen(props = {}) {
  return mountWithUApp(CashOpenSessionForm, {
    props: { registerId: 'r-1', registerName: 'Caja principal', canOpen: true, ...props },
  })
}

describe('CashOpenSessionForm', () => {
  it('asks for a register before offering the form', () => {
    const wrapper = mountWithUApp(CashOpenSessionForm, { props: { canOpen: true } })
    expect(wrapper.find('[data-testid="cash-open-no-register"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-open-submit"]').exists()).toBe(false)
  })

  it('requires the explicit opening confirmation before emitting', async () => {
    const wrapper = await mountOpen()
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.get('[data-testid="cash-open-local-error"]').text()).toMatch(/confirma/i)
  })

  it('rejects an opening amount with more than two decimals', async () => {
    const wrapper = await mountOpen()
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.555')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.find('[data-testid="cash-open-local-error"]').exists()).toBe(true)
  })

  it('emits the opening fund once confirmed', async () => {
    const wrapper = await mountOpen()
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('500.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')

    expect(wrapper.emitted('submit')).toEqual([[{ openingCents: 50000 }]])
  })

  it('shows the custody gate when the FLOAT list is not readable', () => {
    const wrapper = mountWithUApp(CashOpenSessionForm, {
      props: { registerId: 'r-1', canOpen: true, custodyVisible: false },
    })
    expect(wrapper.find('[data-testid="cash-open-float-unavailable"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-open-float-select"]').exists()).toBe(false)
  })

  it('uses the RECEIVED amount of the chosen FLOAT as the opening fund', async () => {
    const wrapper = await mountOpen({
      custodyVisible: true,
      eligibleFloat: [makeFloat()],
      floatId: 'f-1',
    })

    // Received (50000) is the fund, NOT the declared 60000, and it is valid even
    // though the two differ.
    expect(wrapper.get('[data-testid="cash-open-float-received"]').text()).toMatch(/500[.,]00/)
    expect(wrapper.get('[data-testid="cash-opening-cents"]').element.value).toBe('500.00')

    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    expect(wrapper.emitted('submit')).toEqual([[{ openingCents: 50000, openingHandoverId: 'f-1' }]])
  })

  it('blocks the opening when the amount no longer matches the received FLOAT', async () => {
    const wrapper = await mountOpen({
      custodyVisible: true,
      eligibleFloat: [makeFloat()],
      floatId: 'f-1',
    })

    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('600.00')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')

    expect(wrapper.find('[data-testid="cash-open-float-mismatch"]').exists()).toBe(true)
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('blocks a same-register opening while the source drawer is unreleased', async () => {
    const wrapper = await mountOpen({
      custodyVisible: true,
      eligibleFloat: [makeFloat({ sourceRegisterId: 'r-1', sourceDrawerReleasedAt: null })],
      floatId: 'f-1',
    })

    expect(wrapper.find('[data-testid="cash-open-drawer-advisory"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="cash-open-drawer-advisory"]').text()).toMatch(/misma caja/i)

    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('allows the same FLOAT on ANOTHER register (the block is register-local)', async () => {
    const wrapper = await mountOpen({
      registerId: 'r-2',
      custodyVisible: true,
      eligibleFloat: [makeFloat({ sourceRegisterId: 'r-1', sourceDrawerReleasedAt: null })],
      floatId: 'f-1',
    })

    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('states that the listed FLOAT is a hint, not a reservation', async () => {
    const wrapper = await mountOpen({
      custodyVisible: true,
      eligibleFloat: [makeFloat()],
      floatId: 'f-1',
    })
    expect(wrapper.get('[data-testid="cash-open-float-hint"]').text()).toMatch(/no una reserva/i)
  })
})

// S1: the human enters money in PESOS; the wire keeps integer cents.
describe('CashOpenSessionForm · PESOS money entry', () => {
  it('converts human pesos to exact integer cents (350.25 → 35025, 0.01 → 1)', async () => {
    const wrapper = await mountOpen()
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('350.25')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    expect(wrapper.emitted('submit')).toEqual([[{ openingCents: 35025 }]])

    const cent = await mountOpen()
    await cent.get('[data-testid="cash-opening-cents"]').setValue('0.01')
    await cent.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await cent.get('[data-testid="cash-open-submit"]').trigger('click')
    expect(cent.emitted('submit')).toEqual([[{ openingCents: 1 }]])
  })

  it('wires the exact upper bound once (21474836.47 → 2147483647)', async () => {
    const wrapper = await mountOpen()
    await wrapper.get('[data-testid="cash-opening-cents"]').setValue('21474836.47')
    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    expect(wrapper.emitted('submit')).toEqual([[{ openingCents: 2147483647 }]])
  })

  it('accepts an explicit zero opening and rejects a blank opening', async () => {
    const explicitZero = await mountOpen()
    await explicitZero.get('[data-testid="cash-opening-cents"]').setValue('0')
    await explicitZero.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await explicitZero.get('[data-testid="cash-open-submit"]').trigger('click')
    expect(explicitZero.emitted('submit')).toEqual([[{ openingCents: 0 }]])

    const blank = await mountOpen()
    await blank.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await blank.get('[data-testid="cash-open-submit"]').trigger('click')
    expect(blank.emitted('submit')).toBeUndefined()
    expect(blank.find('[data-testid="cash-open-local-error"]').exists()).toBe(true)
  })

  it('rejects over-precision, signs, exponents and overflow without emitting', async () => {
    for (const value of ['1.234', '-5', '1e3', '21474836.48', '5,00,00']) {
      const wrapper = await mountOpen()
      await wrapper.get('[data-testid="cash-opening-cents"]').setValue(value)
      await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
      await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
      expect(wrapper.emitted('submit')).toBeUndefined()
      expect(wrapper.find('[data-testid="cash-open-local-error"]').exists()).toBe(true)
    }
  })

  it('displays the FLOAT received amount in pesos and wires the same cents once (35000 → 350.00)', async () => {
    const wrapper = await mountOpen({
      custodyVisible: true,
      eligibleFloat: [makeFloat({ declaredCents: 40000, receivedCents: 35000 })],
      floatId: 'f-1',
    })

    expect(wrapper.get('[data-testid="cash-opening-cents"]').element.value).toBe('350.00')

    await wrapper.get('[data-testid="cash-opening-confirmed"]').trigger('click')
    await wrapper.get('[data-testid="cash-open-submit"]').trigger('click')
    expect(wrapper.emitted('submit')).toEqual([[{ openingCents: 35000, openingHandoverId: 'f-1' }]])
  })

  it('does not ask for cents in the opening money entry', async () => {
    const wrapper = await mountOpen({
      custodyVisible: true,
      eligibleFloat: [makeFloat()],
      floatId: 'f-1',
    })
    expect(wrapper.text()).not.toMatch(/centavos/i)
    expect(wrapper.get('[data-testid="cash-opening-cents"]').attributes('inputmode')).toBe(
      'decimal',
    )
  })
})
