/**
 * payment-split T1 (S2-S4, S7): the shared split controls only emit cents; their owner writes them.
 * Plus the design guard: token radii, no card of their own.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TenderSplitControl from '../TenderSplitControl.vue'
import TenderRemainingButton from '../TenderRemainingButton.vue'

const tenders = [
  { key: 'cash', label: 'Efectivo', method: 'cash', amountCents: 0 },
  { key: 'card_credit', label: 'Tarjeta de crédito', method: 'card_credit', amountCents: 0 },
  { key: 'transfer', label: 'Transferencia', method: 'transfer', amountCents: null },
]

describe('TenderSplitControl', () => {
  it('renders nothing with fewer than 2 tenders', () => {
    const wrapper = mount(TenderSplitControl, {
      props: { tenders: tenders.slice(0, 1), targetCents: 607629 },
    })
    expect(wrapper.find('[data-testid="tender-split-equal"]').exists()).toBe(false)
  })

  it('emits the equal split with the leftover cent on the last tender', async () => {
    const wrapper = mount(TenderSplitControl, { props: { tenders, targetCents: 100000 } })
    await wrapper.find('[data-testid="tender-split-equal"]').trigger('click')
    expect(wrapper.emitted('apply')).toEqual([[[33333, 33333, 33334]]])
  })

  it('emits the percent split only once the percents add up to 100%', async () => {
    const wrapper = mount(TenderSplitControl, { props: { tenders, targetCents: 607629 } })
    const toggle = wrapper.find('[data-testid="tender-split-percent-toggle"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    const inputs = [0, 1, 2].map((index) =>
      wrapper.find(`[data-testid="tender-split-percent-${index}"]`),
    )
    await inputs[0]!.setValue('50')
    await inputs[1]!.setValue('30')
    await inputs[2]!.setValue('10')
    expect(wrapper.find('[data-testid="tender-split-percent-total"]').text()).toContain(
      'Total 90%',
    )
    await wrapper.find('[data-testid="tender-split-percent-apply"]').trigger('click')
    expect(wrapper.emitted('apply')).toBeUndefined()
    await inputs[2]!.setValue('20')
    await wrapper.find('[data-testid="tender-split-percent-apply"]').trigger('click')
    expect(wrapper.emitted('apply')).toEqual([[[303814, 182288, 121527]]])
  })

  it.each([
    [['33.33', '33.33', '33.34']],
    [['0.01', '66.79', '33.20']],
  ])('labels %j as «Total 100%» (integer basis points, no float drift)', async (typed) => {
    const wrapper = mount(TenderSplitControl, { props: { tenders, targetCents: 607629 } })
    await wrapper.find('[data-testid="tender-split-percent-toggle"]').trigger('click')
    for (const [index, value] of typed.entries())
      await wrapper.find(`[data-testid="tender-split-percent-${index}"]`).setValue(value)
    const total = wrapper.find('[data-testid="tender-split-percent-total"]').text()
    expect(total).toContain('Total 100%')
    expect(total).not.toContain('·')
  })

  it('labels a partial total with its two decimals', async () => {
    const wrapper = mount(TenderSplitControl, { props: { tenders, targetCents: 607629 } })
    await wrapper.find('[data-testid="tender-split-percent-toggle"]').trigger('click')
    await wrapper.find('[data-testid="tender-split-percent-0"]').setValue('50')
    await wrapper.find('[data-testid="tender-split-percent-1"]').setValue('30.5')
    await wrapper.find('[data-testid="tender-split-percent-2"]').setValue('0')
    expect(wrapper.find('[data-testid="tender-split-percent-total"]').text()).toContain(
      'Total 80.50%',
    )
  })

  it('emits nothing while disabled', async () => {
    const wrapper = mount(TenderSplitControl, {
      props: { tenders, targetCents: 100000, disabled: true },
    })
    await wrapper.find('[data-testid="tender-split-equal"]').trigger('click')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })
})

describe('TenderRemainingButton', () => {
  const pair = [
    { method: 'cash', amountCents: 200000 },
    { method: 'card_debit', amountCents: 0 },
  ]

  it('emits what the other tenders leave pending (2,000 cash → card 4,076.29)', async () => {
    const wrapper = mount(TenderRemainingButton, {
      props: { tenders: pair, index: 1, targetCents: 607629, label: 'Tarjeta de débito' },
    })
    const button = wrapper.find('button')
    expect(button.text()).toContain('Lo que falta')
    expect(button.attributes('aria-label')).toBe(
      'Completar Tarjeta de débito con lo que falta: $4,076.29',
    )
    await button.trigger('click')
    expect(wrapper.emitted('fill')).toEqual([[407629]])
  })

  it('is hidden when the tenders cover the target, cash over included', () => {
    const wrapper = mount(TenderRemainingButton, {
      props: {
        tenders: [{ method: 'cash', amountCents: 700000 }, pair[1]!],
        index: 1,
        targetCents: 607629,
        label: 'Tarjeta de débito',
      },
    })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('restores a non-cash tender above what is pending (cash 2,000 + card 5,000 → card 4,076.29)', async () => {
    const wrapper = mount(TenderRemainingButton, {
      props: {
        tenders: [pair[0]!, { method: 'card_debit', amountCents: 500000 }],
        index: 1,
        targetCents: 607629,
        label: 'Tarjeta de débito',
      },
    })
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.attributes('aria-label')).toBe(
      'Completar Tarjeta de débito con lo que falta: $4,076.29',
    )
    await button.trigger('click')
    expect(wrapper.emitted('fill')).toEqual([[407629]])
  })

  it('is hidden on a non-cash tender with an amount when cash alone covers the target (no $0.00 fill)', () => {
    const wrapper = mount(TenderRemainingButton, {
      props: {
        tenders: [{ method: 'cash', amountCents: 607629 }, { method: 'card_debit', amountCents: 100000 }],
        index: 1,
        targetCents: 607629,
        label: 'Tarjeta de débito',
      },
    })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('is hidden on a tender that already holds exactly what is pending for it', () => {
    const wrapper = mount(TenderRemainingButton, {
      props: {
        tenders: [pair[0]!, { method: 'card_debit', amountCents: 407629 }],
        index: 1,
        targetCents: 607629,
        label: 'Tarjeta de débito',
      },
    })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('is hidden on cash above what is pending (it gives change, S7)', () => {
    const wrapper = mount(TenderRemainingButton, {
      props: {
        tenders: [{ method: 'cash', amountCents: 700000 }],
        index: 0,
        targetCents: 607629,
        label: 'Efectivo',
      },
    })
    expect(wrapper.find('button').exists()).toBe(false)
  })
})

describe('split controls design guard', () => {
  it('uses only the control radius token and no card surface', () => {
    const css = readFileSync(resolve(__dirname, '../tender-split.css'), 'utf8')
    const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(declarations).not.toMatch(/border-radius:(?!\s*var\(--hf-radius-control\))/)
    expect(declarations).not.toMatch(/background(?:-color)?:/)
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(declarations).not.toContain('!important')
  })
})
