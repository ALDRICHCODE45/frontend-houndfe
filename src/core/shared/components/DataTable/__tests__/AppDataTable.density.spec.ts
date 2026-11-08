/**
 * Premium tables T6: the density control in the toolbar (desktop table only) drives the `density`
 * v-model and the rows; a user layout change on a persisted table confirms «Guardado en tu vista»,
 * never the first load, a reset or a layout the screen sets itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import AppDataTable from '../AppDataTable.vue'
import DataTableColumnsPanel from '../DataTableColumnsPanel.vue'

const isMobile = ref(false)
vi.mock('@vueuse/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useBreakpoints: () => ({ smaller: () => isMobile }),
}))

type Row = { id: number; name: string; status: string }
const rows: Row[] = [{ id: 1, name: 'Alpha', status: 'Pagada' }]
const columns = [
  { id: 'select', header: '' },
  { accessorKey: 'name', header: 'Nombre' },
  { accessorKey: 'status', header: 'Estado' },
  { id: 'actions', header: 'Acciones' },
]

const PopoverStub = defineComponent({
  props: ['open', 'content', 'ui'],
  template: '<div><slot /><slot name="content" /></div>',
})
const SheetStub = defineComponent({
  props: ['open', 'side', 'ui'],
  template: '<div><slot name="content" /></div>',
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function mountTable(props: Record<string, unknown> = {}) {
  return mount(AppDataTable<Row>, {
    props: { columns: columns as never, data: rows, totalCount: 1, pageCount: 1, ...props },
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

/** Layout v-models bound like a screen does. */
function mountLive(props: Record<string, unknown> = {}) {
  const wrapper = mountTable({
    ...props,
    'onUpdate:density': (value: unknown) => wrapper.setProps({ density: value } as never),
    'onUpdate:columnVisibility': (value: unknown) => wrapper.setProps({ columnVisibility: value } as never),
    'onUpdate:columnSizing': (value: unknown) => wrapper.setProps({ columnSizing: value } as never),
  })
  return wrapper
}

type Wrapper = ReturnType<typeof mountTable>
const group = (wrapper: Wrapper) => wrapper.find('[role="radiogroup"][aria-label="Densidad de filas"]')
const radio = (wrapper: Wrapper, label: string) =>
  wrapper.findAll('[role="radio"]').find(item => item.text() === label)!
const saved = (wrapper: Wrapper) => wrapper.find('[data-testid="table-saved"]')
const savedStatus = (wrapper: Wrapper) => wrapper.get('[data-testid="table-saved-status"]').text()
const announcement = (wrapper: Wrapper) => wrapper.get('[data-testid="table-announcer"]').text()

