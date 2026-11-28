import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, ref } from 'vue'
import AppDataTable from '../AppDataTable.vue'
import type { RowSelectionState, SortingState, TableColumn } from '../../../types/table.types'

// mobile-tables T3 (S4): the shared mobile renderers — «rows» (A · Lista densa) and the meta-driven
// «cards» (B · Tarjetas ricas) — the result line with the short sort menu and «Seleccionar», the
// selection mark inside the row / card, and the docked bulk bar. Desktop stays the table.

const isPhone = ref(true)
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isPhone, greaterOrEqual: () => ref(!isPhone.value) }) }
})

type Row = { id: string; fullName: string; phone: string; debt: number }
const rows: Row[] = [
  { id: 'c1', fullName: 'Clínica Veterinaria Huellitas del Valle S.A. de C.V.', phone: '81 1987 2210', debt: 348000 },
  { id: 'c2', fullName: 'María Fernanda Garza Lozano', phone: '81 2290 4417', debt: 0 },
]
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
const columns: TableColumn<Row>[] = [
  {
    accessorKey: 'fullName',
    header: 'Cliente',
    meta: { mobile: [{ role: 'lead' }, { role: 'primary' }] },
  },
  { accessorKey: 'phone', header: 'Teléfono', meta: { mobile: { role: 'secondary' } } },
  {
    accessorKey: 'debt',
    header: 'Deuda',
    meta: {
      mobile: [
        { role: 'figure', value: row => money(row.debt), tone: row => (row.debt > 0 ? 'warning' : 'muted') },
        { role: 'stat', value: row => money(row.debt) },
      ],
    },
  },
  { id: 'actions', header: 'Acciones' },
]
const SORT_OPTIONS = [
  { label: 'Nombre · A–Z', value: 'fullName:asc' },
  { label: 'Deuda · mayor a menor', value: 'debt:desc' },
]

const menuStub = {
  props: ['items'],
  template:
    '<div data-testid="menu-stub"><slot /><button v-for="item in (items ?? []).flat()" :key="item.label" type="button" data-testid="menu-item" :data-checked="String(!!item.checked)" @click="item.onSelect?.()">{{ item.label }}</button></div>',
}
const slideoverStub = { props: ['open'], template: '<div data-testid="slideover"><slot name="content" /></div>' }
const stubs = {
  UDropdownMenu: menuStub,
  DropdownMenu: menuStub,
  USlideover: slideoverStub,
  Slideover: slideoverStub,
  UTooltip: { template: '<div><slot /></div>' },
  Tooltip: { template: '<div><slot /></div>' },
}

const mounted: { unmount: () => void }[] = []

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mountList(props: Record<string, unknown> = {}, slots: Record<string, any> = {}) {
  const open = vi.fn()
  const wrapper = mount(AppDataTable<Row>, {
    attachTo: document.body,
    props: {
      columns,
      data: rows,
      totalCount: 86,
      pageCount: 9,
      showingFrom: 1,
      showingTo: 10,
      mobileRender: 'rows' as const,
      rowOpen: open,
      itemLabel: { one: 'cliente', other: 'clientes' },
      rowMarkLabel: (row: Row) => `Seleccionar a ${row.fullName}`,
      'onUpdate:rowSelection': (value: RowSelectionState) => wrapper.setProps({ rowSelection: value }),
      'onUpdate:sorting': (value: SortingState) => wrapper.setProps({ sorting: value }),
      ...props,
    },
    slots,
    global: { stubs },
  })
  mounted.push(wrapper)
  return { wrapper, open }
}

beforeEach(() => {
  isPhone.value = true
})
afterEach(() => {
  // Unmount before the shared breakpoint ref flips, so no stale table re-renders into a cleared body.
  while (mounted.length) mounted.pop()!.unmount()
  document.body.innerHTML = ''
})

