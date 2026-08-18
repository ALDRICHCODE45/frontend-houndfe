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
  USlideover: { props: ['open', 'side', 'ui'], template: '<div data-testid="slideover" :data-open="String(open)" :data-side="side" :data-ui="ui ? JSON.stringify(ui) : \'\'"><slot name="content" /></div>' },
  Icon: true,
  Badge: { template: '<span :data-testid="$attrs[\'data-testid\']">{{ label }}<slot /></span>', props: ['label'] },
  Button: { template: '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>' },
  Slideover: { props: ['open', 'side', 'ui'], template: '<div data-testid="slideover" :data-open="String(open)" :data-side="side" :data-ui="ui ? JSON.stringify(ui) : \'\'"><slot name="content" /></div>' },
  MultiSelectEnumFilter: { name: 'MultiSelectEnumFilter', template: '<div data-testid="primitive-enum" :data-is-active="String(!!isActive)" />', props: ['error', 'displayDivisor', 'isActive'] },
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

  it('applies bottom-sheet ui overrides only on mobile', () => {
    desktopRef.value = true
    const desktop = mount(DataTableFilters, { props: { schema, state: schema.defaults() }, global: { stubs: baseStubs } })
    expect(desktop.find('[data-testid="slideover"]').attributes('data-ui')).toBe('{}')

    desktopRef.value = false
    const mobile = mount(DataTableFilters, { props: { schema, state: schema.defaults() }, global: { stubs: baseStubs } })
    const mobileUi = mobile.find('[data-testid="slideover"]').attributes('data-ui') ?? ''
    expect(mobileUi).toContain('h-[85vh]')
    expect(mobileUi).toContain('max-h-[85vh]')
    expect(mobileUi).toContain('rounded-t-2xl')
  })

  it('groups fields by section, no-section first, marks active filters on the primitive', () => {
    // The section dot was removed when the chips row left the header — active
    // filters are now marked by `is-active=true` on the primitive itself, so
    // it can render a primary ring around the input/select.
    const wrapper = mount(DataTableFilters, {
      props: { schema, state: { ...schema.defaults(), paymentMethod: ['CARD_DEBIT'] } },
      global: { stubs: baseStubs },
    })

    const groups = wrapper.findAll('[data-testid^="section-group-"]')
    expect(groups[0]?.attributes('data-testid')).toBe('section-group-__no_section__')
    expect(wrapper.find('[data-testid="section-dot-Cobro"]').exists()).toBe(false)
    // The "Cobro" group holds the paymentMethod enum filter; its primitive
    // must receive isActive=true so the visual ring lands on it.
    const cobroEnum = wrapper.find('[data-testid="primitive-enum"]')
    expect(cobroEnum.attributes('data-is-active')).toBe('true')
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

  // ── embedded mode (REQ-5 / WU-1) ──────────────────────────────────────────
  // When embedded, the wrapper DataTableToolbar owns the slideover; this
  // component renders only its filter sections + chips inside that sheet.
  // The trigger button and the own slideover MUST NOT render, and the
  // exposed open()/close() controls MUST be no-ops so a stale caller cannot
  // accidentally toggle a hidden sheet.

  it('embedded=true renders only the embedded filter surface (no trigger, no slideover)', () => {
    const state = { ...schema.defaults(), paymentMethod: ['CARD_DEBIT'] }
    const wrapper = mount(DataTableFilters, {
      props: { schema, state, embedded: true },
      global: { stubs: baseStubs },
    })

    expect(wrapper.find('[data-testid="data-table-filters-embedded"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="filters-trigger"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slideover"]').exists()).toBe(false)
  })

  it('embedded=true: exposed open()/close() are no-ops (slideover state stays closed)', async () => {
    const wrapper = mount(DataTableFilters, {
      props: { schema, state: schema.defaults(), embedded: true },
      global: { stubs: baseStubs },
    })

    // Pre-condition: in embedded mode there is no slideover at all, so calling
    // open()/close() must not throw or attempt to mount one.
    expect(wrapper.find('[data-testid="slideover"]').exists()).toBe(false)

    const vm = wrapper.vm as unknown as { open: () => void, close: () => void }
    vm.open()
    vm.close()
    await wrapper.vm.$nextTick()

    // Still no slideover — embedded mode owns nothing that should be toggled.
    expect(wrapper.find('[data-testid="slideover"]').exists()).toBe(false)
  })

  it('embedded unset preserves current standalone trigger + slideover behaviour', () => {
    const wrapper = mount(DataTableFilters, {
      props: { schema, state: schema.defaults() },
      global: { stubs: baseStubs },
    })

    expect(wrapper.find('[data-testid="filters-trigger"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slideover"]').exists()).toBe(true)
    // The embedded marker MUST NOT render when the prop is omitted/false.
    expect(wrapper.find('[data-testid="data-table-filters-embedded"]').exists()).toBe(false)
  })
})
