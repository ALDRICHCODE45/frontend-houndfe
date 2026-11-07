/**
 * Premium tables T5: the «Columnas» panel (artboard 01). Three sections (Fijadas a la izquierda,
 * Columnas, Fijadas a la derecha) built on the layout v-models; rows pin, unpin, hide and reorder by
 * pointer drag or by keyboard on their grip, crossing sections pins and unpins, and «Restablecer
 * columnas» resets. Below md (card mode) a bottom sheet keeps only the visibility switches, which
 * also reach the card slot.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import AppDataTable from '../AppDataTable.vue'
import SortableHeader from '../SortableHeader.vue'
import { createSimpleHeader } from '../DataTableColumnHeader'
import { stepColumn } from '../columnArrange.utils'

const isMobile = ref(false)
vi.mock('@vueuse/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useBreakpoints: () => ({ smaller: () => isMobile }),
}))

type Row = { id: number; name: string; seller: string; status: string; total: number; channel: string }

const rows: Row[] = [{ id: 1, name: 'Alpha', seller: 'Ana', status: 'Pagada', total: 10, channel: 'Tienda' }]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sortable = (label: string) => ({ column }: { column: any }) => h(SortableHeader, { column, label })

const columns = [
  { id: 'select', header: '' },
  { accessorKey: 'name', header: sortable('Cliente') },
  { accessorKey: 'seller', header: 'Vendedor' },
  { accessorKey: 'status', header: createSimpleHeader('Estado') },
  { accessorKey: 'total', header: sortable('Total') },
  { accessorKey: 'channel', header: () => h('span', 'canal-x'), meta: { label: 'Canal' } },
  { id: 'actions', header: 'Acciones' },
]
const IDS = ['select', 'name', 'seller', 'status', 'total', 'channel', 'actions']

// The popover and the sheet render their content in place, so the panel is part of the mount.
const PopoverStub = defineComponent({
  name: 'PopoverProbe',
  props: ['open', 'content', 'ui'],
  template: '<div data-testid="columns-popover" :data-ui="ui?.content"><slot /><slot name="content" /></div>',
})
const SheetStub = defineComponent({
  name: 'SheetProbe',
  props: ['open', 'side', 'ui'],
  template: '<div data-testid="columns-sheet-root" :data-open="String(open)"><slot name="content" /></div>',
})
const MenuProbe = defineComponent({
  props: ['items', 'open', 'content', 'ui', 'modal'],
  template: '<div><slot /></div>',
})

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

function mountTable(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
  return mount(AppDataTable<Row>, {
    props: { columns: columns as never, data: rows, totalCount: 1, pageCount: 1, ...props },
    slots: slots as never,
    attachTo: document.body,
    global: {
      stubs: {
        DataTablePagination: true,
        DataTableBulkActions: true,
        UTooltip: { template: '<div><slot /></div>' },
        UPopover: PopoverStub,
        Popover: PopoverStub,
        USlideover: SheetStub,
        Slideover: SheetStub,
        UDropdownMenu: MenuProbe,
        DropdownMenu: MenuProbe,
      },
    },
  })
}

/** A table whose layout v-models are bound, so every change is applied like in a screen. */
function mountLive(props: Record<string, unknown> = {}) {
  const wrapper = mountTable({
    ...props,
    'onUpdate:columnOrder': (value: unknown) => wrapper.setProps({ columnOrder: value } as never),
    'onUpdate:columnPinning': (value: unknown) => wrapper.setProps({ columnPinning: value } as never),
    'onUpdate:columnVisibility': (value: unknown) => wrapper.setProps({ columnVisibility: value } as never),
  })
  return wrapper
}

type Wrapper = ReturnType<typeof mountTable>
const lastEmit = (wrapper: Wrapper, event: string) => wrapper.emitted(event)?.slice(-1)[0]?.[0]
const announcement = (wrapper: Wrapper) => wrapper.get('[data-testid="table-announcer"]').text()
const section = (wrapper: Wrapper, group: string) => wrapper.get(`[data-panel-section="${group}"]`)
const labels = (wrapper: Wrapper, group: string) =>
  section(wrapper, group)
    .findAll('[data-panel-label]')
    .map(label => label.text())