describe('renderer selection by `mobile-render`', () => {
  it('«rows» renders the dense list (one row per record, no table)', () => {
    const { wrapper } = mountList()
    expect(wrapper.find('[data-testid="mobile-list-rows"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="mobile-list-row"]')).toHaveLength(2)
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-list-cards"]').exists()).toBe(false)
  })

  it('«cards» without a #mobile-card slot renders the meta-driven rich cards', () => {
    const { wrapper } = mountList({ mobileRender: 'cards' })
    expect(wrapper.find('[data-testid="mobile-list-cards"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="mobile-list-card"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="mobile-list-rows"]').exists()).toBe(false)
  })

  it('«cards» with a #mobile-card slot keeps the screen\'s own card (legacy path)', () => {
    const { wrapper } = mountList(
      { mobileRender: 'cards' },
      { 'mobile-card': ({ row }: { row: Row }) => h('article', { 'data-testid': 'own-card' }, row.fullName) },
    )
    expect(wrapper.findAll('[data-testid="own-card"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="mobile-list-cards"]').exists()).toBe(false)
  })

  it('desktop is the table: no mobile list, no result line, whatever `mobile-render` says', () => {
    isPhone.value = false
    const { wrapper } = mountList({ sortOptions: SORT_OPTIONS })
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-list-rows"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-result-line"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-sort-button"]').exists()).toBe(false)
  })
})

describe('A · dense rows', () => {
  it('shows the full name (no truncation class), the secondary line and the key figure with its tone', () => {
    const { wrapper } = mountList()
    const first = wrapper.findAll('[data-testid="mobile-list-row"]')[0]!
    const name = first.get('[data-testid="mobile-row-primary"]')
    expect(name.text()).toBe('Clínica Veterinaria Huellitas del Valle S.A. de C.V.')
    expect(name.classes().join(' ')).not.toMatch(/truncate|line-clamp/)
    expect(first.get('[data-testid="mobile-row-secondary"]').text()).toContain('81 1987 2210')
    const figure = first.get('[data-testid="mobile-row-figure"]')
    expect(figure.text()).toBe('$3480.00')
    expect(figure.attributes('data-tone')).toBe('warning')
    // The lead is the avatar (initials) in its 44px slot.
    expect(first.find('[data-testid="mobile-row-lead"]').text()).toBe('CV')
  })

  it('has no ⋮ row menu (actions live in the detail page and the selection bar)', () => {
    const { wrapper } = mountList()
    const row = wrapper.findAll('[data-testid="mobile-list-row"]')[0]!
    expect(row.findAll('button').map(button => button.attributes('aria-label') ?? '')).not.toContainEqual(
      expect.stringMatching(/acciones/i),
    )
    expect(row.find('.hf-row-actions-trigger').exists()).toBe(false)
    expect(row.findAll('button')).toHaveLength(1)
  })

  it('opens the record from the name (the row is one target)', async () => {
    const { wrapper, open } = mountList()
    await wrapper.findAll('[data-testid="mobile-row-primary"]')[1]!.trigger('click')
    expect(open).toHaveBeenCalledWith(rows[1])
  })
})

describe('selection mode', () => {
  it('«Seleccionar» in the result line turns the lead into the mark inside the row', async () => {
    const { wrapper, open } = mountList({ enableRowSelection: true })
    expect(wrapper.findAll('[data-testid="mobile-list-row"] .hf-row-mark')).toHaveLength(0)
    await wrapper.get('[data-testid="mobile-select-toggle"]').trigger('click')
    const marks = wrapper.findAll('[data-testid="mobile-list-row"] [data-testid="mobile-row-lead"] .hf-row-mark')
    expect(marks).toHaveLength(2)
    expect(marks[0]!.attributes('aria-label')).toBe('Seleccionar a Clínica Veterinaria Huellitas del Valle S.A. de C.V.')
    // Tapping the row marks it instead of opening it.
    await wrapper.findAll('[data-testid="mobile-list-row"]')[1]!.trigger('click')
    expect(wrapper.props('rowSelection')).toEqual({ 1: true })
    expect(open).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="mobile-list-row"]')[1]!.classes()).toContain('is-selected')
    // The select header replaces the result line: page mark, count, «Listo».
    expect(wrapper.get('[data-testid="mobile-select-head"]').text()).toContain('1 seleccionado')
    await wrapper.get('[data-testid="mobile-select-done"]').trigger('click')
    expect(wrapper.find('[data-testid="mobile-select-head"]').exists()).toBe(false)
    expect(wrapper.props('rowSelection')).toEqual({})
  })

  it('a long press on a row enters selection mode with that row marked', async () => {
    vi.useFakeTimers()
    try {
      const { wrapper, open } = mountList({ enableRowSelection: true })
      const row = wrapper.findAll('[data-testid="mobile-list-row"]')[0]!
      await row.trigger('pointerdown')
      vi.advanceTimersByTime(600)
      await row.trigger('pointerup')
      await row.trigger('click')
      expect(wrapper.props('rowSelection')).toEqual({ 0: true })
      expect(open).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="mobile-select-head"]').exists()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('in the cards the mark sits in the card\'s corner, inside the card', async () => {
    const { wrapper } = mountList({ mobileRender: 'cards', enableRowSelection: true })
    await wrapper.get('[data-testid="mobile-select-toggle"]').trigger('click')
    const cards = wrapper.findAll('[data-testid="mobile-list-card"]')
    expect(cards[0]!.find('[data-testid="mobile-card-corner"] .hf-row-mark').exists()).toBe(true)
    await cards[0]!.get('.hf-row-mark').trigger('click')
    expect(wrapper.props('rowSelection')).toEqual({ 0: true })
    expect(wrapper.findAll('[data-testid="mobile-list-card"]')[0]!.classes()).toContain('is-selected')
  })

  it('offers no «Seleccionar» when the table has no row selection', () => {
    const { wrapper } = mountList()
    expect(wrapper.find('[data-testid="mobile-select-toggle"]').exists()).toBe(false)
  })
})

