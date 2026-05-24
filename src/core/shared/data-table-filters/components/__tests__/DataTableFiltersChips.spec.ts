import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineFiltersSchema } from '../../schema/defineFiltersSchema'
import { filter } from '../../schema/filterFactories'
import DataTableFiltersChips from '../DataTableFiltersChips.vue'

const schema = defineFiltersSchema([
  filter.multiEnum({
    id: 'paymentMethod',
    label: 'Método',
    param: 'paymentMethod',
    options: [
      { label: 'Tarjeta débito', value: 'CARD_DEBIT' },
      { label: 'Efectivo', value: 'CASH' },
      { label: 'Transferencia', value: 'TRANSFER' },
      { label: 'QR', value: 'QR' },
    ],
    includeNull: { param: 'paymentMethodIncludeNull', label: 'Sin método' },
  }),
  filter.multiAsync({
    id: 'sellerIds',
    label: 'Vendedor',
    param: 'sellerIds',
    options: [
      { label: 'Ana', value: 'seller-1' },
      { label: 'Juan', value: 'seller-2' },
    ],
  }),
  filter.multiText({ id: 'folio', label: 'Folio', param: 'folio' }),
  filter.numericRange({ id: 'total', label: 'Total', minParam: 'totalMin', maxParam: 'totalMax' }),
  filter.dateRange({ id: 'confirmedAt', label: 'Fecha', fromParam: 'from', toParam: 'to' }),
])

describe('DataTableFiltersChips (v2)', () => {
  it('renders one chip per active filter group for all kinds', () => {
    const state = {
      ...schema.defaults(),
      paymentMethod: ['CARD_DEBIT', 'CASH', 'TRANSFER', 'QR'],
      sellerIds: ['seller-1', 'seller-2'],
      folio: ['A-10'],
      total: { min: 100, max: 800 },
      confirmedAt: { from: '2026-01-10T00:00:00.000Z', to: '2026-01-12T23:59:59.999Z' },
    }

    const wrapper = mount(DataTableFiltersChips, {
      props: { schema, state },
      global: {
        stubs: {
          UBadge: { template: '<span><slot /></span>' },
          UButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        },
      },
    })

    expect(wrapper.findAll('[data-testid^="chip-clear-"]').length).toBe(5)
    expect(wrapper.text()).toContain('Método: 4 seleccionados')
    expect(wrapper.text()).toContain('Vendedor: Ana, Juan')
    expect(wrapper.text()).toContain('Folio: A-10')
    expect(wrapper.text()).toContain('Total: 100 - 800')
    expect(wrapper.text()).toContain('Fecha: 2026-01-10T00:00:00.000Z - 2026-01-12T23:59:59.999Z')
  })

  it('uses resolveLabel labels instead of raw enum codes', () => {
    const state = {
      ...schema.defaults(),
      paymentMethod: ['CARD_DEBIT'],
    }

    const wrapper = mount(DataTableFiltersChips, {
      props: { schema, state },
      global: {
        stubs: {
          UBadge: { template: '<span><slot /></span>' },
          UButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Tarjeta débito')
    expect(wrapper.text()).not.toContain('CARD_DEBIT')
  })

  it('reflects includeNull in displayValue when no selected values', () => {
    const state = {
      ...schema.defaults(),
      paymentMethodIncludeNull: true,
    }

    const wrapper = mount(DataTableFiltersChips, {
      props: { schema, state },
      global: {
        stubs: {
          UBadge: { template: '<span><slot /></span>' },
          UButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Método: Incluye nulos')
  })

  it('emits clear(filterId) and clearAll', async () => {
    const state = {
      ...schema.defaults(),
      paymentMethod: ['CARD_DEBIT'],
    }

    const wrapper = mount(DataTableFiltersChips, {
      props: { schema, state },
      global: {
        stubs: {
          UBadge: { template: '<span><slot /></span>' },
          UButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        },
      },
    })

    await wrapper.find('[data-testid="chip-clear-paymentMethod"]').trigger('click')
    await wrapper.find('[data-testid="chips-clear-all"]').trigger('click')

    expect(wrapper.emitted('clear')).toEqual([['paymentMethod']])
    expect(wrapper.emitted('clearAll')).toEqual([[]])
  })
})