const byLabel = (wrapper: Wrapper, name: string) => wrapper.get(`[aria-label="${name}"]`)
const grip = (wrapper: Wrapper, id: string) => wrapper.get(`[data-panel-grip][data-column-id="${id}"]`)
const columnsButton = (wrapper: Wrapper) => wrapper.get('[data-testid="toolbar-columns-button"]')

async function key(wrapper: Wrapper, id: string, name: string) {
  grip(wrapper, id).element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
  await nextTick()
  await nextTick()
}

describe('«Columnas» panel sections', () => {
  it('lists the arrangeable columns in three sections that follow the pinning, order and visibility', () => {
    const wrapper = mountTable({
      columnPinning: { left: ['seller'], right: ['total'] },
      columnVisibility: { status: false },
    })
    expect(section(wrapper, 'left').get('h3').text()).toContain('Fijadas a la izquierda')
    expect(section(wrapper, 'center').get('h3').text()).toContain('Columnas')
    expect(section(wrapper, 'right').get('h3').text()).toContain('Fijadas a la derecha')
    expect(labels(wrapper, 'left')).toEqual(['Vendedor'])
    expect(labels(wrapper, 'center')).toEqual(['Cliente', 'Estado', 'Canal'])
    expect(labels(wrapper, 'right')).toEqual(['Total'])
    expect(byLabel(wrapper, 'Mostrar Estado').attributes('aria-checked')).toBe('false')
    expect(byLabel(wrapper, 'Mostrar Vendedor').attributes('aria-checked')).toBe('true')
    wrapper.unmount()
  })

  it('follows the column order inside the centre section', () => {
    const wrapper = mountTable({ columnOrder: ['select', 'total', 'name', 'seller', 'status', 'channel', 'actions'] })
    expect(labels(wrapper, 'center')).toEqual(['Total', 'Cliente', 'Vendedor', 'Estado', 'Canal'])
    wrapper.unmount()
  })

  it('shows a drop hint in an empty pinned section', () => {
    const wrapper = mountTable()
    expect(labels(wrapper, 'left')).toEqual([])
    expect(section(wrapper, 'left').text()).toContain('Arrastra aquí')
    expect(section(wrapper, 'right').text()).toContain('Arrastra aquí')
    wrapper.unmount()
  })

  it('never lists the locked selection and Acciones columns', () => {
    const wrapper = mountTable()
    const all = ['left', 'center', 'right'].flatMap(group => labels(wrapper, group))
    expect(all).toEqual(['Cliente', 'Vendedor', 'Estado', 'Total', 'Canal'])
    expect(wrapper.find('[data-panel-row][data-column-id="select"]').exists()).toBe(false)
    expect(wrapper.find('[data-panel-row][data-column-id="actions"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('names rows with the column label, never the id', () => {
    const wrapper = mountTable()
    const all = ['left', 'center', 'right'].flatMap(group => labels(wrapper, group))
    for (const label of all) expect(IDS).not.toContain(label)
    expect(all).toContain('Canal')
    expect(grip(wrapper, 'channel').attributes('aria-label')).toContain('Canal')
    wrapper.unmount()
  })

  it('opens on a themed popover root', () => {
    const wrapper = mountTable()
    expect(wrapper.get('[data-testid="columns-popover"]').attributes('data-ui')).toContain('hf-theme hf-ui')
    wrapper.unmount()
  })
})

describe('pin buttons', () => {
  it('pins left after the selection column and right before Acciones, and announces it', async () => {
    const wrapper = mountTable()
    await byLabel(wrapper, 'Fijar Estado a la izquierda').trigger('click')
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select', 'status'], right: ['actions'] })
    expect(announcement(wrapper)).toBe('Columna Estado fijada a la izquierda')
    // Unbound v-models keep the change locally, so the next pin builds on it.
    await byLabel(wrapper, 'Fijar Cliente a la derecha').trigger('click')
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select', 'status'], right: ['name', 'actions'] })
    expect(announcement(wrapper)).toBe('Columna Cliente fijada a la derecha')
    wrapper.unmount()
  })

  it('turns the pressed side into «Desfijar» and unpins', async () => {
    const wrapper = mountTable({ columnPinning: { left: ['seller'], right: [] } })
    const unpin = byLabel(wrapper, 'Desfijar Vendedor')
    expect(unpin.attributes('aria-pressed')).toBe('true')
    expect(byLabel(wrapper, 'Fijar Vendedor a la derecha').attributes('aria-pressed')).toBe('false')
    await unpin.trigger('click')
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select'], right: ['actions'] })
    expect(announcement(wrapper)).toBe('Columna Vendedor desfijada')
    wrapper.unmount()
  })
})

describe('visibility switches', () => {
  it('hides and shows a column and announces it', async () => {
    const wrapper = mountTable({ columnVisibility: { status: false } })
    await byLabel(wrapper, 'Mostrar Vendedor').trigger('click')
    expect(lastEmit(wrapper, 'update:columnVisibility')).toEqual({ status: false, seller: false })
    expect(announcement(wrapper)).toBe('Columna Vendedor oculta')
    await byLabel(wrapper, 'Mostrar Estado').trigger('click')
    expect(lastEmit(wrapper, 'update:columnVisibility')).toEqual({ status: true, seller: false })
    expect(announcement(wrapper)).toBe('Columna Estado visible')
    wrapper.unmount()
  })

  it('keeps the primary column visible', async () => {
    const wrapper = mountTable()
    const primary = byLabel(wrapper, 'Mostrar Cliente')
    expect(primary.attributes('disabled')).toBeDefined()
    await primary.trigger('click')
    expect(wrapper.emitted('update:columnVisibility')).toBeUndefined()
    wrapper.unmount()
  })
})

// ── Pointer drag ────────────────────────────────────────────────────────────
// jsdom has no layout: the panel lists stack from y = 0, 44px per row (an empty list keeps one row
// of height for its hint) and 40px between sections.
const ROW = 44
const GAP = 40
function mockPanelLayout() {
  const rect = (top: number, height: number) =>
    ({ left: 0, right: 360, width: 360, top, bottom: top + height, height, x: 0, y: top, toJSON() {} }) as DOMRect
  const layout = () => {
    const boxes = new Map<Element, DOMRect>()
    let y = 0
    for (const list of Array.from(document.querySelectorAll('[data-panel-list]'))) {
      const items = Array.from(list.querySelectorAll('[data-panel-row]'))
      const height = Math.max(1, items.length) * ROW
      boxes.set(list, rect(y, height))
      items.forEach((item, index) => boxes.set(item, rect(y + index * ROW, ROW)))
      y += height + GAP
    }
    const body = document.querySelector('[data-panel-body]')
    if (body) boxes.set(body, rect(0, y))
    return boxes
  }
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return layout().get(this) ?? rect(0, 0)
  })
  return layout
}

