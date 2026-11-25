import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { makePet } from '../pets/__tests__/pet.fixture'
import type { CustomerHistoryStatusFilter } from '@/features/POS/sales/composables/useCustomerSalesHistory'
import SalesHistoryStatusFilter from './SalesHistoryStatusFilter.vue'
import SalesHistoryPetFilter from './SalesHistoryPetFilter.vue'

// Sales history redesign T1 (L3): single-choice «Todas» / «Con saldo» / «Sin entregar» chips with
// the customer-wide counts; toggle chips 36px, 44px below md (design system «Selección»).
const stubs = { UIcon: true }

describe('SalesHistoryStatusFilter', () => {
  it('offers Todas, Con saldo and Sin entregar with the customer-wide counts', () => {
    const w = mount(SalesHistoryStatusFilter, {
      props: { modelValue: 'all', counts: { all: 23, pendingPayments: 2, notDelivered: 1 } },
      global: { stubs },
    })
    expect(w.get('[role="group"]').attributes('aria-label')).toBe('Filtrar por estado')
    const chips = w.findAll('button')
    expect(chips.map((chip) => chip.text().replace(/\s+/g, ' ').trim())).toEqual([
      'Todas',
      'Con saldo 2',
      'Sin entregar 1',
    ])
    expect(chips.map((chip) => chip.attributes('aria-pressed'))).toEqual(['true', 'false', 'false'])
  })

  it('emits the chosen filter and marks it pressed', async () => {
    const w = mount(SalesHistoryStatusFilter, {
      props: {
        modelValue: 'all' as CustomerHistoryStatusFilter,
        'onUpdate:modelValue': (value: CustomerHistoryStatusFilter) =>
          w.setProps({ modelValue: value }),
      },
      global: { stubs },
    })
    await w.findAll('button')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['with-debt']])
    expect(w.findAll('button')[1]!.attributes('aria-pressed')).toBe('true')
    await w.findAll('button')[2]!.trigger('click')
    expect(w.emitted('update:modelValue')![1]).toEqual(['not-delivered'])
  })

  it('hides a zero count and keeps 44px targets below md', () => {
    const w = mount(SalesHistoryStatusFilter, {
      props: { modelValue: 'all', counts: { all: 3, pendingPayments: 0, notDelivered: 0 } },
      global: { stubs },
    })
    expect(w.findAll('button')[1]!.text().trim()).toBe('Con saldo')
    for (const chip of w.findAll('button')) {
      expect(chip.classes()).toEqual(expect.arrayContaining(['min-h-11', 'md:min-h-9']))
    }
  })
})

describe('SalesHistoryPetFilter — redesign', () => {
  it('labels the group «Mascota», keeps 44px chips below md and truncates long names', () => {
    const w = mount(SalesHistoryPetFilter, {
      props: {
        modelValue: null,
        pets: [makePet({ id: 'p1', name: 'Princesa Nala de Todos los Santos' })],
      },
      global: { stubs },
    })
    expect(w.text()).toContain('Mascota')
    const chips = w.findAll('[data-testid="history-pet-chip"]')
    for (const chip of chips) {
      expect(chip.classes()).toEqual(
        expect.arrayContaining(['min-h-11', 'md:min-h-9', 'max-w-full']),
      )
    }
    expect(chips[1]!.get('.truncate').text()).toBe('Princesa Nala de Todos los Santos')
    expect(chips[1]!.attributes('title')).toBe('Princesa Nala de Todos los Santos')
  })
})
