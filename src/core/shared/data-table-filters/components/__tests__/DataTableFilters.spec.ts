import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import DataTableFilters from '../DataTableFilters.vue'
import { defineFiltersSchema } from '../../schema/defineFiltersSchema'
import { filter } from '../../schema/filterFactories'

const desktopRef = ref(true)

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof import('@vueuse/core')>('@vueuse/core')
  return {
    ...actual,
    useBreakpoints: () => ({ greaterOrEqual: () => desktopRef }),
  }
})

const schema = defineFiltersSchema([
  filter.multiText({ id: 'folio', label: 'Folio', param: 'folio' }),
  filter.multiEnum({
    id: 'paymentMethod',
    label: 'Método',
    section: 'Cobro',
    param: 'paymentMethod',
    options: [{ label: 'Tarjeta débito', value: 'CARD_DEBIT' }],
    includeNull: { param: 'paymentMethodIncludeNull', label: 'Sin método' },
  }),
  filter.multiAsync({ id: 'sellerIds', label: 'Vendedor', section: 'Cobro', param: 'sellerIds', options: [{ label: 'Ana', value: 'seller-1' }] }),
  filter.numericRange({ id: 'total', label: 'Total', section: 'Montos', minParam: 'totalMin', maxParam: 'totalMax', formatAs: 'currency' }),
  filter.dateRange({ id: 'confirmedAt', label: 'Fecha', section: 'Fecha', fromParam: 'from', toParam: 'to' }),
])

const baseStubs = {
  UIcon: true,
  UBadge: { template: '<span :data-testid="$attrs[\'data-testid\']">{{ label }}<slot /></span>', props: ['label'] },
  UButton: { template: '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>' },
  USlideover: { props: ['open', 'side'], template: '<div data-testid="slideover" :data-open="String(open)" :data-side="side"><slot name="content" /></div>' },
  Icon: true,
  Badge: { template: '<span :data-testid="$attrs[\'data-testid\']">{{ label }}<slot /></span>', props: ['label'] },
  Button: { template: '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>' },
  Slideover: { props: ['open', 'side'], template: '<div data-testid="slideover" :data-open="String(open)" :data-side="side"><slot name="content" /></div>' },
  MultiSelectEnumFilter: { name: 'MultiSelectEnumFilter', template: '<div data-testid="primitive-enum" />', props: ['error', 'displayDivisor'] },
  MultiSelectAsyncFilter: { name: 'MultiSelectAsyncFilter', template: '<div data-testid="primitive-async" />' },
  MultiTextInputFilter: { name: 'MultiTextInputFilter', template: '<div data-testid="primitive-text" />' },
  NumericRangeFilter: { name: 'NumericRangeFilter', template: '<div data-testid="primitive-numeric" />', props: ['displayDivisor', 'error'] },
  DateRangeFilter: { name: 'DateRangeFilter', template: '<div data-testid="primitive-date" />' },
  DataTableFiltersChips: { template: '<div data-testid="chips-stub" />' },
}

describe('DataTableFilters (v2)', () => {
  it('renders trigger, count badge, header actions and responsive side', async () => {
    desktopRef.value = true
    const state = { ...schema.defaults(), paymentMethod: ['CARD_DEBIT'] }
    const wrapper = mount(DataTableFilters, { props: { schema, state }, global: { stubs: baseStubs } })

    expect(wrapper.find('[data-testid="filters-trigger"]').text()).toContain('Filtros')
    expect(wrapper.find('[data-testid="filters-trigger-count"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slideover"]').attributes('data-side')).toBe('right')

    await wrapper.find('[data-testid="filters-trigger"]').trigger('click')
    expect(wrapper.find('[data-testid="slideover"]').attributes('data-open')).toBe('true')
    expect(wrapper.find('[data-testid="filters-header"]').text()).toContain('Filtros')
    expect(wrapper.find('[data-testid="clear-all-button"]').exists()).toBe(true)

    desktopRef.value = false
    const mobile = mount(DataTableFilters, { props: { schema, state: schema.defaults() }, global: { stubs: baseStubs } })
    expect(mobile.find('[data-testid="slideover"]').attributes('data-side')).toBe('bottom')
  })

  it('groups fields by section, no-section first, section dot active', () => {
    const wrapper = mount(DataTableFilters, {
      props: { schema, state: { ...schema.defaults(), paymentMethod: ['CARD_DEBIT'] } },
      global: { stubs: baseStubs },
    })

    const groups = wrapper.findAll('[data-testid^="section-group-"]')
    expect(groups[0]?.attributes('data-testid')).toBe('section-group-__no_section__')
    expect(wrapper.find('[data-testid="section-dot-Cobro"]').exists()).toBe(true)
  })

  it('renders correct primitive per kind, passes errors, clear all resets defaults', async () => {
    const wrapper = mount(DataTableFilters, {
      props: {
        schema,
        state: { ...schema.defaults(), paymentMethod: ['CARD_DEBIT'], total: { min: 100 } },
        errors: { paymentMethod: 'Error método' },
      },
      global: { stubs: baseStubs },
    })

    expect(wrapper.find('[data-testid="primitive-enum"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="primitive-async"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="primitive-text"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="primitive-numeric"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="primitive-date"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'MultiSelectEnumFilter' }).props('error')).toBe('Error método')
    expect(wrapper.findComponent({ name: 'NumericRangeFilter' }).props('displayDivisor')).toBe(100)

    await wrapper.find('[data-testid="clear-all-button"]').trigger('click')
    const updates = wrapper.emitted('update:state') ?? []
    expect(updates[updates.length - 1]?.[0]).toEqual(schema.defaults())
  })

  it('close button closes slideover without mutating state', async () => {
    const state = { ...schema.defaults(), paymentMethod: ['CARD_DEBIT'] }
    const wrapper = mount(DataTableFilters, { props: { schema, state }, global: { stubs: baseStubs } })

    await wrapper.find('[data-testid="filters-trigger"]').trigger('click')
    expect(wrapper.find('[data-testid="slideover"]').attributes('data-open')).toBe('true')
    await wrapper.find('[data-testid="close-filters"]').trigger('click')
    expect(wrapper.find('[data-testid="slideover"]').attributes('data-open')).toBe('false')
    expect(wrapper.emitted('update:state')).toBeUndefined()
  })
})
