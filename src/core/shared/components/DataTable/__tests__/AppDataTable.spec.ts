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

/**
 * Stub that exposes the props it receives on a `data-*` attribute pair so tests
 * can assert pass-through behavior without coupling to the toolbar template.
 */
function toolbarStubWithProps() {
  return {
    props: [
      'refreshButtonTestId',
      'addButtonTestId',
      'showRefresh',
      'showAddButton',
    ],
    template: `
      <div
        data-testid="toolbar"
        :data-refresh-button-test-id="refreshButtonTestId ?? ''"
        :data-add-button-test-id="addButtonTestId ?? ''"
      >
        <slot name="filters" />
        <slot name="actions" />
      </div>
    `,
  }
}

function mountComponent(
  overrideProps: Record<string, unknown> = {},
  options: { includeCardsSlot?: boolean, toolbarStub?: boolean } = {},
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
        DataTableToolbar: options.toolbarStub
          ? toolbarStubWithProps()
          : { template: '<div data-testid="toolbar"><slot name="filters" /><slot name="actions" /></div>' },
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
      errorMessage: 'No se pudieron cargar los datos. Reintenta.',
      data: [],
      totalCount: 0,
    })

    expect(wrapper.find('[data-testid="table-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="table-error-state"]').text()).toContain(
      'No se pudieron cargar los datos. Reintenta.',
    )
    // The generic empty text must NOT show when error is true.
    expect(wrapper.text()).not.toContain('No se encontraron resultados')
    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(false)
  })

  it('renders the error block (and not the mobile empty state) in cards view when error=true', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountComponent({
      error: true,
      errorMessage: 'No se pudieron cargar los datos. Reintenta.',
      data: [],
      totalCount: 0,
      mobileRender: 'cards',
    })

    expect(wrapper.find('[data-testid="cards-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cards-error-state"]').text()).toContain(
      'No se pudieron cargar los datos. Reintenta.',
    )
    expect(wrapper.find('[data-testid="mobile-empty-state"]').exists()).toBe(false)
  })

  it('renders the error block (and NOT the cards slot) when displayMode=cards, #cards slot present, and error=true', () => {
    const wrapper = mountComponent(
      {
        displayMode: 'cards',
        error: true,
        errorMessage: 'No se pudieron cargar los datos. Reintenta.',
        data: [],
        totalCount: 0,
      },
      { includeCardsSlot: true },
    )

    expect(wrapper.find('[data-testid="cards-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cards-error-state"]').text()).toContain(
      'No se pudieron cargar los datos. Reintenta.',
    )
    // The custom cards slot must NOT render when the request failed — a failed
    // request is never masked as an empty (or stale) card grid.
    expect(wrapper.find('[data-testid="cards-slot"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(false)
  })

  it('emits "refresh" when the cards-mode retry button is clicked', async () => {
    const wrapper = mountComponent(
      {
        displayMode: 'cards',
        error: true,
        data: [],
        totalCount: 0,
      },
      { includeCardsSlot: true },
    )

    await wrapper.get('[data-testid="cards-error-retry"]').trigger('click')

    expect(wrapper.emitted('refresh')).toBeTruthy()
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('renders the cards slot (and not the error block) when error=false and #cards slot present', () => {
    const wrapper = mountComponent({ displayMode: 'cards' }, { includeCardsSlot: true })

    expect(wrapper.find('[data-testid="cards-slot"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cards-error-state"]').exists()).toBe(false)
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

// ─── Toolbar testid pass-through (REQ-QAF-016 anti-requirements) ─────────────
// REQ-QAF-016 keeps shared testids (`refresh-quotations-button`,
// `new-quotation-button`) resolvable even though the buttons now live inside
// AppDataTable's toolbar. AppDataTable forwards optional testid props so the
// underlying buttons can carry the legacy testids without breaking other
// callers — defaults remain `undefined`.

describe('AppDataTable toolbar testid pass-through', () => {
  beforeEach(() => {
    isBelowBreakpoint.value = false
  })

  it('forwards refreshButtonTestId and addButtonTestId to DataTableToolbar when provided', () => {
    const wrapper = mountComponent(
      {
        showRefresh: true,
        showAddButton: true,
        refreshButtonTestId: 'refresh-quotations-button',
        addButtonTestId: 'new-quotation-button',
      },
      { toolbarStub: true },
    )

    const toolbar = wrapper.get('[data-testid="toolbar"]')
    expect(toolbar.attributes('data-refresh-button-test-id')).toBe('refresh-quotations-button')
    expect(toolbar.attributes('data-add-button-test-id')).toBe('new-quotation-button')
  })

  it('defaults refreshButtonTestId and addButtonTestId to undefined (no testid rendered)', () => {
    const wrapper = mountComponent({}, { toolbarStub: true })

    const toolbar = wrapper.get('[data-testid="toolbar"]')
    // Empty string in the stub represents "no value provided".
    expect(toolbar.attributes('data-refresh-button-test-id')).toBe('')
    expect(toolbar.attributes('data-add-button-test-id')).toBe('')
  })
})
