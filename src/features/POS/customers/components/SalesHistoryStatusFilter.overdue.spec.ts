import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { CustomerHistoryStatusFilter } from '@/features/POS/sales/composables/useCustomerSalesHistory'
import SalesHistoryStatusFilter from './SalesHistoryStatusFilter.vue'

// Sales history backend data T1 (S3): «Vencidas» (`overdue=true`) with `counts.overdue`; hidden
// when the counts lack the member (older payloads).
const stubs = { UIcon: true }
const label = (value: string) => value.replace(/\s+/g, ' ').trim()

describe('SalesHistoryStatusFilter — Vencidas', () => {
  it('adds «Vencidas» with the customer-wide overdue count and emits overdue', async () => {
    const w = mount(SalesHistoryStatusFilter, {
      props: {
        modelValue: 'all' as CustomerHistoryStatusFilter,
        counts: { all: 14, pendingPayments: 3, notDelivered: 1, overdue: 2 },
      },
      global: { stubs },
    })
    const chips = w.findAll('button')
    expect(chips.map((chip) => label(chip.text()))).toEqual([
      'Todas',
      'Con saldo 3',
      'Sin entregar 1',
      'Vencidas 2',
    ])
    await chips[3]!.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['overdue']])
    expect(chips[3]!.classes()).toEqual(expect.arrayContaining(['min-h-11', 'md:min-h-9']))
  })

  it('keeps «Vencidas» with zero overdue (no count) so a pressed filter can be read', () => {
    const w = mount(SalesHistoryStatusFilter, {
      props: {
        modelValue: 'overdue',
        counts: { all: 3, pendingPayments: 0, notDelivered: 0, overdue: 0 },
      },
      global: { stubs },
    })
    const chip = w.findAll('button')[3]!
    expect(label(chip.text())).toBe('Vencidas')
    expect(chip.attributes('aria-pressed')).toBe('true')
  })

  it('has no «Vencidas» when counts lack overdue', () => {
    const w = mount(SalesHistoryStatusFilter, {
      props: { modelValue: 'all', counts: { all: 3, pendingPayments: 1, notDelivered: 0 } },
      global: { stubs },
    })
    expect(w.findAll('button')).toHaveLength(3)
    expect(w.text()).not.toContain('Vencidas')
  })
})
