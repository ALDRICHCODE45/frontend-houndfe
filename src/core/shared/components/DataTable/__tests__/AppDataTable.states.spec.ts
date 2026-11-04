/**
 * Reference spec for S10: the four list states (empty, loading, data, error)
 * plus no-match. Feature screens copy this shape for their own list views:
 *   empty   → EmptyState kind "empty" with its title
 *   loading → table-skeleton (table) / mobile-card-skeleton (cards)
 *   data    → the rows
 *   error   → table-error-state with Reintentar
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, ref } from 'vue'
import AppDataTable from '../AppDataTable.vue'

const isBelowBreakpoint = ref(false)

vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

type Row = { id: number; name: string; status: string; total: string }

const columns = [
  { accessorKey: 'name', header: 'Nombre' },
  { accessorKey: 'status', header: 'Estado' },
  { id: 'total', header: 'Total' },
  { id: 'actions', header: 'Acciones' },
]
const rows: Row[] = [
  { id: 1, name: 'Alpha', status: 'a', total: '1' },
  { id: 2, name: 'Beta', status: 'b', total: '2' },
]

function mountTable(
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {},
) {
  return mount(AppDataTable<Row>, {
    props: { columns, data: rows, totalCount: rows.length, pageCount: 1, ...props },
    slots: {
      'mobile-card': ({ row }: { row: Row }) => h('article', { 'data-testid': 'mobile-card' }, row.name),
      ...slots,
    },
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        DataTableBulkActions: { template: '<div data-testid="bulk-actions" />' },
      },
    },
  })
}

const emptyList = { data: [] as Row[], totalCount: 0, pageCount: 0 }
const emptyState = { title: 'Aún no hay proveedores', description: 'Aquí aparecerán.', actionLabel: 'Crear proveedor' }

describe('AppDataTable states — data', () => {
  beforeEach(() => { isBelowBreakpoint.value = false })

  it('renders the rows with no state chrome', () => {
    const wrapper = mountTable({ emptyState, filtered: true })
    expect(wrapper.findAll('tbody td:first-child').map(cell => cell.text())).toEqual(['Alpha', 'Beta'])
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })
})

describe('AppDataTable states — empty', () => {
  beforeEach(() => { isBelowBreakpoint.value = false })

  it('keeps the legacy string behaviour byte-identical when no new prop is passed', () => {
    const table = mountTable({ ...emptyList })
    expect(table.get('tbody').text()).toBe('No se encontraron resultados')
    expect(table.find('.hf-empty-state').exists()).toBe(false)

    isBelowBreakpoint.value = true
    const cards = mountTable({ ...emptyList, mobileRender: 'cards', empty: 'Sin datos' })
    const block = cards.get('[data-testid="mobile-empty-state"]')
    expect(block.text()).toBe('Sin datos')
    expect(block.classes()).toEqual([
      'flex', 'min-h-32', 'w-full', 'min-w-0', 'max-w-full', 'items-center', 'justify-center',
      'rounded-lg', 'border', 'border-dashed', 'border-default', 'px-4', 'py-8', 'text-sm', 'text-muted',
    ])
    expect(cards.find('.hf-empty-state').exists()).toBe(false)
  })

  it('renders EmptyState kind empty through the table #empty slot, with its action', async () => {
    const wrapper = mountTable({ ...emptyList, emptyState })
    const state = wrapper.get('.hf-empty-state')
    expect(state.attributes('data-kind')).toBe('empty')
    expect(state.get('.hf-empty-state__title').text()).toBe('Aún no hay proveedores')
    expect(state.get('.hf-empty-state__description').text()).toBe('Aquí aparecerán.')
    await state.get('button').trigger('click')
    expect(wrapper.emitted('empty-action')).toHaveLength(1)
    expect(wrapper.emitted('clear-filters')).toBeUndefined()
  })

  it('renders no button when the empty state has no action', () => {
    const wrapper = mountTable({ ...emptyList, emptyState: { title: 'Aún no hay ventas' } })
    expect(wrapper.get('.hf-empty-state').find('button').exists()).toBe(false)
  })

  it('renders the same EmptyState in cards mode (mobile-empty-state)', async () => {
    isBelowBreakpoint.value = true
    const wrapper = mountTable({ ...emptyList, mobileRender: 'cards', emptyState })
    const block = wrapper.get('[data-testid="mobile-empty-state"]')
    expect(block.classes()).toContain('hf-empty-state')
    expect(block.attributes('data-kind')).toBe('empty')
    await block.get('button').trigger('click')
    expect(wrapper.emitted('empty-action')).toHaveLength(1)
  })

  it('lets a consumer #empty slot win over the shared state', () => {
    const wrapper = mountTable({ ...emptyList, emptyState, filtered: true }, {
      empty: () => h('p', { 'data-testid': 'own-empty' }, 'Propio'),
    })
    expect(wrapper.get('[data-testid="own-empty"]').text()).toBe('Propio')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })
})

describe('AppDataTable states — no-match', () => {
  beforeEach(() => { isBelowBreakpoint.value = false })

  it('wins over emptyState when filtered, with a default title and Limpiar filtros', async () => {
    const wrapper = mountTable({ ...emptyList, emptyState, filtered: true })
    const state = wrapper.get('.hf-empty-state')
    expect(state.attributes('data-kind')).toBe('no-match')
    expect(state.get('.hf-empty-state__title').text()).toBe('Ningún resultado')
    expect(state.get('button').text()).toContain('Limpiar filtros')
    await state.get('button').trigger('click')
    expect(wrapper.emitted('clear-filters')).toHaveLength(1)
    expect(wrapper.emitted('empty-action')).toBeUndefined()
  })

  it('names the search term when there is one, in the table and in cards', () => {
    const table = mountTable({ ...emptyList, filtered: true, globalFilter: '  collar ' })
    expect(table.get('.hf-empty-state__title').text()).toBe('Ningún resultado para «collar»')

    isBelowBreakpoint.value = true
    const cards = mountTable({ ...emptyList, filtered: true, globalFilter: 'collar', mobileRender: 'cards' })
    expect(cards.get('[data-testid="mobile-empty-state"] .hf-empty-state__title').text()).toBe('Ningún resultado para «collar»')
  })

  it('falls back to noMatchTitle when only filters (no search term) matched nothing', () => {
    const wrapper = mountTable({ ...emptyList, filtered: true, globalFilter: '   ', noMatchTitle: 'Ninguna venta con esos filtros' })
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Ninguna venta con esos filtros')
  })

  it('uses noMatchTitle, and works without emptyState', () => {
    const wrapper = mountTable({ ...emptyList, filtered: true, noMatchTitle: 'Ningún resultado para «collar»' })
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Ningún resultado para «collar»')
  })

  it('renders in cards mode as well', async () => {
    isBelowBreakpoint.value = true
    const wrapper = mountTable({ ...emptyList, mobileRender: 'cards', filtered: true })
    const block = wrapper.get('[data-testid="mobile-empty-state"]')
    expect(block.attributes('data-kind')).toBe('no-match')
    await block.get('button').trigger('click')
    expect(wrapper.emitted('clear-filters')).toHaveLength(1)
  })
})

describe('AppDataTable states — loading', () => {
  beforeEach(() => { isBelowBreakpoint.value = false })

  it('shows a table-shaped skeleton while loading with no rows', () => {
    const wrapper = mountTable({ ...emptyList, loading: true, emptyState })
    const skeleton = wrapper.get('[data-testid="table-skeleton"]')
    expect(skeleton.attributes('aria-busy')).toBe('true')
    const skeletonRows = skeleton.findAll('[data-testid="table-skeleton-row"]')
    expect(skeletonRows).toHaveLength(5)
    for (const row of skeletonRows) {
      expect(row.findAll('.animate-pulse')).toHaveLength(columns.length)
      expect(row.classes()).toContain('h-16')
    }
    expect(wrapper.find('[data-testid="table-view"]').exists()).toBe(false)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('keeps the real header row, so the surface does not change height when the rows arrive', () => {
    const wrapper = mountTable({ ...emptyList, loading: true })
    const skeleton = wrapper.get('[data-testid="table-skeleton"]')
    expect(skeleton.findAll('thead th').map(th => th.text())).toEqual(['Nombre', 'Estado', 'Total', 'Acciones'])
    expect(skeleton.find('[data-testid="table-skeleton-header"]').exists()).toBe(true)
  })

  it('has no inner bordered box: the surface around the table is the only border', () => {
    const classes = mountTable({ ...emptyList, loading: true }).get('[data-testid="table-skeleton"]').classes()
    expect(classes).not.toContain('border')
    expect(classes).not.toContain('rounded-lg')
  })

  it('shows min(pageSize, 5) rows', () => {
    const rowsFor = (pageSize: number) =>
      mountTable({ ...emptyList, loading: true, pagination: { pageIndex: 0, pageSize } })
        .findAll('[data-testid="table-skeleton-row"]').length
    expect(rowsFor(3)).toBe(3)
    expect(rowsFor(5)).toBe(5)
    expect(rowsFor(50)).toBe(5)
  })

  it('paints the bars with the readable skeleton wash, not the faint muted surface', () => {
    const wrapper = mountTable({ ...emptyList, loading: true })
    for (const bar of wrapper.findAll('[data-testid="table-skeleton-row"] .animate-pulse')) {
      expect(bar.classes()).toContain('hf-skeleton')
      expect(bar.classes().join(' ')).not.toContain('surface-muted')
    }
  })

  it('draws one bar per visible column', () => {
    const wrapper = mountTable({
      ...emptyList,
      loading: true,
      columnVisibility: { status: false },
    })
    const row = wrapper.get('[data-testid="table-skeleton-row"]')
    expect(row.findAll('.animate-pulse')).toHaveLength(columns.length - 1)
  })

  it('keeps the table (progress bar) for a background fetch with rows', () => {
    const wrapper = mountTable({ fetching: true })
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'Table' }).props('loading')).toBe(true)
    expect(wrapper.findAll('tbody td:first-child')).toHaveLength(2)
  })

  it('keeps the card skeletons in cards mode', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountTable({ ...emptyList, loading: true, mobileRender: 'cards', emptyState })
    expect(wrapper.findAll('[data-testid="mobile-card-skeleton"]')).toHaveLength(3)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('shapes each card skeleton like a mobile card: title, secondary, badge and a two-bar footer', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountTable({ ...emptyList, loading: true, mobileRender: 'cards' })
    const region = wrapper.get('[data-testid="mobile-cards-loading"]')
    expect(region.attributes('aria-busy')).toBe('true')
    const cards = region.findAll('[data-testid="mobile-card-skeleton"]')
    expect(cards).toHaveLength(3)
    for (const card of cards) {
      expect(card.classes()).toEqual(expect.arrayContaining(['rounded-[var(--hf-radius-card)]', 'p-4', 'animate-pulse']))
      expect(card.classes().join(' ')).toContain('bg-[var(--hf-surface-muted)]')
      expect(card.findAll('.hf-skeleton').length).toBeGreaterThanOrEqual(5)
      expect(card.get('[data-testid="mobile-card-skeleton-title"]').classes()).toContain('w-3/5')
      expect(card.get('[data-testid="mobile-card-skeleton-secondary"]').classes()).toContain('w-2/5')
      expect(card.get('[data-testid="mobile-card-skeleton-badge"]').classes()).toContain('rounded-full')
      expect(card.findAll('[data-testid="mobile-card-skeleton-footer"] > span')).toHaveLength(2)
    }
  })
})

describe('AppDataTable states — error', () => {
  beforeEach(() => { isBelowBreakpoint.value = false })

  it('renders EmptyState kind error with Reintentar and keeps the test ids', async () => {
    const wrapper = mountTable({
      ...emptyList,
      error: true,
      errorMessage: 'No se pudo cargar la lista',
      emptyState,
      filtered: true,
    })
    const block = wrapper.get('[data-testid="table-error-state"]')
    expect(block.classes()).toContain('hf-empty-state')
    expect(block.attributes('role')).toBe('alert')
    expect(block.attributes('data-kind')).toBe('error')
    expect(block.get('.hf-empty-state__title').text()).toBe('No se pudo cargar la lista')
    const retry = block.get('[data-testid="table-error-retry"]')
    expect(retry.text()).toContain('Reintentar')
    await retry.trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('uses the fixed human title by default and never shows a server message', () => {
    const wrapper = mountTable({ ...emptyList, error: true })
    expect(wrapper.get('[data-testid="table-error-state"] .hf-empty-state__title').text()).toBe('No se pudo cargar la lista')

    isBelowBreakpoint.value = true
    const cards = mountTable({ ...emptyList, error: true, mobileRender: 'cards' })
    expect(cards.get('[data-testid="cards-error-state"] .hf-empty-state__title').text()).toBe('No se pudo cargar la lista')
  })

  it('lets a consumer pass a better title through errorMessage', () => {
    const wrapper = mountTable({ ...emptyList, error: true, errorMessage: 'No se pudieron cargar los productos' })
    expect(wrapper.get('[data-testid="table-error-state"] .hf-empty-state__title').text()).toBe('No se pudieron cargar los productos')
  })

  it('always offers Reintentar, with the default showRefresh and with it off', async () => {
    for (const props of [{}, { showRefresh: false }]) {
      const wrapper = mountTable({ ...emptyList, error: true, ...props })
      const retry = wrapper.get('[data-testid="table-error-retry"]')
      expect(retry.text()).toContain('Reintentar')
      await retry.trigger('click')
      expect(wrapper.emitted('refresh')).toHaveLength(1)
    }
  })

  it('renders the same error block in cards mode', async () => {
    isBelowBreakpoint.value = true
    const wrapper = mountTable({ ...emptyList, error: true, mobileRender: 'cards' })
    const block = wrapper.get('[data-testid="cards-error-state"]')
    expect(block.attributes('role')).toBe('alert')
    expect(block.attributes('data-kind')).toBe('error')
    await block.get('[data-testid="cards-error-retry"]').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
