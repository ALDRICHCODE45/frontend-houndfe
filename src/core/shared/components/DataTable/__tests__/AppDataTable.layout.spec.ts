/**
 * Premium tables T3: user-set widths on a fixed layout, the resize handle (keyboard and autofit),
 * the pinned edge that shows only while scrolled, and the locked selection / Acciones columns.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AppDataTable from '../AppDataTable.vue'

type Row = { id: number; name: string; status: string; total: number }

const rows: Row[] = [
  { id: 1, name: 'Alpha', status: 'Pagada', total: 10 },
  { id: 2, name: 'Beta', status: 'Pendiente de pago', total: 20 },
]

const columns = [
  { id: 'select', header: '' },
  { accessorKey: 'name', header: 'Nombre' },
  { accessorKey: 'status', header: 'Estado', size: 180 },
  { accessorKey: 'total', header: 'Total', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'actions', header: 'Acciones', meta: { class: { th: 'w-16', td: 'w-16 text-right' } } },
]

let observers: Array<() => void> = []
class FakeResizeObserver {
  constructor(private callback: () => void) {}
  observe() {
    observers.push(this.callback)
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function mountTable(props: Record<string, unknown> = {}) {
  return mount(AppDataTable<Row>, {
    props: { columns: columns as never, data: rows, totalCount: 2, pageCount: 1, ...props },
    attachTo: document.body,
    global: {
      stubs: { DataTableToolbar: true, DataTablePagination: true, DataTableBulkActions: true },
    },
  })
}

type Wrapper = ReturnType<typeof mountTable>
const root = (wrapper: Wrapper) => wrapper.get('[data-testid="table-view"]')
const rootVar = (wrapper: Wrapper, name: string) =>
  (root(wrapper).element as HTMLElement).style.getPropertyValue(name)
const th = (wrapper: Wrapper, text: string) => wrapper.findAll('thead th').find(cell => cell.text() === text)!
const handle = (wrapper: Wrapper, label: string) =>
  wrapper.get(`[data-resize-handle][aria-label="Cambiar ancho de ${label}"]`)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (wrapper: Wrapper) => (wrapper.vm as any).tableApi
const lastEmit = (wrapper: Wrapper, event: string) => wrapper.emitted(event)?.slice(-1)[0]?.[0]

describe('AppDataTable widths', () => {
  it('sets a width variable per column and a fixed layout with an explicit total width', () => {
    const wrapper = mountTable()
    expect(rootVar(wrapper, '--hf-col-w-select')).toBe('48px')
    expect(rootVar(wrapper, '--hf-col-w-name')).toBe('256px')
    expect(rootVar(wrapper, '--hf-col-w-status')).toBe('180px')
    expect(rootVar(wrapper, '--hf-col-w-total')).toBe('128px')
    expect(rootVar(wrapper, '--hf-col-w-actions')).toBe('64px')
    expect(rootVar(wrapper, '--hf-table-w')).toBe(`${48 + 256 + 180 + 128 + 64}px`)
    const table = wrapper.get('table[data-slot="base"]')
    expect(table.classes()).toContain('table-fixed')
    wrapper.unmount()
  })

  it('applies the width to every header and body cell of the column', () => {
    const wrapper = mountTable()
    expect(th(wrapper, 'Estado').attributes('style')).toContain('width: var(--hf-col-w-status')
    const statusCells = wrapper.findAll('tbody td').filter(td => td.text().startsWith('Pend') || td.text() === 'Pagada')
    expect(statusCells).toHaveLength(2)
    for (const cell of statusCells) expect(cell.attributes('style')).toContain('width: var(--hf-col-w-status')
    wrapper.unmount()
  })

  it('uses the stored width over the default', () => {
    const wrapper = mountTable({ columnSizing: { total: 200 } })
    expect(rootVar(wrapper, '--hf-col-w-total')).toBe('200px')
    wrapper.unmount()
  })

  it('lets the name column take the free space of a wide surface', async () => {
    const wrapper = mountTable()
    await nextTick()
    Object.defineProperty(root(wrapper).element, 'clientWidth', { configurable: true, value: 1000 })
    observers.forEach(callback => callback())
    await nextTick()
    expect(rootVar(wrapper, '--hf-col-w-name')).toBe(`${256 + 1000 - 676}px`)
    expect(rootVar(wrapper, '--hf-table-w')).toBe('1000px')
    wrapper.unmount()
  })
})

// Before T3 a list always fit its card; default widths must still fit, and the horizontal scroll
// appears only once user widths or the minimum widths make it unavoidable.
describe('AppDataTable default widths fit the surface', () => {
  const eight = [
    { accessorKey: 'name', header: 'Nombre' },
    ...['a', 'b', 'c', 'd', 'e', 'f'].map(key => ({ accessorKey: key, header: key.toUpperCase() })),
    { id: 'actions', header: 'Acciones', meta: { class: { th: 'w-16', td: 'w-16' } } },
  ]
  const ids = ['name', 'a', 'b', 'c', 'd', 'e', 'f', 'actions']
  const width = (wrapper: Wrapper, id: string) => parseFloat(rootVar(wrapper, `--hf-col-w-${id}`))

  async function mountIn(surface: number, props: Record<string, unknown> = {}, rectWidth?: number) {
    const wrapper = mountTable({ columns: eight, ...props })
    await nextTick()
    const el = root(wrapper).element as HTMLElement
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: surface })
    if (rectWidth !== undefined) {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ width: rectWidth } as DOMRect)
    }
    observers.forEach(callback => callback())
    await nextTick()
    return wrapper
  }

  it('shrinks the unsized columns of 8 default columns into a 1022px surface with no overflow', async () => {
    const wrapper = await mountIn(1022)
    expect(rootVar(wrapper, '--hf-table-w')).toBe('1022px')
    expect(ids.reduce((sum, id) => sum + width(wrapper, id), 0)).toBe(1022)
    expect(width(wrapper, 'actions')).toBe(64)
    expect(width(wrapper, 'name')).toBeGreaterThanOrEqual(160)
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) expect(width(wrapper, id)).toBeGreaterThanOrEqual(96)
    wrapper.unmount()
  })

  it('keeps a user width exactly and shrinks only the others', async () => {
    const wrapper = await mountIn(1022, { columnSizing: { a: 300 } })
    expect(width(wrapper, 'a')).toBe(300)
    expect(rootVar(wrapper, '--hf-table-w')).toBe('1022px')
    wrapper.unmount()
  })

  it('scrolls only once the minimum widths cannot fit', async () => {
    const wrapper = await mountIn(600)
    expect(width(wrapper, 'name')).toBe(160)
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) expect(width(wrapper, id)).toBe(96)
    expect(rootVar(wrapper, '--hf-table-w')).toBe(`${160 + 6 * 96 + 64}px`)
    wrapper.unmount()
  })

  it('never overflows by a rounding pixel', async () => {
    // clientWidth rounds 1022.6 up to 1023; the table must use the 1022 that really fits.
    const wrapper = await mountIn(1023, {}, 1022.6)
    expect(rootVar(wrapper, '--hf-table-w')).toBe('1022px')
    wrapper.unmount()
  })
})

describe('AppDataTable resize handle', () => {
  it('renders an accessible handle on resizable headers only', () => {
    const wrapper = mountTable()
    const status = handle(wrapper, 'Estado')
    expect(status.attributes('role')).toBe('separator')
    expect(status.attributes('aria-orientation')).toBe('vertical')
    expect(status.attributes('aria-valuenow')).toBe('180')
    expect(th(wrapper, 'Acciones').find('[data-resize-handle]').exists()).toBe(false)
    expect(wrapper.findAll('thead th')[0]!.find('[data-resize-handle]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('resizes by 16px with Alt+arrows from the focused header', async () => {
    const wrapper = mountTable()
    await handle(wrapper, 'Estado').trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(lastEmit(wrapper, 'update:columnSizing')).toEqual({ status: 196 })
    await wrapper.setProps({ columnSizing: { status: 196 } })
    await handle(wrapper, 'Estado').trigger('keydown', { key: 'ArrowLeft', altKey: true })
    expect(lastEmit(wrapper, 'update:columnSizing')).toEqual({ status: 180 })
    wrapper.unmount()
  })

  it('reacts to Alt+arrows from any focusable element in the header', async () => {
    const wrapper = mountTable({
      columns: [
        { accessorKey: 'name', header: () => 'Nombre' },
        { accessorKey: 'status', header: 'Estado', size: 180 },
      ],
    })
    const button = document.createElement('button')
    th(wrapper, 'Estado').element.prepend(button)
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }))
    await nextTick()
    expect(lastEmit(wrapper, 'update:columnSizing')).toEqual({ status: 196 })
    wrapper.unmount()
  })

  it('leaves Alt+Shift+arrows (reorder) alone and clamps at the minimum', async () => {
    const wrapper = mountTable({ columnSizing: { total: 80 } })
    await handle(wrapper, 'Total').trigger('keydown', { key: 'ArrowLeft', altKey: true, shiftKey: true })
    expect(wrapper.emitted('update:columnSizing')).toBeUndefined()
    await handle(wrapper, 'Total').trigger('keydown', { key: 'ArrowLeft', altKey: true })
    expect(lastEmit(wrapper, 'update:columnSizing')).toEqual({ total: 80 })
    wrapper.unmount()
  })

  it('autofits to the widest rendered cell on double-click', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this.hasAttribute('data-hf-measure') ? (this.textContent?.trim().length ?? 0) * 10 : 0
      return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON() {} } as DOMRect
    })
    const wrapper = mountTable()
    await handle(wrapper, 'Estado').trigger('dblclick')
    // «Pendiente de pago» is the widest cell: 17 characters × 10px, plus the cell's own padding.
    const cell = wrapper.findAll('tbody td').find(td => td.text() === 'Pendiente de pago')!.element
    const style = getComputedStyle(cell)
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
    expect(lastEmit(wrapper, 'update:columnSizing')).toEqual({ status: Math.ceil(170 + padding) })
    expect(wrapper.find('[data-hf-measure]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('AppDataTable locked columns', () => {
  it('pins the selection column left and Acciones right by default', () => {
    const wrapper = mountTable()
    expect(wrapper.findAll('thead th')[0]!.attributes('data-pinned')).toBe('left')
    expect(th(wrapper, 'Acciones').attributes('data-pinned')).toBe('right')
    wrapper.unmount()
  })

  it('cannot unpin, move or resize them', async () => {
    const wrapper = mountTable()
    api(wrapper).getColumn('select').pin(false)
    api(wrapper).getColumn('actions').pin('left')
    await nextTick()
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select'], right: ['actions'] })

    api(wrapper).setColumnOrder(['actions', 'total', 'select', 'name', 'status'])
    await nextTick()
    expect(lastEmit(wrapper, 'update:columnOrder')).toEqual(['select', 'total', 'name', 'status', 'actions'])

    api(wrapper).setColumnSizing({ select: 120, actions: 120 })
    await nextTick()
    expect(lastEmit(wrapper, 'update:columnSizing')).toEqual({})
    wrapper.unmount()
  })

  it('accepts acciones as the actions id', () => {
    const wrapper = mountTable({
      columns: [
        { accessorKey: 'name', header: 'Nombre' },
        { id: 'acciones', header: 'Acciones', meta: { class: { th: 'w-16', td: 'w-16' } } },
      ],
    })
    expect(th(wrapper, 'Acciones').attributes('data-pinned')).toBe('right')
    expect(rootVar(wrapper, '--hf-col-w-acciones')).toBe('64px')
    wrapper.unmount()
  })

  it('honours a declared size on the Acciones column and keeps it locked', async () => {
    const wrapper = mountTable({
      columns: [
        { accessorKey: 'name', header: 'Nombre' },
        { accessorKey: 'status', header: 'Estado' },
        { id: 'actions', header: 'Acciones', size: 112 },
      ],
    })
    expect(rootVar(wrapper, '--hf-col-w-actions')).toBe('112px')
    expect(th(wrapper, 'Acciones').attributes('data-pinned')).toBe('right')
    expect(th(wrapper, 'Acciones').find('[data-resize-handle]').exists()).toBe(false)

    api(wrapper).setColumnOrder(['actions', 'name', 'status'])
    await nextTick()
    expect(lastEmit(wrapper, 'update:columnOrder')).toEqual(['name', 'status', 'actions'])
    api(wrapper).setColumnSizing({ actions: 200 })
    await nextTick()
    expect(lastEmit(wrapper, 'update:columnSizing')).toEqual({})
    wrapper.unmount()
  })

  it('keeps a user pin next to the locked one', () => {
    const wrapper = mountTable({ columnPinning: { left: ['name'], right: [] } })
    const headers = wrapper.findAll('thead th').map(cell => [cell.text(), cell.attributes('data-pinned')])
    expect(headers[0]).toEqual(['', 'left'])
    expect(headers[1]).toEqual(['Nombre', 'left'])
    wrapper.unmount()
  })
})

describe('AppDataTable pinned edge', () => {
  it('marks only the last left-pinned and the first right-pinned columns as edges', () => {
    const wrapper = mountTable({ columnPinning: { left: ['name'], right: ['total'] } })
    const edgeLeft = wrapper.findAll('thead th.hf-pin-edge-left').map(cell => cell.text())
    const edgeRight = wrapper.findAll('thead th.hf-pin-edge-right').map(cell => cell.text())
    expect(edgeLeft).toEqual(['Nombre'])
    expect(edgeRight).toEqual(['Total'])
    expect(wrapper.findAll('tbody td.hf-pin-edge-left')).toHaveLength(2)
    wrapper.unmount()
  })

  it('shows each edge only while content is scrolled under it', async () => {
    const wrapper = mountTable()
    await nextTick()
    const el = root(wrapper).element as HTMLElement
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 1200 })
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 600 })

    el.scrollLeft = 0
    el.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(root(wrapper).classes()).not.toContain('hf-table-scrolled-left')
    expect(root(wrapper).classes()).toContain('hf-table-scrolled-right')

    el.scrollLeft = 200
    el.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(root(wrapper).classes()).toContain('hf-table-scrolled-left')
    expect(root(wrapper).classes()).toContain('hf-table-scrolled-right')

    el.scrollLeft = 600
    el.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(root(wrapper).classes()).toContain('hf-table-scrolled-left')
    expect(root(wrapper).classes()).not.toContain('hf-table-scrolled-right')
    wrapper.unmount()
  })
})

describe('AppDataTable density', () => {
  it('exposes the density on the table, comfortable by default', async () => {
    const wrapper = mountTable()
    expect(root(wrapper).attributes('data-density')).toBe('comfortable')
    await wrapper.setProps({ density: 'compact' })
    expect(root(wrapper).attributes('data-density')).toBe('compact')
    wrapper.unmount()
  })
})
