/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
// CashCountForm: frozen channels only, HUMAN MONEY IN PESOS converted exactly
// once to integer wire cents, blank != zero, an explicit zero is a counted zero,
// optional denominations entered in pesos with INTEGER piece quantities that
// must sum to the CASH line, and no expected/difference input. Errors and labels
// speak in pesos for money and in pieces for quantities — never centavos.
import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashCountForm from '../CashCountForm.vue'

const CHANNELS = [
  { channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH' },
  { channelKey: 'PM:card', channelLabel: 'Visa Crédito', method: 'CARD_CREDIT' },
]

async function setChannel(wrapper, key, value) {
  await wrapper.get(`[data-testid="cash-count-input-${key}"]`).setValue(value)
}

async function addDenomination(wrapper) {
  await wrapper.get('[data-testid="cash-count-add-denomination"]').trigger('click')
}

async function setDenomination(wrapper, index, { amount, quantity }) {
  if (amount !== undefined) {
    await wrapper.get(`[data-testid="cash-count-denomination-amount-${index}"]`).setValue(amount)
  }
  if (quantity !== undefined) {
    await wrapper
      .get(`[data-testid="cash-count-denomination-quantity-${index}"]`)
      .setValue(quantity)
  }
}

async function submit(wrapper) {
  await wrapper.get('[data-testid="cash-count-form-element"]').trigger('submit')
}

function submitted(wrapper) {
  const events = wrapper.emitted('submit')
  return events ? events.map((event) => event[0]) : []
}

describe('CashCountForm', () => {
  it('renders one field per frozen channel and no expected/difference input', () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    expect(wrapper.find('[data-testid="cash-count-input-CASH"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-count-input-PM:card"]').exists()).toBe(true)
    expect(wrapper.findAll('input[data-testid*="expected"]')).toHaveLength(0)
    expect(wrapper.findAll('input[data-testid*="difference"]')).toHaveLength(0)
  })

  it('prompts to freeze when no channel identity is available', () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: [] } })
    expect(wrapper.find('[data-testid="cash-count-no-channels"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cash-count-submit"]').exists()).toBe(false)
  })

  it('converts human pesos to integer wire cents once per channel', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    await setChannel(wrapper, 'CASH', '350.25')
    await setChannel(wrapper, 'PM:card', '350.25')
    await submit(wrapper)

    expect(submitted(wrapper)[0].lines).toEqual([
      { channelKey: 'CASH', amountCents: 35025 },
      { channelKey: 'PM:card', amountCents: 35025 },
    ])
  })

  it('never treats a blank channel as a counted zero, but accepts an explicit zero', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    await setChannel(wrapper, 'CASH', '0')

    expect(wrapper.find('[data-testid="cash-count-error-CASH"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-count-error-PM:card"]').exists()).toBe(true)

    await submit(wrapper)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('keeps an explicit zero in the wire payload as an included zero line', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    await setChannel(wrapper, 'CASH', '0')
    await setChannel(wrapper, 'PM:card', '120.50')
    await submit(wrapper)

    expect(submitted(wrapper)[0].lines).toEqual([
      { channelKey: 'CASH', amountCents: 0 },
      { channelKey: 'PM:card', amountCents: 12050 },
    ])
  })

  it('emits only lines/denominations/notes once every frozen channel is declared', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    await setChannel(wrapper, 'CASH', '1580.00')
    await setChannel(wrapper, 'PM:card', '400.00')
    await wrapper.get('[data-testid="cash-count-notes"]').setValue('sin novedad')
    await submit(wrapper)

    const payloads = submitted(wrapper)
    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toEqual({
      lines: [
        { channelKey: 'CASH', amountCents: 158000 },
        { channelKey: 'PM:card', amountCents: 40000 },
      ],
      notes: 'sin novedad',
    })
  })

  it('rejects excess money decimals, exponents, negatives and overflow without silent rounding', async () => {
    for (const invalid of ['1.234', '1e2', '-1', '21474836.48']) {
      const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
      await setChannel(wrapper, 'CASH', invalid)
      await setChannel(wrapper, 'PM:card', '0')

      expect(wrapper.find('[data-testid="cash-count-error-CASH"]').exists()).toBe(true)
      await submit(wrapper)
      expect(wrapper.emitted('submit')).toBeUndefined()
    }
  })

  it('keeps channel money labels and error copy in pesos, never centavos', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    await setChannel(wrapper, 'CASH', '1.234')
    await setChannel(wrapper, 'PM:card', '0')

    const errorCopy = wrapper.get('[data-testid="cash-count-error-CASH"]').text()
    expect(errorCopy).toMatch(/pesos/i)
    expect(errorCopy).not.toMatch(/centavos/i)
    expect(wrapper.text()).not.toMatch(/centavos/i)
  })

  it('keeps denominations optional', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    await setChannel(wrapper, 'CASH', '50.00')
    await setChannel(wrapper, 'PM:card', '0')
    await submit(wrapper)
    expect(submitted(wrapper)[0].denominations).toBeUndefined()
  })

  it('requires supplied denominations to sum exactly to the CASH line', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    await setChannel(wrapper, 'CASH', '50.00')
    await setChannel(wrapper, 'PM:card', '0')

    await addDenomination(wrapper)
    await setDenomination(wrapper, 0, { amount: '50.00', quantity: '1' })
    await submit(wrapper)

    expect(submitted(wrapper)[0].denominations).toEqual([{ denominationCents: 5000, quantity: 1 }])

    await setDenomination(wrapper, 0, { quantity: '2' })
    await submit(wrapper)
    expect(wrapper.find('[data-testid="cash-count-denomination-error"]').exists()).toBe(true)
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('converts denomination money from pesos and keeps the quantity an integer count', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    await setChannel(wrapper, 'CASH', '201.00')
    await setChannel(wrapper, 'PM:card', '0')

    await addDenomination(wrapper)
    await setDenomination(wrapper, 0, { amount: '100.50', quantity: '2' })

    expect(wrapper.get('[data-testid="cash-count-denomination-sum"]').text()).toMatch(/201[.,]00/)
    await submit(wrapper)

    // 100.50 pesos is 10050 wire cents; quantity 2 is two pieces, never 200.
    expect(submitted(wrapper)[0].denominations).toEqual([{ denominationCents: 10050, quantity: 2 }])
  })

  it('accepts a ZERO denomination quantity (contributes zero) and a positive denomination', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    await setChannel(wrapper, 'CASH', '0')
    await setChannel(wrapper, 'PM:card', '0')

    await addDenomination(wrapper)
    await setDenomination(wrapper, 0, { amount: '10.00', quantity: '0' })
    await submit(wrapper)

    expect(submitted(wrapper)[0].denominations).toEqual([{ denominationCents: 1000, quantity: 0 }])
  })

  it('rejects a zero or sub-cent denomination money value (min is one cent)', async () => {
    for (const invalid of ['0', '0.00']) {
      const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
      await setChannel(wrapper, 'CASH', '0')
      await setChannel(wrapper, 'PM:card', '0')

      await addDenomination(wrapper)
      await setDenomination(wrapper, 0, { amount: invalid, quantity: '1' })
      await submit(wrapper)

      expect(wrapper.find('[data-testid="cash-count-denomination-error"]').exists()).toBe(true)
      expect(wrapper.emitted('submit')).toBeUndefined()
    }
  })

  it('rejects denomination money with excess decimals, exponents, negatives or overflow', async () => {
    for (const invalid of ['1.234', '1e2', '-0.01', '21474836.48']) {
      const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
      await setChannel(wrapper, 'CASH', '0')
      await setChannel(wrapper, 'PM:card', '0')

      await addDenomination(wrapper)
      await setDenomination(wrapper, 0, { amount: invalid, quantity: '1' })
      await submit(wrapper)

      expect(wrapper.find('[data-testid="cash-count-denomination-error"]').exists()).toBe(true)
      expect(wrapper.emitted('submit')).toBeUndefined()
    }
  })

  it('rejects denomination quantities with fractions, negatives or overflow', async () => {
    for (const invalid of ['1.5', '-1', '2147483648']) {
      const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
      await setChannel(wrapper, 'CASH', '0')
      await setChannel(wrapper, 'PM:card', '0')

      await addDenomination(wrapper)
      await setDenomination(wrapper, 0, { amount: '10.00', quantity: invalid })
      await submit(wrapper)

      const error = wrapper.get('[data-testid="cash-count-denomination-error"]').text()
      expect(error).toMatch(/cantidad|piezas/i)
      expect(error).not.toMatch(/centavos/i)
      expect(wrapper.emitted('submit')).toBeUndefined()
    }
  })
})
