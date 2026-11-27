import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import DataTableFilters from '../DataTableFilters.vue'
import { defineFiltersSchema } from '../../schema/defineFiltersSchema'
import { filter } from '../../schema/filterFactories'
import type { FilterState } from '../../schema/types'

// owner-ideas-batch T2 (S4): option filters with a few options render as toggle chips
// (docs/design-system.md: filters are toggle chips with aria-pressed), long, searchable or async
// lists keep the searchable dropdown. The state the sheet emits is the same as with the dropdown.

const desktopRef = ref(true)

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof import('@vueuse/core')>('@vueuse/core')
  return { ...actual, useBreakpoints: () => ({ greaterOrEqual: () => desktopRef }) }
})

const manyOptions = Array.from({ length: 9 }, (_, index) => ({ label: `Opción ${index + 1}`, value: `O${index + 1}` }))

const schema = defineFiltersSchema([
  filter.multiEnum({
    id: 'petSpecies',
    label: 'Especie',
    section: 'Mascotas',
    param: 'petSpecies',
    options: [
      { label: 'Perro', value: 'DOG' },
      { label: 'Gato', value: 'CAT' },
      { label: 'Otra', value: 'OTHER' },
    ],
  }),
  filter.multiEnum({
    id: 'deliveryZoneType',
    label: 'Zona de reparto',
    section: 'Ubicación',
    param: 'deliveryZoneType',
    options: [
      { label: 'Envío gratis', value: 'FREE' },
      { label: 'Con cargo', value: 'SURCHARGE' },
    ],
    includeNull: { param: 'deliveryZoneNone', label: 'Sin zona' },
  }),
  filter.multiEnum({ id: 'many', label: 'Muchas', section: 'Otros', param: 'many', options: manyOptions }),
  filter.multiEnum({
    id: 'searchableFew',
    label: 'Buscable',
    section: 'Otros',
    param: 'searchableFew',
    searchable: true,
    options: [{ label: 'Uno', value: '1' }],
  }),
  filter.multiAsync({
    id: 'neighborhood',
    label: 'Colonia',
    section: 'Ubicación',
    param: 'neighborhood',
    options: [{ label: 'Del Valle (41)', value: 'Del Valle' }],
  }),
  filter.booleanFlag({ id: 'hasDebt', label: 'Con deuda', section: 'Deuda' }),
  filter.singleEnum({
    id: 'overdueMoreThanDays',
    label: 'Vencida hace más de',
    section: 'Deuda',
    options: [
      { label: '30 días', value: '30' },
      { label: '60 días', value: '60' },
      { label: '90 días', value: '90' },
    ],
  }),
])

const stubs = {
  UIcon: true,
  UButton: true,
  UBadge: true,
  USlideover: { template: '<div><slot name="content" /></div>' },
  Slideover: { template: '<div><slot name="content" /></div>' },
  Icon: true,
  Button: true,
  Badge: true,
  MultiSelectEnumFilter: {
    name: 'MultiSelectEnumFilter',
    props: ['label'],
    template: '<div data-testid="primitive-enum" :data-label="label" />',
  },
  MultiSelectAsyncFilter: {
    name: 'MultiSelectAsyncFilter',
    props: ['label'],
    template: '<div data-testid="primitive-async" :data-label="label" />',
  },
  MultiTextInputFilter: true,
  NumericRangeFilter: true,
  DateRangeFilter: true,
}

// Like the list views (`v-model:state` on the reactive state of useDataTableFilters), the controls
// write the field of the state object in place, as the dropdown primitives do.
let currentState: FilterState = {}

function mountFilters(state: FilterState = schema.defaults(), props: Record<string, unknown> = {}) {
  currentState = reactive({ ...state })
  return mount(DataTableFilters, {
    props: { schema, state: currentState, embedded: true, ...props },
    global: { stubs },
  })
}

function chipGroup(wrapper: ReturnType<typeof mountFilters>, id: string) {
  return wrapper.get(`[data-testid="filter-chips-${id}"]`)
}