describe('density control', () => {
  it('lives at the top of the «Columnas» panel, not in the toolbar, on the default comfortable density', () => {
    const wrapper = mountTable()
    expect(group(wrapper).exists()).toBe(true)
    expect(radio(wrapper, 'Cómoda').attributes('aria-checked')).toBe('true')
    const panel = wrapper.get('[data-testid="columns-panel"]').element
    const control = group(wrapper).element
    expect(panel.contains(control)).toBe(true)
    // Above «Fijadas a la izquierda»: the density section comes before the first column section.
    const left = panel.querySelector('[data-panel-section="left"]')!
    expect(control.compareDocumentPosition(left) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(panel.querySelector('[data-panel-density] h3')?.textContent?.trim()).toBe('Densidad')
    // Outside the panel the toolbar is search · filters · Columnas · primary again.
    const actions = wrapper.get('.hf-toolbar-actions').element
    const outside = Array.from(actions.querySelectorAll('[role="radiogroup"]')).filter(el => !panel.contains(el))
    expect(outside).toHaveLength(0)
    expect(wrapper.get('[data-testid="table-view"]').attributes('data-density')).toBe('comfortable')
    wrapper.unmount()
  })

  it('sets the density v-model and the table data-density, and announces it', async () => {
    const wrapper = mountLive()
    await radio(wrapper, 'Compacta').trigger('click')
    expect(wrapper.emitted('update:density')).toEqual([['compact']])
    await nextTick()
    expect(wrapper.get('[data-testid="table-view"]').attributes('data-density')).toBe('compact')
    expect(radio(wrapper, 'Compacta').attributes('aria-checked')).toBe('true')
    expect(announcement(wrapper)).toBe('Densidad Compacta, filas de 40 px')
    wrapper.unmount()
  })

  it('changes the density with the arrow keys', async () => {
    const wrapper = mountLive({ density: 'normal' })
    await radio(wrapper, 'Normal').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:density')).toEqual([['comfortable']])
    wrapper.unmount()
  })

  it('hides with enableDensity=false', () => {
    const wrapper = mountTable({ enableDensity: false })
    expect(group(wrapper).exists()).toBe(false)
    wrapper.unmount()
  })

  it('is hidden in card mode and on mobile, where «Columnas» is the visibility sheet', () => {
    const cards = mountTable({ displayMode: 'cards' })
    expect(group(cards).exists()).toBe(false)
    cards.unmount()
    isMobile.value = true
    const mobile = mountTable()
    expect(group(mobile).exists()).toBe(false)
    mobile.unmount()
  })

  it('gives the loading skeleton the row height of the density', () => {
    const heights = { compact: 'h-10', normal: 'h-12', comfortable: 'h-16' } as const
    for (const [density, height] of Object.entries(heights)) {
      const wrapper = mountTable({ data: [], loading: true, density })
      const skeleton = wrapper.get('[data-testid="table-skeleton"]')
      expect(skeleton.attributes('data-density')).toBe(density)
      for (const row of wrapper.findAll('[data-testid="table-skeleton-row"]')) expect(row.classes()).toContain(height)
      wrapper.unmount()
    }
  })
})

describe('«Guardado en tu vista»', () => {
  it('confirms a user density change on a persisted table, then fades after about 2s', async () => {
    vi.useFakeTimers()
    const wrapper = mountLive({ persistLayout: true })
    expect(saved(wrapper).exists()).toBe(false)
    expect(savedStatus(wrapper)).toBe('')
    await radio(wrapper, 'Normal').trigger('click')
    await nextTick()
    expect(saved(wrapper).exists()).toBe(true)
    expect(saved(wrapper).text()).toBe('Guardado en tu vista')
    expect(savedStatus(wrapper)).toBe('Guardado en tu vista')
    vi.advanceTimersByTime(2100)
    await nextTick()
    expect(saved(wrapper).exists()).toBe(false)
    expect(savedStatus(wrapper)).toBe('')
    wrapper.unmount()
  })

  it('confirms visibility and width changes made by the user', async () => {
    const wrapper = mountLive({ persistLayout: true })
    await wrapper.get('[aria-label="Mostrar Estado"]').trigger('click')
    await nextTick()
    expect(saved(wrapper).exists()).toBe(true)
    wrapper.unmount()

    const sized = mountLive({ persistLayout: true })
    const header = sized.get('[data-hf-header][data-column-id="status"]')
    header.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }))
    await nextTick()
    expect(sized.emitted('update:columnSizing')).toBeTruthy()
    expect(saved(sized).exists()).toBe(true)
    sized.unmount()
  })

  it('never shows on load or when the screen sets the layout itself', async () => {
    const wrapper = mountLive({ persistLayout: true, density: 'compact', columnVisibility: { status: false } })
    await nextTick()
    expect(saved(wrapper).exists()).toBe(false)
    await wrapper.setProps({ density: 'normal', columnSizing: { status: 200 } } as never)
    await nextTick()
    expect(saved(wrapper).exists()).toBe(false)
    wrapper.unmount()
  })

  it('never shows on «Restablecer columnas», which says «Columnas restablecidas»', async () => {
    const onResetColumns = vi.fn()
    const wrapper = mountLive({ persistLayout: true, onResetColumns })
    const reset = wrapper
      .get('[data-testid="columns-panel"]')
      .findAll('button')
      .find(button => button.text() === 'Restablecer columnas')!
    await reset.trigger('click')
    await nextTick()
    expect(onResetColumns).toHaveBeenCalled()
    expect(announcement(wrapper)).toBe('Columnas restablecidas')
    expect(saved(wrapper).exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the same pill at the table surface when the table has no toolbar', async () => {
    vi.useFakeTimers()
    const wrapper = mountLive({ persistLayout: true, showToolbar: false })
    expect(wrapper.find('.hf-toolbar-actions').exists()).toBe(false)
    expect(saved(wrapper).exists()).toBe(false)
    const header = wrapper.get('[data-hf-header][data-column-id="status"]')
    header.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }))
    await nextTick()
    expect(saved(wrapper).exists()).toBe(true)
    expect(saved(wrapper).classes()).toEqual(expect.arrayContaining(['hf-table-saved', 'hf-table-saved--surface']))
    expect(saved(wrapper).attributes('aria-hidden')).toBe('true')
    expect(saved(wrapper).text()).toBe('Guardado en tu vista')
    // Anchored to the table's own box (the positioning root), outside the scrolling surface.
    expect(saved(wrapper).element.closest('[data-testid="table-view"]')).toBeNull()
    expect(wrapper.classes()).toContain('relative')
    expect(savedStatus(wrapper)).toBe('Guardado en tu vista')
    vi.advanceTimersByTime(2100)
    await nextTick()
    expect(saved(wrapper).exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows one pill only, in the toolbar, when the table has one', async () => {
    const wrapper = mountLive({ persistLayout: true })
    await radio(wrapper, 'Normal').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-testid="table-saved"]')).toHaveLength(1)
    expect(saved(wrapper).classes()).not.toContain('hf-table-saved--surface')
    wrapper.unmount()
  })

  it('stays quiet on a table that does not persist its layout', async () => {
    const wrapper = mountLive()
    await radio(wrapper, 'Normal').trigger('click')
    await nextTick()
    expect(saved(wrapper).exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('density section of the «Columnas» panel', () => {
  const groups = { left: [], center: [{ id: 'name', label: 'Nombre', visible: true, primary: true }], right: [] }
  const mountPanel = (props: Record<string, unknown> = {}) =>
    mount(DataTableColumnsPanel, { props: { groups, ...props }, attachTo: document.body })

  it('renders no density section without a density', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)
    expect(wrapper.find('[data-panel-density]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('reports the density picked in its radio group', async () => {
    const wrapper = mountPanel({ density: 'comfortable' })
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Densidad de filas')
    await wrapper.findAll('[role="radio"]').find(item => item.text() === 'Normal')!.trigger('click')
    expect(wrapper.emitted('density')).toEqual([['normal']])
    wrapper.unmount()
  })
})

describe('bulk bar anchor', () => {
  it('hands the bar the table surface box once rows are selected, and follows a resize', async () => {
    const wrapper = mountTable({ enableRowSelection: true, bulkActions: [{ id: 'x', label: 'X', onClick: vi.fn() }] })
    const box = (left: number, width: number) =>
      vi.spyOn(wrapper.element as HTMLElement, 'getBoundingClientRect').mockReturnValue({
        left, width, top: 0, right: left + width, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}),
      } as DOMRect)
    box(240, 1000)
    await wrapper.setProps({ rowSelection: { 0: true } } as never)
    await nextTick()
    await nextTick()
    const bar = wrapper.findComponent({ name: 'DataTableBulkActions' })
    expect(bar.props('anchor')).toEqual({ left: 240, width: 1000 })
    box(0, 390)
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(bar.props('anchor')).toEqual({ left: 0, width: 390 })
    wrapper.unmount()
  })
})
