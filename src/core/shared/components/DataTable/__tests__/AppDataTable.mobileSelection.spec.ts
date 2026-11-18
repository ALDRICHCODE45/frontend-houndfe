import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import AppDataTable from '../AppDataTable.vue'
import type { RowSelectionState } from '../../../types/table.types'

// Cards mode is forced with `displayMode: 'cards'`; the phone breakpoint is not needed.
type Row = { id: number; fullName: string }
const rows: Row[] = [
  { id: 1, fullName: 'Laura Méndez' },
  { id: 2, fullName: 'Pedro Ruiz' },
  { id: 3, fullName: 'Ana Gil' },
]
const columns = [{ accessorKey: 'fullName', header: 'Nombre' }]

function mountCards(props: Record<string, unknown> = {}) {
  const open = vi.fn()
  const wrapper = mount(AppDataTable<Row>, {
    attachTo: document.body,
    props: {
      columns,
      data: rows,
      showToolbar: false,
      displayMode: 'cards' as const,
      enableRowSelection: true,
      rowMarkLabel: (row: Row) => `Seleccionar a ${row.fullName}`,
      'onUpdate:rowSelection': (value: RowSelectionState) => wrapper.setProps({ rowSelection: value }),
      ...props,
    },
    slots: {
      'mobile-card': ({ row }: { row: Row }) =>
        h('article', { 'data-testid': 'card', onClick: () => open(row) }, row.fullName),
    },
  })
  return { wrapper, open }
}

const marks = (wrapper: ReturnType<typeof mountCards>['wrapper']) =>
  wrapper.findAll('[data-testid="mobile-card-selectable"] > .hf-row-mark')
const selectAll = (wrapper: ReturnType<typeof mountCards>['wrapper']) =>
  wrapper.find('[data-testid="mobile-select-all"] .hf-row-mark')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AppDataTable cards mode with row selection', () => {
  it('renders a named row mark on every card', () => {
    const { wrapper } = mountCards()
    expect(marks(wrapper)).toHaveLength(3)
    expect(marks(wrapper).map(mark => mark.attributes('aria-label'))).toEqual([
      'Seleccionar a Laura Méndez',
      'Seleccionar a Pedro Ruiz',
      'Seleccionar a Ana Gil',
    ])
    expect(marks(wrapper)[0]!.attributes('aria-pressed')).toBe('false')
  })

  it('renders no marks and no select-all when selection is off', () => {
    const { wrapper } = mountCards({ enableRowSelection: false })
    expect(marks(wrapper)).toHaveLength(0)
    expect(wrapper.find('[data-testid="mobile-select-all"]').exists()).toBe(false)
  })

  it('falls back to a numbered name without rowMarkLabel', () => {
    const { wrapper } = mountCards({ rowMarkLabel: undefined })
    expect(marks(wrapper)[1]!.attributes('aria-label')).toBe('Seleccionar fila 2')
  })

  it('toggles a row on and off from its mark', async () => {
    const { wrapper } = mountCards()
    await marks(wrapper)[1]!.trigger('click')
    expect(wrapper.props('rowSelection')).toEqual({ 1: true })
    expect(marks(wrapper)[1]!.attributes('aria-pressed')).toBe('true')
    await marks(wrapper)[1]!.trigger('click')
    expect(wrapper.props('rowSelection')).toEqual({})
  })

  it('never opens the card when the mark is clicked', async () => {
    const { wrapper, open } = mountCards()
    await marks(wrapper)[0]!.trigger('click')
    expect(open).not.toHaveBeenCalled()
    await wrapper.findAll('[data-testid="card"]')[0]!.trigger('click')
    expect(open).toHaveBeenCalledWith(rows[0])
  })

  it('shows «Seleccionar todos» above the cards: empty → all, some → mixed, all → none', async () => {
    const { wrapper } = mountCards()
    expect(selectAll(wrapper).attributes('aria-label')).toBe('Seleccionar todos')
    expect(selectAll(wrapper).attributes('aria-pressed')).toBe('false')

    await marks(wrapper)[0]!.trigger('click')
    expect(selectAll(wrapper).attributes('aria-pressed')).toBe('mixed')

    await selectAll(wrapper).trigger('click')
    expect(wrapper.props('rowSelection')).toEqual({ 0: true, 1: true, 2: true })
    expect(selectAll(wrapper).attributes('aria-pressed')).toBe('true')

    await selectAll(wrapper).trigger('click')
    expect(wrapper.props('rowSelection')).toEqual({})
  })

  it('names the select-all from selectAllLabel', () => {
    const { wrapper } = mountCards({ selectAllLabel: 'Seleccionar todos los empleados' })
    expect(selectAll(wrapper).attributes('aria-label')).toBe('Seleccionar todos los empleados')
  })

  it('shows selectAllLabel as the visible caption, inside the accessible name', () => {
    const { wrapper } = mountCards({ selectAllLabel: 'Seleccionar todas las promociones' })
    const caption = wrapper.get('[data-testid="mobile-select-all-caption"]')
    expect(caption.text()).toBe('Seleccionar todas las promociones')
    expect(selectAll(wrapper).attributes('aria-label')).toContain(caption.text())
  })

  it('toggles all cards from the caption too', async () => {
    const { wrapper } = mountCards()
    await wrapper.get('[data-testid="mobile-select-all-caption"]').trigger('click')
    expect(wrapper.props('rowSelection')).toEqual({ 0: true, 1: true, 2: true })
    await wrapper.get('[data-testid="mobile-select-all-caption"]').trigger('click')
    expect(wrapper.props('rowSelection')).toEqual({})
  })

  it('shows the bulk bar and hands the selected cards to the action', async () => {
    const onClick = vi.fn()
    const { wrapper } = mountCards({
      bulkActions: [{ id: 'del', label: 'Eliminar', onClick }],
    })
    await marks(wrapper)[0]!.trigger('click')
    await marks(wrapper)[2]!.trigger('click')
    expect(document.body.querySelector('[data-testid="bulk-selected-count"]')?.textContent).toBe('2')
    const button = Array.from(document.body.querySelectorAll('button')).find(
      element => element.textContent?.trim() === 'Eliminar',
    )
    button!.click()
    expect(onClick).toHaveBeenCalledWith([rows[0], rows[2]])
  })
})
