/**
 * Premium tables T7 (S5): the totals row. Columns opt in with `meta.total`; the row is a sticky
 * `tfoot` aligned to the current order, widths and pinning, labelled with its scope: «Esta página»
 * (the rows shown), the selected rows, or «Total del filtro» when the screen passes server totals.
 * Never in card mode, while loading, empty or failed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import AppDataTable from '../AppDataTable.vue'

const isMobile = ref(false)
vi.mock('@vueuse/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useBreakpoints: () => ({ smaller: () => isMobile }),
}))

type Row = { id: string; name: string; status: string; totalCents: number; debtCents: number }

const rows: Row[] = [
  { id: 'a', name: 'Alpha', status: 'Pagada', totalCents: 10_050, debtCents: 0 },
  { id: 'b', name: 'Beta', status: 'Pendiente', totalCents: 20_000, debtCents: 5_025 },
  { id: 'c', name: 'Gamma', status: 'Pendiente', totalCents: 1_000, debtCents: 1_000 },
]
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
const right = { th: 'text-right', td: 'text-right' }

const columns = [
  { id: 'select', header: '' },
  {
    accessorKey: 'name',
    header: 'Nombre',
    meta: { total: { kind: 'count', label: (n: number) => `${n} ${n === 1 ? 'venta' : 'ventas'}` } },
  },
  { accessorKey: 'status', header: 'Estado' },
  {
    accessorKey: 'totalCents',
    header: 'Total',
    meta: { class: right, total: { kind: 'sum', value: (row: Row) => row.totalCents, format: money } },
  },
  {
    accessorKey: 'debtCents',
    header: 'Deuda',
    meta: { class: right, total: { kind: 'sum', value: (row: Row) => row.debtCents, format: money } },
  },
  { id: 'actions', header: 'Acciones', meta: { class: { th: 'w-16', td: 'w-16 text-right' } } },
]
const plainColumns = columns.map(column => ({ ...column, meta: { ...column.meta, total: undefined } }))

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  isMobile.value = false
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function mountTable(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(AppDataTable<Row>, {
    props: {
      columns: columns as never,
      data: rows,
      totalCount: 3,
      pageCount: 1,
      ...props,
    },
    slots,
    attachTo: document.body,
    global: {
      stubs: { DataTableToolbar: true, DataTablePagination: true, DataTableBulkActions: true },
    },
  })
}

type Wrapper = ReturnType<typeof mountTable>
const footer = (wrapper: Wrapper) => wrapper.find('tfoot')
const footCells = (wrapper: Wrapper) => wrapper.findAll('tfoot tr[data-slot="tr"] > th')
const headCells = (wrapper: Wrapper) => wrapper.findAll('thead tr:first-child > th')
const footCell = (wrapper: Wrapper, id: string) => wrapper.get(`tfoot th.hf-colid-${id}`)
const footTexts = (wrapper: Wrapper) => footCells(wrapper).map(cell => cell.text().replace(/\s+/g, ' ').trim())
const headTexts = (wrapper: Wrapper) => headCells(wrapper).map(cell => cell.text().trim())

describe('AppDataTable totals row', () => {
  it('is opt-in: no tfoot without a column total', () => {
    const wrapper = mountTable({ columns: plainColumns })
    expect(footer(wrapper).exists()).toBe(false)
  })

  it('sums the page rows and labels the count and the scope in the first arrangeable column', () => {
    const wrapper = mountTable()
    expect(footer(wrapper).exists()).toBe(true)
    expect(footCell(wrapper, 'name').text()).toContain('3 ventas')
    expect(wrapper.get('[data-testid="table-totals-scope"]').text()).toBe('Esta página')
    expect(footCell(wrapper, 'totalCents').text()).toContain('$310.50')
    expect(footCell(wrapper, 'debtCents').text()).toContain('$60.25')
    // A column without a total stays empty; the locked edges carry nothing.
    expect(footCell(wrapper, 'status').text()).toBe('')
    expect(footCell(wrapper, 'select').text()).toBe('')
    expect(footCell(wrapper, 'actions').text()).toBe('')
  })

  it('aligns one cell per visible column, with the column classes and width variable', () => {
    const wrapper = mountTable()
    expect(footCells(wrapper)).toHaveLength(headCells(wrapper).length)
    const total = footCell(wrapper, 'totalCents')
    expect(total.classes()).toContain('text-right')
    expect(total.attributes('style')).toContain('width: var(--hf-col-w-totalCents')
  })

  it('is a row with a row header: the label cell has scope="row", the others are cells', () => {
    const wrapper = mountTable()
    expect(footCell(wrapper, 'name').attributes('scope')).toBe('row')
    expect(footCell(wrapper, 'totalCents').attributes('role')).toBe('cell')
    expect(footCell(wrapper, 'totalCents').attributes('scope')).toBeUndefined()
  })

  it('follows the column order', async () => {
    const wrapper = mountTable({ columnOrder: ['select', 'debtCents', 'name', 'status', 'totalCents', 'actions'] })
    await nextTick()
    const ids = footCells(wrapper).map(cell => cell.classes().find(name => name.startsWith('hf-colid-')))
    expect(ids).toEqual([
      'hf-colid-select',
      'hf-colid-debtCents',
      'hf-colid-name',
      'hf-colid-status',
      'hf-colid-totalCents',
      'hf-colid-actions',
    ])
    expect(headTexts(wrapper)[1]).toContain('Deuda')
    // The label goes to the first arrangeable column without an amount of its own.
    expect(footCell(wrapper, 'debtCents').text()).toContain('$60.25')
    expect(footCell(wrapper, 'name').text()).toContain('3 ventas')
  })

  it('keeps pinned cells sticky with the same side and offset as their header', async () => {
    const wrapper = mountTable({ columnPinning: { left: ['select', 'name'], right: ['totalCents', 'actions'] } })
    await nextTick()
    for (const id of ['name', 'totalCents']) {
      const head = wrapper.get(`thead th.hf-colid-${id}`)
      const foot = footCell(wrapper, id)
      expect(foot.attributes('data-pinned')).toBe(head.attributes('data-pinned'))
      expect(foot.attributes('style')).toBe(head.attributes('style'))
    }
    expect(footCell(wrapper, 'name').attributes('data-pinned')).toBe('left')
    expect(footCell(wrapper, 'totalCents').attributes('data-pinned')).toBe('right')
  })

  it('drops a hidden column total with its column, and puts the label in the first column without an amount', async () => {
    const wrapper = mountTable({ columnVisibility: { debtCents: false } })
    await nextTick()
    expect(wrapper.find('tfoot th.hf-colid-debtCents').exists()).toBe(false)
    expect(footTexts(wrapper).join(' ')).not.toContain('$60.25')
    expect(footCells(wrapper)).toHaveLength(headCells(wrapper).length)

    // With the label column out of the way the label moves to the next arrangeable column.
    await wrapper.setProps({ columnVisibility: {}, columnOrder: ['select', 'totalCents', 'status', 'name', 'debtCents', 'actions'] })
    expect(footCell(wrapper, 'status').text()).toContain('3 ventas')
    expect(footCell(wrapper, 'name').text()).toBe('')
  })

  it('switches to the selected rows, labelled with the selection', async () => {
    const wrapper = mountTable({ enableRowSelection: true, rowSelection: { 1: true, 2: true } })
    await nextTick()
    expect(footCell(wrapper, 'name').text()).toContain('2 seleccionados')
    expect(wrapper.get('[data-testid="table-totals-scope"]').text()).toBe('Selección')
    expect(footCell(wrapper, 'totalCents').text()).toContain('$210.00')
    expect(footCell(wrapper, 'debtCents').text()).toContain('$60.25')

    await wrapper.setProps({ rowSelection: {} })
    expect(footCell(wrapper, 'name').text()).toContain('3 ventas')
    expect(footCell(wrapper, 'totalCents').text()).toContain('$310.50')
  })

  it('names the selection with the table noun or the count total selected label', async () => {
    const wrapper = mountTable({
      enableRowSelection: true,
      rowSelection: { 0: true },
      selectedLabel: { one: 'seleccionada', other: 'seleccionadas' },
    })
    await nextTick()
    expect(footCell(wrapper, 'name').text()).toContain('1 seleccionada')

    const custom = columns.map(column =>
      column.accessorKey === 'name'
        ? { ...column, meta: { total: { kind: 'count', label: (n: number) => `${n} ventas`, selectedLabel: (n: number) => `Suma de ${n}` } } }
        : column,
    )
    await wrapper.setProps({ columns: custom as never })
    expect(footCell(wrapper, 'name').text()).toContain('Suma de 1')
  })

  it('shows server totals as «Total del filtro» instead of page sums', async () => {
    const wrapper = mountTable({ totals: { totalCents: 999_900, debtCents: 12_300 }, totalCount: 120 })
    await nextTick()
    expect(wrapper.get('[data-testid="table-totals-scope"]').text()).toBe('Total del filtro')
    expect(footCell(wrapper, 'name').text()).toContain('120 ventas')
    expect(footCell(wrapper, 'totalCents').text()).toContain('$9999.00')
    expect(footCell(wrapper, 'debtCents').text()).toContain('$123.00')
  })

  it('takes the count from the server totals when given and still lets a selection win', async () => {
    const wrapper = mountTable({
      totals: { name: 40, totalCents: 500 },
      totalCount: 120,
      enableRowSelection: true,
    })
    await nextTick()
    expect(footCell(wrapper, 'name').text()).toContain('40 ventas')
    // A server total missing for a column shows nothing rather than a page sum.
    expect(footCell(wrapper, 'debtCents').text()).toBe('')

    await wrapper.setProps({ rowSelection: { 0: true } })
    expect(wrapper.get('[data-testid="table-totals-scope"]').text()).toBe('Selección')
    expect(footCell(wrapper, 'totalCents').text()).toContain('$100.50')
  })

  it('renders a custom total text and passes the rows in scope', () => {
    const custom = columns.map(column =>
      column.accessorKey === 'status'
        ? { ...column, meta: { total: { kind: 'custom', compute: (list: Row[]) => `${list.filter(row => row.status === 'Pendiente').length} pendientes` } } }
        : column,
    )
    const wrapper = mountTable({ columns: custom })
    expect(footCell(wrapper, 'status').text()).toBe('2 pendientes')
  })

  it('is hidden while loading, when empty and on error', async () => {
    const wrapper = mountTable({ loading: true })
    expect(footer(wrapper).exists()).toBe(false)
    await wrapper.setProps({ loading: false, data: [] })
    expect(footer(wrapper).exists()).toBe(false)
    await wrapper.setProps({ data: rows, error: true })
    expect(footer(wrapper).exists()).toBe(false)
    await wrapper.setProps({ error: false })
    expect(footer(wrapper).exists()).toBe(true)
  })

  it('stays during a background refetch of rows already shown', () => {
    const wrapper = mountTable({ fetching: true })
    expect(footer(wrapper).exists()).toBe(true)
  })

  it('is not part of card mode', () => {
    const wrapper = mountTable(
      { displayMode: 'cards' },
      { 'mobile-card': '<article data-testid="card">{{ params.row.name }}</article>' },
    )
    expect(wrapper.findAll('[data-testid="card"]')).toHaveLength(3)
    expect(footer(wrapper).exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Esta página')
  })

  it('marks the row for the sticky footer styles', () => {
    const wrapper = mountTable()
    expect(wrapper.get('tfoot').classes()).toContain('hf-table-totals')
  })

  // The label may run over the empty footer cells that follow it (no colspan: every cell keeps its
  // column), up to the first cell with a value and never past its pinned group.
  describe('label overflow', () => {
    const span = (wrapper: Wrapper) =>
      (wrapper.get('[data-testid="table-totals-label"]').element as HTMLElement).style.getPropertyValue('--hf-totals-span')

    it('extends over the following empty cells up to the first amount', () => {
      const wrapper = mountTable()
      // name 256 + status 128 (empty); Total holds a value.
      expect(span(wrapper)).toBe('384px')
      expect(footCell(wrapper, 'name').attributes('data-hf-totals-label')).toBeDefined()
      expect(footCell(wrapper, 'status').attributes('data-hf-totals-label')).toBeUndefined()
    })

    it('stops at its own column when an amount follows it', async () => {
      const wrapper = mountTable({ columnOrder: ['select', 'name', 'totalCents', 'status', 'debtCents', 'actions'] })
      await nextTick()
      expect(span(wrapper)).toBe('256px')
    })

    it('never crosses the pinned edge', async () => {
      const wrapper = mountTable({ columnPinning: { left: ['select', 'name'], right: ['actions'] } })
      await nextTick()
      expect(span(wrapper)).toBe('256px')
      expect(footCell(wrapper, 'name').attributes('data-hf-totals-label')).toBe('pinned')
    })

    it('extends over empty cells inside its pinned group', async () => {
      const wrapper = mountTable({ columnPinning: { left: ['select', 'name', 'status'], right: ['actions'] } })
      await nextTick()
      expect(span(wrapper)).toBe('384px')
    })
  })
})
