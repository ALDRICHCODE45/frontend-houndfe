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
import { nextTick, reactive } from 'vue'
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

  it('names each channel by its label and never shows the channel key', () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    const labels = wrapper.findAll('label').map((label) => label.text())
    expect(labels).toContain('Visa Crédito')
    expect(wrapper.text()).not.toContain('PM:card')
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

describe('CashCountForm · no error before the person types (T4)', () => {
  it('shows no channel error at rest, and the missing ones once counting has started', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    expect(wrapper.find('[data-testid^="cash-count-error-"]').exists()).toBe(false)
    expect(wrapper.find('.text-error').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cash-count-error-summary"]').exists()).toBe(false)

    await setChannel(wrapper, 'CASH', '10.00')
    expect(wrapper.find('[data-testid="cash-count-error-PM:card"]').exists()).toBe(true)
  })
})

// T3b (direction A): one error summary (role=alert, focused, linking to each
// field) and the SAME message next to the field; no second small red line.
describe('CashCountForm · error summary and inline errors', () => {
  it('on a failed attempt shows one focused summary that links to every field in error', async () => {
    const wrapper = mountWithUApp(CashCountForm, {
      props: { channels: CHANNELS },
      attachTo: document.body,
    })
    await submit(wrapper)
    await new Promise((resolve) => setTimeout(resolve, 0))

    const summary = wrapper.get('[data-testid="cash-count-error-summary"]')
    expect(summary.attributes('role')).toBe('alert')
    expect(document.activeElement).toBe(summary.element)
    const links = summary.findAll('a')
    expect(links).toHaveLength(2)
    for (const [index, key] of ['CASH', 'PM:card'].entries()) {
      const input = wrapper.get(`[data-testid="cash-count-input-${key}"]`)
      expect(links[index].attributes('href')).toBe(`#${input.attributes('id')}`)
      expect(input.attributes('aria-invalid')).toBe('true')
      const inline = wrapper.get(`[data-testid="cash-count-error-${key}"]`)
      expect(inline.text()).toBe(links[index].text())
      expect(input.attributes('aria-describedby')).toContain(inline.attributes('id'))
    }
    expect(wrapper.find('[data-testid="cash-count-local-error"]').exists()).toBe(false)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('puts the denomination mismatch in the summary and next to the counter, once each', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    await setChannel(wrapper, 'CASH', '50.00')
    await setChannel(wrapper, 'PM:card', '0')
    await addDenomination(wrapper)
    await setDenomination(wrapper, 0, { amount: '50.00', quantity: '2' })
    await submit(wrapper)

    const inline = wrapper.get('[data-testid="cash-count-denomination-error"]')
    const summary = wrapper.get('[data-testid="cash-count-error-summary"]')
    expect(summary.text()).toContain(inline.text())
    expect(wrapper.text().split(inline.text())).toHaveLength(3)
  })

  it('shows the server error inside the summary, not as a loose line', () => {
    const wrapper = mountWithUApp(CashCountForm, {
      props: { channels: CHANNELS, errorMessage: 'La sesión ya no está congelada.' },
    })
    const summary = wrapper.get('[data-testid="cash-count-error-summary"]')
    expect(summary.get('[data-testid="cash-count-error"]').text()).toBe(
      'La sesión ya no está congelada.',
    )
  })

  it('counts by denomination: piece inputs per bill and coin, subtotal and a total that must match Efectivo', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    await setChannel(wrapper, 'CASH', '1200.00')
    await setChannel(wrapper, 'PM:card', '0')
    await wrapper.get('[data-testid="cash-count-denom-100000"]').setValue('1')
    await wrapper.get('[data-testid="cash-count-denom-10000"]').setValue('2')

    expect(wrapper.get('[data-testid="cash-count-denom-subtotal-10000"]').text()).toMatch(/200[.,]00/)
    expect(wrapper.get('[data-testid="cash-count-denomination-sum"]').text()).toMatch(/1,200[.,]00/)
    expect(wrapper.get('[data-testid="cash-count-denomination-match"]').text()).toMatch(
      /Coincide con Efectivo/,
    )
    await submit(wrapper)
    expect(submitted(wrapper)[0].denominations).toEqual([
      { denominationCents: 100000, quantity: 1 },
      { denominationCents: 10000, quantity: 2 },
    ])
  })

  it('merges the $20 bill and the $20 coin into one denomination on the wire', async () => {
    const wrapper = mountWithUApp(CashCountForm, { props: { channels: CHANNELS } })
    await setChannel(wrapper, 'CASH', '60.00')
    await setChannel(wrapper, 'PM:card', '0')
    await wrapper.get('[data-testid="cash-count-denom-2000-billete"]').setValue('2')
    await wrapper.get('[data-testid="cash-count-denom-2000-moneda"]').setValue('1')
    await submit(wrapper)
    expect(submitted(wrapper)[0].denominations).toEqual([{ denominationCents: 2000, quantity: 3 }])
  })

  it('announces a sent count through a polite status once the submit settles without error', async () => {
    const props = reactive({ channels: CHANNELS, submitting: true, successLabel: 'Declaración enviada.' })
    const wrapper = mountWithUApp(CashCountForm, { props })
    props.submitting = false
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 5))
    const status = wrapper.get('[data-testid="cash-count-status"]')
    expect(status.attributes('role')).toBe('status')
    expect(status.text()).toBe('Declaración enviada.')
  })
})
