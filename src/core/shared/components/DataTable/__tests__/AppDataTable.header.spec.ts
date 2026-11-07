/**
 * Premium tables T4: one header renderer for every arrangeable column — the header is the focus
 * target (Enter/Space sorts, Alt+←/→ resizes, Alt+Shift+←/→ moves, Shift+F10 opens ⋯), the ⋯ column
 * menu, drag reorder with a drop line (pin by drop, unpin by drop, Esc cancels) and the Spanish
 * announcements. Every change goes through the layout v-models, so it persists.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import AppDataTable from '../AppDataTable.vue'
import SortableHeader from '../SortableHeader.vue'
import { createSimpleHeader } from '../DataTableColumnHeader'

type Row = { id: number; name: string; seller: string; status: string; total: number }

const rows: Row[] = [
  { id: 1, name: 'Alpha', seller: 'Ana', status: 'Pagada', total: 10 },
  { id: 2, name: 'Beta', seller: 'Luis', status: 'Pendiente de pago', total: 20 },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sortable = (label: string) => ({ column }: { column: any }) => h(SortableHeader, { column, label })

const columns = [
  { id: 'select', header: '' },
  { accessorKey: 'name', header: sortable('Cliente') },
  { accessorKey: 'seller', header: 'Vendedor' },
  { accessorKey: 'status', header: createSimpleHeader('Estado') },
  { accessorKey: 'total', header: sortable('Total'), meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'actions', header: 'Acciones', meta: { class: { th: 'w-16', td: 'w-16' } } },
]

const WIDTHS: Record<string, number> = { select: 48, name: 256, seller: 128, status: 128, total: 128, actions: 64 }

type MenuItem = { label: string; disabled?: boolean; onSelect?: (event: Event) => void }

const MenuProbe = defineComponent({
  name: 'MenuProbe',
  props: ['items', 'open', 'content', 'ui', 'modal'],
  emits: ['update:open'],
  template: '<div data-testid="menu-probe" :data-open="open ? \'true\' : \'false\'"><slot /></div>',
})

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function mountTable(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(AppDataTable<Row>, {
    props: { columns: columns as never, data: rows, totalCount: 2, pageCount: 1, ...props },
    slots,
    attachTo: document.body,
    global: {
      stubs: {
        DataTableToolbar: true,
        DataTablePagination: true,
        DataTableBulkActions: true,
        UDropdownMenu: MenuProbe,
        DropdownMenu: MenuProbe,
      },
    },
  })
}

type Wrapper = ReturnType<typeof mountTable>
const lastEmit = (wrapper: Wrapper, event: string) => wrapper.emitted(event)?.slice(-1)[0]?.[0]
const header = (wrapper: Wrapper, id: string) => wrapper.get(`[data-hf-header][data-column-id="${id}"]`)
const headerIds = (wrapper: Wrapper) =>
  wrapper.findAll('[data-hf-header]').map(target => target.attributes('data-column-id'))
const announcement = (wrapper: Wrapper) => wrapper.get('[data-testid="table-announcer"]').text()
const menuFor = (wrapper: Wrapper, id: string) =>
  wrapper
    .findAllComponents(MenuProbe)
    .find(menu => menu.element.closest('th')?.querySelector(`[data-hf-header][data-column-id="${id}"]`))!
const menuItems = (wrapper: Wrapper, id: string) => (menuFor(wrapper, id).props('items') as MenuItem[][]).flat()
const menuLabels = (wrapper: Wrapper, id: string) => menuItems(wrapper, id).map(item => item.label)
const menuItem = (wrapper: Wrapper, id: string, label: string) =>
  menuItems(wrapper, id).find(item => item.label === label)!
async function choose(wrapper: Wrapper, id: string, label: string) {
  menuItem(wrapper, id, label).onSelect?.(new Event('select'))
  await nextTick()
}
async function press(wrapper: Wrapper, id: string, key: string, init: KeyboardEventInit = {}) {
  header(wrapper, id).element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
  await nextTick()
}

describe('header renderer', () => {
  it('gives every arrangeable column one focusable header, and none to the locked columns', () => {
    const wrapper = mountTable()
    expect(headerIds(wrapper)).toEqual(['name', 'seller', 'status', 'total'])
    for (const id of ['name', 'seller', 'status', 'total']) {
      const target = header(wrapper, id)
      expect(target.attributes('tabindex')).toBe('0')
      expect(target.attributes('role')).toBe('button')
      expect(target.attributes('aria-keyshortcuts')).toContain('Shift+F10')
    }
    wrapper.unmount()
  })

  it('floats a grip and a ⋯ button that are not extra tab stops', () => {
    const wrapper = mountTable()
    const th = header(wrapper, 'seller').element.closest('th')!
    expect(th.querySelector('[data-hf-grip]')?.getAttribute('aria-hidden')).toBe('true')
    const more = th.querySelector('[data-hf-header-menu]')!
    expect(more.getAttribute('aria-label')).toBe('Opciones de la columna Vendedor')
    expect(more.getAttribute('tabindex')).toBe('-1')
    expect(th.querySelector('[data-resize-handle]')?.getAttribute('tabindex')).toBe('-1')
    wrapper.unmount()
  })

  it('keeps the consumer header as the label: SortableHeader, string, createSimpleHeader and #<id>-header slots', () => {
    const wrapper = mountTable({}, { 'seller-header': '<b data-testid="custom-seller">Vendedor</b>' })
    expect(header(wrapper, 'name').text()).toBe('Cliente')
    expect(header(wrapper, 'seller').find('[data-testid="custom-seller"]').exists()).toBe(true)
    expect(header(wrapper, 'status').text()).toBe('Estado')
    expect(header(wrapper, 'total').text()).toBe('Total')
    // The header text is only the label: the grip, ⋯ and handle add none.
    expect(wrapper.findAll('thead th').map(th => th.text())).toEqual(['', 'Cliente', 'Vendedor', 'Estado', 'Total', 'Acciones'])
    // Inside the header the sort affordance is not a second button.
    expect(header(wrapper, 'name').find('button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('names the header with its pin and sort state', () => {
    const wrapper = mountTable({
      columnPinning: { left: ['name'], right: [] },
      sorting: [{ id: 'total', desc: true }],
    })
    expect(header(wrapper, 'name').attributes('aria-label')).toBe('Cliente, fijada a la izquierda')
    expect(header(wrapper, 'total').attributes('aria-label')).toBe('Total, orden descendente')
    wrapper.unmount()
  })

  it('has one polite live region for the announcements', () => {
    const wrapper = mountTable()
    const live = wrapper.get('[data-testid="table-announcer"]')
    expect(live.attributes('aria-live')).toBe('polite')
    expect(live.classes()).toContain('sr-only')
    wrapper.unmount()
  })
})

describe('⋯ column menu items', () => {
  it('offers sort, pin, move and width on a sortable primary column, never hiding it', async () => {
    const wrapper = mountTable()
    // SortableHeader registers its column once mounted.
    await nextTick()
    expect(menuLabels(wrapper, 'name')).toEqual([
      'Ordenar ascendente',
      'Ordenar descendente',
      'Fijar a la izquierda',
      'Fijar a la derecha',
      'Mover a la izquierda',
      'Mover a la derecha',
      'Ajustar ancho al contenido',
      'Restablecer ancho',
    ])
    expect(menuItem(wrapper, 'name', 'Mover a la izquierda').disabled).toBe(true)
    expect(menuItem(wrapper, 'name', 'Mover a la derecha').disabled).toBe(false)
    expect(menuItem(wrapper, 'name', 'Restablecer ancho').disabled).toBe(true)
    wrapper.unmount()
  })

  it('has no sort items on a column without sorting, and lets it hide', () => {
    const wrapper = mountTable()
    expect(menuLabels(wrapper, 'seller')).toEqual([
      'Fijar a la izquierda',
      'Fijar a la derecha',
      'Mover a la izquierda',
      'Mover a la derecha',
      'Ajustar ancho al contenido',
      'Restablecer ancho',
      'Ocultar columna',
    ])
    wrapper.unmount()
  })

  it('without a «Columnas» panel, never hides a column and offers «Restablecer columnas» instead', () => {
    for (const props of [{ showToolbar: false }, { enableColumnVisibility: false }]) {
      const wrapper = mountTable(props)
      const labels = menuLabels(wrapper, 'seller')
      expect(labels).not.toContain('Ocultar columna')
      expect(labels[labels.length - 1]).toBe('Restablecer columnas')
      wrapper.unmount()
    }
  })

  it('adds «Quitar orden» once the column is sorted and «Restablecer ancho» once it is sized', async () => {
    const wrapper = mountTable({ sorting: [{ id: 'total', desc: false }], columnSizing: { total: 200 } })
    // SortableHeader registers its column once mounted.
    await nextTick()
    expect(menuLabels(wrapper, 'total').slice(0, 3)).toEqual(['Ordenar ascendente', 'Ordenar descendente', 'Quitar orden'])
    expect(menuItem(wrapper, 'total', 'Restablecer ancho').disabled).toBe(false)
    expect(menuItem(wrapper, 'total', 'Mover a la derecha').disabled).toBe(true)
    wrapper.unmount()
  })

  it('offers «Desfijar» in place of the side the column is pinned to; moves stay inside the group', () => {
    const wrapper = mountTable({ columnPinning: { left: ['seller'], right: ['status'] } })
    expect(menuLabels(wrapper, 'seller').slice(0, 2)).toEqual(['Desfijar', 'Fijar a la derecha'])
    expect(menuLabels(wrapper, 'status').slice(0, 2)).toEqual(['Fijar a la izquierda', 'Desfijar'])
    expect(menuItem(wrapper, 'seller', 'Mover a la izquierda').disabled).toBe(true)
    expect(menuItem(wrapper, 'seller', 'Mover a la derecha').disabled).toBe(true)
    wrapper.unmount()
  })

  it('themes the menu content and gives items the 44px target', () => {
    const wrapper = mountTable()
    const ui = menuFor(wrapper, 'seller').props('ui') as Record<string, string>
    expect(ui.content).toContain('hf-theme hf-ui')
    expect(ui.item).toContain('min-h-11')
    wrapper.unmount()
  })
})

describe('⋯ column menu actions', () => {
  it('sorts ascending, descending and clears the sort', async () => {
    const wrapper = mountTable()
    // SortableHeader registers its column once mounted.
    await nextTick()
    await choose(wrapper, 'total', 'Ordenar descendente')
    expect(lastEmit(wrapper, 'update:sorting')).toEqual([{ id: 'total', desc: true }])
    await choose(wrapper, 'total', 'Ordenar ascendente')
    expect(lastEmit(wrapper, 'update:sorting')).toEqual([{ id: 'total', desc: false }])
    await wrapper.setProps({ sorting: [{ id: 'total', desc: false }] })
    await choose(wrapper, 'total', 'Quitar orden')
    expect(lastEmit(wrapper, 'update:sorting')).toEqual([])
    wrapper.unmount()
  })

  it('pins left after the selection column and right before Acciones, and announces it', async () => {
    const wrapper = mountTable()
    await choose(wrapper, 'status', 'Fijar a la izquierda')
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select', 'status'], right: ['actions'] })
    expect(announcement(wrapper)).toBe('Columna Estado fijada a la izquierda')

    await choose(wrapper, 'name', 'Fijar a la derecha')
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select', 'status'], right: ['name', 'actions'] })
    expect(announcement(wrapper)).toBe('Columna Cliente fijada a la derecha')
    wrapper.unmount()
  })

  it('unpins and announces it', async () => {
    const wrapper = mountTable({ columnPinning: { left: ['seller'], right: [] } })
    await choose(wrapper, 'seller', 'Desfijar')
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select'], right: ['actions'] })
    expect(announcement(wrapper)).toBe('Columna Vendedor desfijada')
    wrapper.unmount()
  })

  it('moves one position and announces the new position', async () => {
    const wrapper = mountTable()
    await choose(wrapper, 'seller', 'Mover a la derecha')
    expect(lastEmit(wrapper, 'update:columnOrder')).toEqual(['select', 'name', 'status', 'seller', 'total', 'actions'])
    expect(announcement(wrapper)).toBe('Columna Vendedor movida a la posición 3 de 4')
    wrapper.unmount()
  })

  it('fits the width to the content and resets it', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this.hasAttribute('data-hf-measure') ? (this.textContent?.trim().length ?? 0) * 10 : 0
      return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON() {} } as DOMRect
    })
    const wrapper = mountTable({ columnSizing: { status: 300 } })
    await choose(wrapper, 'status', 'Ajustar ancho al contenido')
    const fitted = (lastEmit(wrapper, 'update:columnSizing') as Record<string, number>).status!
    expect(fitted).toBeGreaterThanOrEqual(170)
    expect(announcement(wrapper)).toBe(`Ancho de Estado: ${fitted} px`)

    await choose(wrapper, 'status', 'Restablecer ancho')
    expect(lastEmit(wrapper, 'update:columnSizing')).toEqual({})
    expect(announcement(wrapper)).toBe('Ancho de Estado restablecido')
    wrapper.unmount()
  })

  it('hides a column and announces it', async () => {
    const wrapper = mountTable()
    await choose(wrapper, 'seller', 'Ocultar columna')
    expect(lastEmit(wrapper, 'update:columnVisibility')).toEqual({ seller: false })
    expect(announcement(wrapper)).toBe('Columna Vendedor oculta')
    wrapper.unmount()
  })

  it('returns the focus to the header when the menu closes', async () => {
    const wrapper = mountTable()
    const content = menuFor(wrapper, 'seller').props('content') as { onCloseAutoFocus: (event: Event) => void }
    const event = new Event('focus.autoFocusOnUnmount', { cancelable: true })
    content.onCloseAutoFocus(event)
    await nextTick()
    await nextTick()
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(header(wrapper, 'seller').element)
    wrapper.unmount()
  })
})

describe('header keyboard', () => {
  it('moves with Alt+Shift+arrows inside the group and keeps the focus on the header', async () => {
    const wrapper = mountTable()
    await press(wrapper, 'seller', 'ArrowRight', { altKey: true, shiftKey: true })
    expect(lastEmit(wrapper, 'update:columnOrder')).toEqual(['select', 'name', 'status', 'seller', 'total', 'actions'])
    expect(announcement(wrapper)).toBe('Columna Vendedor movida a la posición 3 de 4')
    expect(wrapper.emitted('update:columnSizing')).toBeUndefined()
    await nextTick()
    expect(document.activeElement).toBe(header(wrapper, 'seller').element)
    wrapper.unmount()
  })

  it('does not move past the edge of the group', async () => {
    const wrapper = mountTable()
    await press(wrapper, 'name', 'ArrowLeft', { altKey: true, shiftKey: true })
    expect(wrapper.emitted('update:columnOrder')).toBeUndefined()
    wrapper.unmount()
  })

  it('resizes with Alt+arrows from the header and announces the width', async () => {
    const wrapper = mountTable()
    await press(wrapper, 'status', 'ArrowRight', { altKey: true })
    expect(lastEmit(wrapper, 'update:columnSizing')).toEqual({ status: 144 })
    expect(announcement(wrapper)).toBe('Ancho de Estado: 144 px')
    wrapper.unmount()
  })

  it('opens the ⋯ menu with Shift+F10 and the menu key', async () => {
    const wrapper = mountTable()
    await press(wrapper, 'seller', 'F10', { shiftKey: true })
    expect(menuFor(wrapper, 'seller').props('open')).toBe(true)
    menuFor(wrapper, 'seller').vm.$emit('update:open', false)
    await nextTick()
    expect(menuFor(wrapper, 'seller').props('open')).toBe(false)
    await press(wrapper, 'status', 'ContextMenu')
    expect(menuFor(wrapper, 'status').props('open')).toBe(true)
    wrapper.unmount()
  })

  it('sorts with Enter and Space where the column sorts; elsewhere Enter opens the menu', async () => {
    const wrapper = mountTable()
    await press(wrapper, 'total', 'Enter')
    expect(lastEmit(wrapper, 'update:sorting')).toEqual([{ id: 'total', desc: false }])
    await press(wrapper, 'name', ' ')
    expect(lastEmit(wrapper, 'update:sorting')).toEqual([{ id: 'name', desc: false }])
    const sorts = wrapper.emitted('update:sorting')!.length
    await press(wrapper, 'seller', 'Enter')
    expect(wrapper.emitted('update:sorting')!.length).toBe(sorts)
    expect(menuFor(wrapper, 'seller').props('open')).toBe(true)
    wrapper.unmount()
  })

  it('sorts on a click on a sortable header', async () => {
    const wrapper = mountTable()
    await header(wrapper, 'total').trigger('click')
    expect(lastEmit(wrapper, 'update:sorting')).toEqual([{ id: 'total', desc: false }])
    wrapper.unmount()
  })
})

// ── Pointer drag ────────────────────────────────────────────────────────────
// jsdom has no layout: each header cell gets its column's width, laid out in DOM order from x = 0.
function mockLayout() {
  const rect = (left: number, width: number) =>
    ({ left, right: left + width, width, top: 0, bottom: 40, height: 40, x: left, y: 0, toJSON() {} }) as DOMRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.matches('th[data-slot="th"]')) {
      let left = 0
      for (const cell of Array.from(this.parentElement!.children) as HTMLElement[]) {
        const id = Array.from(cell.classList).find(name => name.startsWith('hf-colid-'))?.slice('hf-colid-'.length)
        const width = WIDTHS[id ?? ''] ?? 0
        if (cell === this) return rect(left, width)
        left += width
      }
    }
    if (this.matches('[data-testid="table-view"]')) return rect(0, 752)
    return rect(0, 0)
  })
}

function pointer(type: string, x: number, init: { pointerType?: string; button?: number } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: init.button ?? 0, clientX: x, clientY: 20 })
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'mouse' })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

async function drag(wrapper: Wrapper, id: string, from: number, to: number, finish = true) {
  header(wrapper, id).element.dispatchEvent(pointer('pointerdown', from))
  window.dispatchEvent(pointer('pointermove', from + (to > from ? 10 : -10)))
  window.dispatchEvent(pointer('pointermove', to))
  await nextTick()
  if (finish) {
    window.dispatchEvent(pointer('pointerup', to))
    await nextTick()
  }
}

describe('header drag', () => {
  beforeEach(mockLayout)

  it('shows a ghost and a drop line while dragging, then drops between the target columns', async () => {
    const wrapper = mountTable()
    // Vendedor (304–432) dragged past the middle of Total (560–688): it lands after Total.
    await drag(wrapper, 'seller', 350, 650, false)
    expect(wrapper.get('[data-testid="table-drag-ghost"]').text()).toBe('Vendedor')
    const line = wrapper.get('[data-testid="table-drop-line"]').element as HTMLElement
    expect(line.style.left).toBe('687px')
    window.dispatchEvent(pointer('pointerup', 650))
    await nextTick()
    expect(wrapper.find('[data-testid="table-drag-ghost"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-drop-line"]').exists()).toBe(false)
    expect(lastEmit(wrapper, 'update:columnOrder')).toEqual(['select', 'name', 'status', 'total', 'seller', 'actions'])
    expect(announcement(wrapper)).toBe('Columna Vendedor movida a la posición 4 de 4')
    wrapper.unmount()
  })

  it('does not sort on the click that ends a drag', async () => {
    const wrapper = mountTable()
    await drag(wrapper, 'total', 600, 100)
    header(wrapper, 'total').element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(wrapper.emitted('update:sorting')).toBeUndefined()
    wrapper.unmount()
  })

  it('pins a column dropped inside the left pinned group', async () => {
    const wrapper = mountTable({ columnPinning: { left: ['name'], right: [] } })
    // Screen: select 0–48, Cliente 48–304 (pinned), … Total dropped on the left half of Cliente.
    await drag(wrapper, 'total', 600, 100)
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select', 'total', 'name'], right: ['actions'] })
    expect(announcement(wrapper)).toBe('Columna Total fijada a la izquierda')
    wrapper.unmount()
  })

  it('pins on a drop over a locked edge column when the group is empty', async () => {
    const wrapper = mountTable()
    await drag(wrapper, 'status', 480, 20)
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select', 'status'], right: ['actions'] })
    await wrapper.setProps({ columnPinning: { left: ['select', 'status'], right: ['actions'] } })
    await drag(wrapper, 'seller', 350, 720)
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select', 'status'], right: ['seller', 'actions'] })
    expect(announcement(wrapper)).toBe('Columna Vendedor fijada a la derecha')
    wrapper.unmount()
  })

  it('unpins a pinned column dropped among the unpinned ones', async () => {
    const wrapper = mountTable({ columnPinning: { left: ['name'], right: [] } })
    // Screen: select, Cliente (pinned) 48–304, Vendedor 304–432, Estado 432–560, Total 560–688.
    await drag(wrapper, 'name', 100, 520)
    expect(lastEmit(wrapper, 'update:columnPinning')).toEqual({ left: ['select'], right: ['actions'] })
    expect(lastEmit(wrapper, 'update:columnOrder')).toEqual(['select', 'seller', 'status', 'name', 'total', 'actions'])
    expect(announcement(wrapper)).toBe('Columna Cliente desfijada')
    wrapper.unmount()
  })

  it('cancels with Esc', async () => {
    const wrapper = mountTable()
    await drag(wrapper, 'seller', 350, 650, false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()
    expect(wrapper.find('[data-testid="table-drag-ghost"]').exists()).toBe(false)
    window.dispatchEvent(pointer('pointerup', 650))
    await nextTick()
    expect(wrapper.emitted('update:columnOrder')).toBeUndefined()
    expect(announcement(wrapper)).toBe('Movimiento cancelado')
    wrapper.unmount()
  })

  it('never drags a locked column, from the resize handle, or a small jitter', async () => {
    const wrapper = mountTable()
    const ths = wrapper.findAll('thead th')
    ths[0]!.element.dispatchEvent(pointer('pointerdown', 20))
    window.dispatchEvent(pointer('pointermove', 400))
    await nextTick()
    expect(wrapper.find('[data-testid="table-drag-ghost"]').exists()).toBe(false)
    window.dispatchEvent(pointer('pointerup', 400))

    const handle = header(wrapper, 'seller').element.closest('th')!.querySelector('[data-resize-handle]')!
    handle.dispatchEvent(pointer('pointerdown', 430))
    window.dispatchEvent(pointer('pointermove', 650))
    await nextTick()
    expect(wrapper.find('[data-testid="table-drag-ghost"]').exists()).toBe(false)
    window.dispatchEvent(pointer('pointerup', 650))

    header(wrapper, 'seller').element.dispatchEvent(pointer('pointerdown', 350))
    window.dispatchEvent(pointer('pointermove', 352))
    await nextTick()
    expect(wrapper.find('[data-testid="table-drag-ghost"]').exists()).toBe(false)
    window.dispatchEvent(pointer('pointerup', 352))
    await nextTick()
    expect(wrapper.emitted('update:columnOrder')).toBeUndefined()
    expect(wrapper.emitted('update:columnPinning')).toBeUndefined()
    wrapper.unmount()
  })

  it('ignores touch pointers', async () => {
    const wrapper = mountTable()
    header(wrapper, 'seller').element.dispatchEvent(pointer('pointerdown', 350, { pointerType: 'touch' }))
    window.dispatchEvent(pointer('pointermove', 650, { pointerType: 'touch' }))
    await nextTick()
    expect(wrapper.find('[data-testid="table-drag-ghost"]').exists()).toBe(false)
    window.dispatchEvent(pointer('pointerup', 650, { pointerType: 'touch' }))
    await nextTick()
    expect(wrapper.emitted('update:columnOrder')).toBeUndefined()
    wrapper.unmount()
  })
})