describe('result line and short sort menu', () => {
  it('says how many there are with the list\'s noun', () => {
    const { wrapper } = mountList()
    expect(wrapper.get('[data-testid="mobile-result-line"]').text()).toContain('86 clientes')
  })

  it('«Ordenar» lists only the sort options and writes the chosen one into `sorting`', async () => {
    const { wrapper } = mountList({ sortOptions: SORT_OPTIONS, sorting: [{ id: 'fullName', desc: false }] })
    const button = wrapper.get('[data-testid="mobile-sort-button"]')
    expect(button.text()).toContain('Nombre · A–Z')
    const items = wrapper.get('[data-testid="mobile-result-line"]').findAll('[data-testid="menu-item"]')
    expect(items.map(item => item.text())).toEqual(['Nombre · A–Z', 'Deuda · mayor a menor'])
    expect(items[0]!.attributes('data-checked')).toBe('true')
    await items[1]!.trigger('click')
    expect(wrapper.props('sorting')).toEqual([{ id: 'debt', desc: true }])
  })
})

describe('states match the final shape', () => {
  it('loading draws row skeletons for «rows» and card skeletons for «cards»', () => {
    const { wrapper } = mountList({ data: [], loading: true })
    expect(wrapper.findAll('[data-testid="mobile-row-skeleton"]').length).toBeGreaterThan(0)
    const cards = mountList({ data: [], loading: true, mobileRender: 'cards' }).wrapper
    expect(cards.findAll('[data-testid="mobile-card-skeleton"]').length).toBeGreaterThan(0)
  })

  it('no results keeps the toolbar (search) and offers «Limpiar filtros»', () => {
    const { wrapper } = mountList({ data: [], totalCount: 0, filtered: true, globalFilter: 'zz' })
    expect(wrapper.find('.hf-toolbar-search').exists()).toBe(true)
    expect(wrapper.get('[data-testid="mobile-empty-state"]').text()).toContain('Ningún resultado para «zz»')
  })

  it('error wins over the list', () => {
    const { wrapper } = mountList({ error: true })
    expect(wrapper.find('[data-testid="cards-error-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mobile-list-rows"]').exists()).toBe(false)
  })
})

describe('bulk bar', () => {
  const bulkActions = [{ id: 'csv', label: 'Exportar CSV', onClick: () => {} }]
  it('is docked at the bottom on phones', async () => {
    const { wrapper } = mountList({ enableRowSelection: true, bulkActions, rowSelection: { 0: true } })
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.hf-bulk-bar')?.classList.contains('hf-bulk-bar--docked')).toBe(true)
  })

  it('stays the floating bar on desktop', async () => {
    isPhone.value = false
    const { wrapper } = mountList({ enableRowSelection: true, bulkActions, rowSelection: { 0: true } })
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.hf-bulk-bar')).not.toBeNull()
    expect(document.querySelector('.hf-bulk-bar')?.classList.contains('hf-bulk-bar--docked')).toBe(false)
  })
})
