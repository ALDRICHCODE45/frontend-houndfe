import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DataTableFiltersChips from '../DataTableFiltersChips.vue'

describe('DataTableFiltersChips', () => {
  it('renders active chips and emits remove', async () => {
    const wrapper = mount(DataTableFiltersChips, {
      props: {
        chips: [
          { id: 'paymentStatus', label: 'Estado', value: 'Pagada' },
          { id: 'total', label: 'Total', value: '100 - 500' },
        ],
      },
      global: {
        stubs: {
          UBadge: { template: '<span><slot /></span>' },
          UButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Estado')
    expect(wrapper.text()).toContain('Total')

    await wrapper.find('[data-testid="chip-remove-paymentStatus"]').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['paymentStatus']])
  })

  it('emits clear when clear action clicked', async () => {
    const wrapper = mount(DataTableFiltersChips, {
      props: {
        chips: [{ id: 'paymentStatus', label: 'Estado', value: 'Pagada' }],
      },
      global: {
        stubs: {
          UBadge: { template: '<span><slot /></span>' },
          UButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        },
      },
    })

    await wrapper.find('[data-testid="chips-clear"]').trigger('click')
    expect(wrapper.emitted('clear')).toEqual([[]])
  })

  it('renders nothing when there are no chips', () => {
    const wrapper = mount(DataTableFiltersChips, {
      props: { chips: [] },
      global: {
        stubs: {
          UBadge: { template: '<span><slot /></span>' },
          UButton: { template: '<button><slot /></button>' },
        },
      },
    })

    expect(wrapper.find('[data-testid="filters-chips"]').exists()).toBe(false)
  })
})