function chip(wrapper: ReturnType<typeof mountFilters>, id: string, value: string) {
  return chipGroup(wrapper, id).get(`button[data-value="${value}"]`)
}

function lastState(_wrapper: ReturnType<typeof mountFilters>): FilterState {
  return currentState
}

describe('DataTableFilters — toggle chips for small option sets', () => {
  it('renders a multi-enum with up to 8 options as a named group of toggle chips, not a dropdown', () => {
    const wrapper = mountFilters()
    const group = chipGroup(wrapper, 'petSpecies')
    const buttons = group.findAll('button.hf-toggle-chip')

    expect(buttons.map(button => button.text())).toEqual(['Perro', 'Gato', 'Otra'])
    expect(buttons.every(button => button.attributes('aria-pressed') === 'false')).toBe(true)
    const labelId = group.get('[role="group"]').attributes('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(wrapper.get(`#${labelId}`).text()).toBe('Especie')
    expect(wrapper.find('[data-testid="primitive-enum"][data-label="Especie"]').exists()).toBe(false)
  })

  it('keeps the searchable dropdown for long, searchable and async lists', () => {
    const wrapper = mountFilters()

    expect(wrapper.find('[data-testid="filter-chips-many"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="primitive-enum"][data-label="Muchas"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="filter-chips-searchableFew"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="primitive-enum"][data-label="Buscable"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="filter-chips-neighborhood"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="primitive-async"][data-label="Colonia"]').exists()).toBe(true)
  })

  it('takes the threshold as a prop and lets a field force its control', () => {
    const small = mountFilters(schema.defaults(), { chipsMaxOptions: 2 })
    expect(small.find('[data-testid="filter-chips-petSpecies"]').exists()).toBe(false)
    expect(small.find('[data-testid="filter-chips-hasDebt"]').exists()).toBe(true)

    const forced = defineFiltersSchema([
      filter.multiEnum({ id: 'a', label: 'A', param: 'a', display: 'select', options: [{ label: 'Uno', value: '1' }] }),
      filter.multiEnum({ id: 'b', label: 'B', param: 'b', display: 'chips', options: manyOptions }),
    ])
    const wrapper = mount(DataTableFilters, {
      props: { schema: forced, state: forced.defaults(), embedded: true },
      global: { stubs },
    })
    expect(wrapper.find('[data-testid="filter-chips-a"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="filter-chips-b"]').exists()).toBe(true)
  })

  it('renders chips in the standalone sheet too', () => {
    const wrapper = mountFilters(schema.defaults(), { embedded: false })
    expect(wrapper.find('[data-testid="filter-chips-petSpecies"]').exists()).toBe(true)
  })

  it('marks the pressed chips with aria-pressed from the state', () => {
    const wrapper = mountFilters({ ...schema.defaults(), petSpecies: ['CAT'], deliveryZoneNone: true })

    expect(chip(wrapper, 'petSpecies', 'CAT').attributes('aria-pressed')).toBe('true')
    expect(chip(wrapper, 'petSpecies', 'DOG').attributes('aria-pressed')).toBe('false')
    expect(chip(wrapper, 'deliveryZoneType', '__INCLUDE_NULL__').attributes('aria-pressed')).toBe('true')
  })

  it('emits the same values a dropdown would: appended in pick order, removed on a second click', async () => {
    const wrapper = mountFilters({ ...schema.defaults(), petSpecies: ['OTHER'] })

    await chip(wrapper, 'petSpecies', 'DOG').trigger('click')
    expect(lastState(wrapper).petSpecies).toEqual(['OTHER', 'DOG'])
    expect(schema.serialize(lastState(wrapper))).toEqual({ petSpecies: 'OTHER,DOG' })

    await chip(wrapper, 'petSpecies', 'OTHER').trigger('click')
    expect(lastState(wrapper).petSpecies).toEqual(['DOG'])
  })

  it('maps the «sin valor» option to its include-null flag, values untouched', async () => {
    const wrapper = mountFilters()
    const zoneChips = chipGroup(wrapper, 'deliveryZoneType').findAll('button.hf-toggle-chip')
    expect(zoneChips.map(button => button.text())).toEqual(['Envío gratis', 'Con cargo', 'Sin zona'])

    await chip(wrapper, 'deliveryZoneType', '__INCLUDE_NULL__').trigger('click')
    expect(lastState(wrapper)).toMatchObject({ deliveryZoneType: [], deliveryZoneNone: true })

    await chip(wrapper, 'deliveryZoneType', 'FREE').trigger('click')
    expect(lastState(wrapper)).toMatchObject({ deliveryZoneType: ['FREE'], deliveryZoneNone: true })
    expect(schema.serialize(lastState(wrapper))).toEqual(
      schema.serialize({ ...schema.defaults(), deliveryZoneType: ['FREE'], deliveryZoneNone: true }),
    )
  })

  it('offers «Limpiar (N)» on multiple-choice chips and clears values and the include-null flag', async () => {
    const wrapper = mountFilters({ ...schema.defaults(), deliveryZoneType: ['FREE'], deliveryZoneNone: true })
    const clear = chipGroup(wrapper, 'deliveryZoneType').get('button.hf-toggle-chips__clear')
    expect(clear.text()).toBe('Limpiar (2)')

    await clear.trigger('click')
    expect(lastState(wrapper)).toMatchObject({ deliveryZoneType: [], deliveryZoneNone: false })
  })

  it('makes boolean flags single-select: the last pick wins and a second click clears', async () => {
    const wrapper = mountFilters()
    const group = chipGroup(wrapper, 'hasDebt')
    expect(group.findAll('button.hf-toggle-chip').map(button => button.text())).toEqual(['Sí', 'No'])
    expect(group.find('button.hf-toggle-chips__clear').exists()).toBe(false)

    await chip(wrapper, 'hasDebt', 'true').trigger('click')
    expect(lastState(wrapper).hasDebt).toEqual(['true'])

    await chip(wrapper, 'hasDebt', 'false').trigger('click')
    expect(lastState(wrapper).hasDebt).toEqual(['false'])
    expect(schema.serialize(lastState(wrapper))).toEqual({ hasDebt: 'false' })

    expect(chip(wrapper, 'hasDebt', 'false').attributes('aria-pressed')).toBe('true')
    expect(chip(wrapper, 'hasDebt', 'true').attributes('aria-pressed')).toBe('false')
    await chip(wrapper, 'hasDebt', 'false').trigger('click')
    expect(lastState(wrapper).hasDebt).toEqual([])
    expect(schema.serialize(lastState(wrapper))).toEqual({})
  })

  it('makes single-choice enums single-select too', async () => {
    const wrapper = mountFilters({ ...schema.defaults(), overdueMoreThanDays: ['30'] })

    await chip(wrapper, 'overdueMoreThanDays', '90').trigger('click')
    expect(lastState(wrapper).overdueMoreThanDays).toEqual(['90'])
    expect(schema.serialize(lastState(wrapper))).toEqual({ overdueMoreThanDays: '90' })
  })

  it('keeps the active-filter chips and count identical', () => {
    const state = { ...schema.defaults(), petSpecies: ['DOG', 'CAT'], hasDebt: ['true'] }
    expect(schema.activeChips(state).map(entry => entry.filterId)).toEqual(['petSpecies', 'hasDebt'])
    const wrapper = mountFilters(state, { embedded: false })
    expect(wrapper.text()).not.toContain('undefined')
  })

  it('uses native buttons so the keyboard reaches every chip (Tab + Enter/Space)', () => {
    const wrapper = mountFilters()
    const buttons = chipGroup(wrapper, 'petSpecies').findAll('button')
    expect(buttons.every(button => button.attributes('type') === 'button')).toBe(true)
    expect(buttons.some(button => button.attributes('tabindex') === '-1')).toBe(false)
  })

  it('shows the field error under the chips', () => {
    const wrapper = mountFilters(schema.defaults(), { errors: { petSpecies: 'Elige una especie válida' } })
    expect(chipGroup(wrapper, 'petSpecies').text()).toContain('Elige una especie válida')
  })
})