function pointer(type: string, y: number, init: { pointerType?: string } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 100, clientY: y })
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'mouse' })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

async function dragRow(wrapper: Wrapper, id: string, to: number, finish = true) {
  const from = (grip(wrapper, id).element.closest('[data-panel-row]') as HTMLElement).getBoundingClientRect().top + 10
  grip(wrapper, id).element.dispatchEvent(pointer('pointerdown', from))
  window.dispatchEvent(pointer('pointermove', from + (to > from ? 8 : -8)))
  window.dispatchEvent(pointer('pointermove', to))
  await nextTick()
  if (finish) {
    window.dispatchEvent(pointer('pointerup', to))
    await nextTick()
  }
}

describe('panel drag', () => {
  beforeEach(mockPanelLayout)

  it('reorders within the centre section with a drop guide while dragging', async () => {
    const wrapper = mountTable()
    // Lists: left 0–44 (empty), centre 84–304 (Cliente 84, Vendedor 128, …, Canal 260), right 344–388.
    // Canal dropped on the top half of Vendedor lands before it.
    await dragRow(wrapper, 'channel', 135, false)
    expect(wrapper.get('[data-testid="columns-drop-guide"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-panel-row][data-column-id="channel"]').classes()).toContain('hf-columns-row--lifting')
    window.dispatchEvent(pointer('pointerup', 135))
    await nextTick()
    expect(wrapper.find('[data-testid="columns-drop-guide"]').exists()).toBe(false)
    expect(lastEmit(wrapper, 'update:columnOrder')).toEqual([
      'select',
      'name',
      'channel',
      'seller',
      'status',
      'total',
      'actions',
    ])
    expect(announcement(wrapper)).toBe('Columna Canal movida a la posición 2 de 5')
    wrapper.unmount()
  })

  it('pins a row dropped into an empty pinned section, highlighting it while dragging', async () => {
    const wrapper = mountTable()
    await dragRow(wrapper, 'status', 20, false)
    expect(section(wrapper, 'left').get('[data-panel-list]').classes()).toContain('hf-columns-list--drop')
    window.dispatchEvent(pointer('pointerup', 20))
    await nextTick()
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select', 'status'], right: ['actions'] })
    expect(announcement(wrapper)).toBe('Columna Estado fijada a la izquierda')
    wrapper.unmount()
  })

  it('unpins a pinned row dropped among the centre rows', async () => {
    const wrapper = mountTable({ columnPinning: { left: [], right: ['total'] } })
    // Centre 84–260: Cliente 84, Vendedor 128, Estado 172, Canal 216. Total dropped low on Vendedor.
    await dragRow(wrapper, 'total', 160)
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select'], right: ['actions'] })
    expect(lastEmit(wrapper, 'update:columnOrder')).toEqual([
      'select',
      'name',
      'seller',
      'total',
      'status',
      'channel',
      'actions',
    ])
    expect(announcement(wrapper)).toBe('Columna Total desfijada')
    wrapper.unmount()
  })

  it('cancels with Esc and ignores touch', async () => {
    const wrapper = mountTable()
    await dragRow(wrapper, 'channel', 135, false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()
    window.dispatchEvent(pointer('pointerup', 135))
    await nextTick()
    expect(wrapper.emitted('update:columnOrder')).toBeUndefined()

    grip(wrapper, 'channel').element.dispatchEvent(pointer('pointerdown', 270, { pointerType: 'touch' }))
    window.dispatchEvent(pointer('pointermove', 135, { pointerType: 'touch' }))
    window.dispatchEvent(pointer('pointerup', 135, { pointerType: 'touch' }))
    await nextTick()
    expect(wrapper.emitted('update:columnOrder')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('panel keyboard', () => {
  it('moves a row up and down inside its section from the grip', async () => {
    const wrapper = mountTable()
    await key(wrapper, 'seller', 'ArrowUp')
    expect(lastEmit(wrapper, 'update:columnOrder')).toEqual(['select', 'seller', 'name', 'status', 'total', 'channel', 'actions'])
    expect(announcement(wrapper)).toBe('Columna Vendedor movida a la posición 1 de 5')
    await key(wrapper, 'status', 'ArrowDown')
    expect(lastEmit(wrapper, 'update:columnOrder')).toEqual(['select', 'seller', 'name', 'total', 'status', 'channel', 'actions'])
    expect(announcement(wrapper)).toBe('Columna Estado movida a la posición 4 de 5')
    wrapper.unmount()
  })

  it('pins and unpins when a move crosses a section', async () => {
    const wrapper = mountTable()
    await key(wrapper, 'name', 'ArrowUp')
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select', 'name'], right: ['actions'] })
    expect(announcement(wrapper)).toBe('Columna Cliente fijada a la izquierda')
    await key(wrapper, 'channel', 'ArrowDown')
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select', 'name'], right: ['channel', 'actions'] })
    expect(announcement(wrapper)).toBe('Columna Canal fijada a la derecha')
    wrapper.unmount()
  })

  it('unpins a pinned row moved back into the centre and keeps the focus on its grip', async () => {
    const wrapper = mountLive({ columnPinning: { left: ['seller'], right: [] } })
    ;(grip(wrapper, 'seller').element as HTMLElement).focus()
    await key(wrapper, 'seller', 'ArrowDown')
    expect(labels(wrapper, 'left')).toEqual([])
    expect(labels(wrapper, 'center')[0]).toBe('Vendedor')
    expect(announcement(wrapper)).toBe('Columna Vendedor desfijada')
    expect((document.activeElement as HTMLElement | null)?.dataset.columnId).toBe('seller')
    wrapper.unmount()
  })

  it('announces the edges without moving', async () => {
    const wrapper = mountTable({ columnPinning: { left: ['name'], right: ['total'] } })
    await key(wrapper, 'name', 'ArrowUp')
    expect(announcement(wrapper)).toBe('Columna Cliente ya es la primera')
    await key(wrapper, 'total', 'ArrowDown')
    expect(announcement(wrapper)).toBe('Columna Total ya es la última')
    expect(wrapper.emitted('update:columnPinning')).toBeUndefined()
    expect(wrapper.emitted('update:columnOrder')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('stepColumn', () => {
  const all = () => true
  const arrangement = { order: IDS, pinning: { left: ['select'], right: ['actions'] } }

  it('steps inside the group and crosses into the next group at its edge', () => {
    expect(stepColumn(arrangement, 'seller', -1, all)?.order).toEqual(['select', 'seller', 'name', 'status', 'total', 'channel', 'actions'])
    expect(stepColumn(arrangement, 'name', -1, all)?.pinning).toEqual({ left: ['select', 'name'], right: ['actions'] })
    expect(stepColumn(arrangement, 'channel', 1, all)?.pinning).toEqual({ left: ['select'], right: ['channel', 'actions'] })
  })

  it('stops at the outer edges', () => {
    const pinned = { order: IDS, pinning: { left: ['select', 'name'], right: ['total', 'actions'] } }
    expect(stepColumn(pinned, 'name', -1, all)).toBeUndefined()
    expect(stepColumn(pinned, 'total', 1, all)).toBeUndefined()
  })
})

describe('«Restablecer columnas»', () => {
  it('calls the consumer reset (the persisted layout reset) and announces it', async () => {
    const onResetColumns = vi.fn()
    const wrapper = mountTable({ onResetColumns, columnPinning: { left: ['seller'], right: [] } })
    await wrapper.findAll('button').find(button => button.text() === 'Restablecer columnas')!.trigger('click')
    expect(onResetColumns).toHaveBeenCalledOnce()
    expect(wrapper.emitted('update:columnPinning')).toBeUndefined()
    expect(announcement(wrapper)).toBe('Columnas restablecidas')
    wrapper.unmount()
  })

  it('clears order, pinning, visibility and widths without a consumer reset', async () => {
    const wrapper = mountTable({
      columnPinning: { left: ['seller'], right: [] },
      columnOrder: ['select', 'total', 'name', 'seller', 'status', 'channel', 'actions'],
      columnVisibility: { status: false },
      columnSizing: { total: 200 },
    })
    await wrapper.findAll('button').find(button => button.text() === 'Restablecer columnas')!.trigger('click')
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select'], right: ['actions'] })
    expect(lastEmit(wrapper, 'update:columnOrder')).toEqual(IDS)
    expect(lastEmit(wrapper, 'update:columnVisibility')).toEqual({})
    expect(lastEmit(wrapper, 'update:columnSizing')).toEqual({})
    expect(announcement(wrapper)).toBe('Columnas restablecidas')
    wrapper.unmount()
  })
})

describe('«Columnas» button', () => {
  it('shows by default whenever there are arrangeable columns, and can still be turned off', () => {
    const shown = mountTable()
    expect(shown.find('[data-testid="toolbar-columns-button"]').exists()).toBe(true)
    shown.unmount()
    const off = mountTable({ enableColumnVisibility: false })
    expect(off.find('[data-testid="toolbar-columns-button"]').exists()).toBe(false)
    off.unmount()
    const locked = mountTable({ columns: [columns[0], columns[6]] })
    expect(locked.find('[data-testid="toolbar-columns-button"]').exists()).toBe(false)
    locked.unmount()
  })

  it('counts the hidden columns in a badge and in its name', () => {
    const none = mountTable()
    expect(columnsButton(none).attributes('aria-label')).toBe('Columnas')
    expect(none.find('[data-testid="toolbar-columns-badge"]').exists()).toBe(false)
    none.unmount()
    const one = mountTable({ columnVisibility: { seller: false } })
    expect(columnsButton(one).attributes('aria-label')).toBe('Columnas · 1 oculta')
    one.unmount()
    const two = mountTable({ columnVisibility: { seller: false, status: false } })
    expect(columnsButton(two).attributes('aria-label')).toBe('Columnas · 2 ocultas')
    expect(two.get('[data-testid="toolbar-columns-badge"]').text()).toBe('2')
    two.unmount()
  })
})

describe('mobile «Columnas» sheet', () => {
  beforeEach(() => {
    isMobile.value = true
  })

  const cardSlot = {
    'mobile-card': ({ row, isColumnVisible }: { row: Row; isColumnVisible: (id: string) => boolean }) =>
      h('article', { 'data-testid': 'card' }, [row.name, isColumnVisible('seller') ? ` · ${row.seller}` : '']),
  }

  it('opens a sheet with only the visibility switches', async () => {
    const wrapper = mountTable({ mobileRender: 'cards' }, cardSlot)
    await wrapper.get('[data-testid="toolbar-mobile-columns-button"]').trigger('click')
    const sheet = wrapper.get('[data-testid="columns-sheet"]')
    expect(sheet.findAll('[role="switch"]').map(item => item.attributes('aria-label'))).toEqual([
      'Mostrar Cliente en la tarjeta',
      'Mostrar Vendedor en la tarjeta',
      'Mostrar Estado en la tarjeta',
      'Mostrar Total en la tarjeta',
      'Mostrar Canal en la tarjeta',
    ])
    expect(sheet.find('[data-panel-grip]').exists()).toBe(false)
    expect(sheet.findAll('[aria-label^="Fijar"]')).toHaveLength(0)
    expect(wrapper.find('[data-panel-section]').exists()).toBe(false)
    expect(sheet.text()).toContain('Siempre visible')
    wrapper.unmount()
  })

  it('drives the card fields through the slot visibility helpers', async () => {
    const wrapper = mountTable({ mobileRender: 'cards' }, cardSlot)
    expect(wrapper.get('[data-testid="card"]').text()).toBe('Alpha · Ana')
    await wrapper.get('[aria-label="Mostrar Vendedor en la tarjeta"]').trigger('click')
    expect(lastEmit(wrapper, 'update:columnVisibility')).toEqual({ seller: false })
    await wrapper.setProps({ columnVisibility: { seller: false } })
    expect(wrapper.get('[data-testid="card"]').text()).toBe('Alpha')
    wrapper.unmount()
  })

  it('counts hidden columns on the mobile button', () => {
    const wrapper = mountTable({ mobileRender: 'cards', columnVisibility: { seller: false, status: false } }, cardSlot)
    expect(wrapper.get('[data-testid="toolbar-mobile-columns-button"]').attributes('aria-label')).toBe(
      'Columnas · 2 ocultas',
    )
    wrapper.unmount()
  })
})
