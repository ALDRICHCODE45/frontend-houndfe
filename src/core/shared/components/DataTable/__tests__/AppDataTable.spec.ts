import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, ref } from 'vue'
import AppDataTable from '../AppDataTable.vue'

const isBelowBreakpoint = ref(false)

vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    useBreakpoints: () => ({
      smaller: () => isBelowBreakpoint,
    }),
  }
})

type Row = { id: number; name: string }

const columns = [{ accessorKey: 'name', header: 'Name' }]
const data: Row[] = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }]

function mountComponent(
  overrideProps: Record<string, unknown> = {},
  options: { includeCardsSlot?: boolean } = {},
) {
  return mount(AppDataTable<Row>, {
    props: {
      columns,
      data,
      totalCount: data.length,
      pageCount: 1,
      ...overrideProps,
    },
    slots: {
      'mobile-card': ({ row, index }) =>
        h('article', { 'data-testid': 'mobile-card' }, `${index}:${row.name}`),
      ...(options.includeCardsSlot
        ? {
            cards: ({ data, loading, empty }: { data: Row[]; loading: boolean; empty: string }) =>
              h(
                'section',
                {
                  'data-testid': 'cards-slot',
                  'data-loading': String(loading),
                  'data-empty': empty,
                  'data-size': String(data.length),
                },
                data.map((row: Row) => row.name).join(','),
              ),
          }
        : {}),
    },
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar"><slot name="filters" /><slot name="actions" /></div>' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        DataTableBulkActions: { template: '<div data-testid="bulk-actions" />' },
        UTable: { template: '<div data-testid="table" v-bind="$attrs"><slot name="cards" /><slot name="name-cell" /></div>' },
      },
    },
  })
}

describe('AppDataTable mobile rendering', () => {
  beforeEach(() => {
    isBelowBreakpoint.value = false
  })

  it('keeps default behavior as table rendering', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent()

    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-card"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cards-slot"]').exists()).toBe(false)
  })

  it('renders cards slot when displayMode is cards', () => {
    const wrapper = mountComponent({ displayMode: 'cards' }, { includeCardsSlot: true })

    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cards-slot"]').exists()).toBe(true)
  })

  it('renders table path when displayMode is table', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent({ displayMode: 'table', mobileRender: 'cards' })

    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cards-slot"]').exists()).toBe(false)
  })

  it('keeps auto mode mobile behavior when mobileRender is cards below breakpoint', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent({ displayMode: 'auto', mobileRender: 'cards' }, { includeCardsSlot: true })

    expect(wrapper.find('[data-testid="cards-slot"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(false)
  })

  it('renders mobile-card slot when mobileRender is cards and below breakpoint', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent({ mobileRender: 'cards' })

    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="mobile-card"]')).toHaveLength(2)
  })

  it('renders table when mobileRender is cards and viewport is above breakpoint', () => {
    isBelowBreakpoint.value = false
    const wrapper = mountComponent({ mobileRender: 'cards' })

    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-card"]').exists()).toBe(false)
  })

  it('shows loading skeleton cards in cards mode on mobile', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent({ mobileRender: 'cards', loading: true, data: [] })

    expect(wrapper.findAll('[data-testid="mobile-card-skeleton"]')).toHaveLength(3)
    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(false)
  })

  it('shows empty message in cards mode when there is no data', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent({ mobileRender: 'cards', data: [], totalCount: 0 })

    expect(wrapper.find('[data-testid="mobile-empty-state"]').text()).toContain('No se encontraron resultados')
  })

  it('passes expected slot props to cards slot', () => {
    const wrapper = mountComponent({ displayMode: 'cards', fetching: true }, { includeCardsSlot: true })
    const cardsSlot = wrapper.find('[data-testid="cards-slot"]')

    expect(cardsSlot.attributes('data-size')).toBe('2')
    expect(cardsSlot.attributes('data-loading')).toBe('true')
    expect(cardsSlot.attributes('data-empty')).toBe('No se encontraron resultados')
    expect(cardsSlot.text()).toContain('Alpha,Beta')
  })

  it('keeps pagination visible in cards mode', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent({ mobileRender: 'cards' })

    expect(wrapper.find('[data-testid="pagination"]').exists()).toBe(true)
  })
})

// ─── Error state ─────────────────────────────────────────────────────────────
// When the underlying query has failed, AppDataTable must render a distinct
// error block INSTEAD of the empty/loading placeholders so users (and devs)
// see a real error message instead of a fake "no results" empty state.

describe('AppDataTable error state', () => {
  beforeEach(() => {
    isBelowBreakpoint.value = false
  })

  it('renders the error block (and not the empty text) in table view when error=true', () => {
    const wrapper = mountComponent({
      error: true,
      errorMessage: 'No se pudieron cargar los datos. Reintentá.',
      data: [],
      totalCount: 0,
    })

    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="table-error-state"]').text()).toContain(
      'No se pudieron cargar los datos. Reintentá.',
    )
    // The generic empty text must NOT show when error is true.
    expect(wrapper.text()).not.toContain('No se encontraron resultados')
    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(false)
  })

  it('renders the error block (and not the mobile empty state) in cards view when error=true', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent({
      error: true,
      errorMessage: 'No se pudieron cargar los datos. Reintentá.',
      data: [],
      totalCount: 0,
      mobileRender: 'cards',
    })

    expect(wrapper.find('[data-testid="mobile-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-error-state"]').text()).toContain(
      'No se pudieron cargar los datos. Reintentá.',
    )
    expect(wrapper.find('[data-testid="mobile-empty-state"]').exists()).toBe(false)
  })

  it('emits "refresh" when the retry button is clicked in error state', async () => {
    const wrapper = mountComponent({
      error: true,
      data: [],
      totalCount: 0,
    })

    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')

    expect(wrapper.emitted('refresh')).toBeTruthy()
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('renders the empty text (and not the error block) when error=false and data is empty', () => {
    const wrapper = mountComponent({
      error: false,
      data: [],
      totalCount: 0,
    })

    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('No se encontraron resultados')
  })

  it('uses the default error message in Spanish when errorMessage prop is not provided', () => {
    const wrapper = mountComponent({
      error: true,
      data: [],
      totalCount: 0,
    })

    const errorBlock = wrapper.find('[data-testid="table-error-state"]')
    expect(errorBlock.exists()).toBe(true)
    expect(errorBlock.text()).toContain('No se pudieron cargar los datos')
  })
})
