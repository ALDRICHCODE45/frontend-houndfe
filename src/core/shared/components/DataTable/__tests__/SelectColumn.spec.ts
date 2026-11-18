import { mount } from '@vue/test-utils'
import { getCoreRowModel, useVueTable, type RowSelectionState } from '@tanstack/vue-table'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import SelectColumn from '../SelectColumn.vue'

// Selección sin checkboxes: the table selection column is a row mark (a round
// mark in a 44px native button with aria-pressed), header included.
interface Person {
  id: string
  name: string
}
const people: Person[] = ['Laura Méndez', 'Ana Ruiz', 'Beto Gil', 'Carla Paz', 'Dani Sol'].map(
  (name, index) => ({ id: `p${index}`, name }),
)

function mountTable(props: Record<string, unknown> = {}) {
  const selection = ref<RowSelectionState>({})
  const rowClick = vi.fn()
  const Harness = defineComponent({
    setup() {
      const table = useVueTable({
        data: people,
        columns: [{ id: 'select' }, { accessorKey: 'name' }],
        getRowId: (row) => row.id,
        getCoreRowModel: getCoreRowModel(),
        enableRowSelection: true,
        state: {
          get rowSelection() {
            return selection.value
          },
        },
        onRowSelectionChange: (updater) => {
          selection.value = typeof updater === 'function' ? updater(selection.value) : updater
        },
      })
      return () =>
        h('table', [
          h('thead', [h('tr', [h('th', [h(SelectColumn, { table, mode: 'header', ...props })])])]),
          h(
            'tbody',
            table.getRowModel().rows.map((row) =>
              h('tr', { key: row.id, onClick: rowClick }, [
                h('td', [h(SelectColumn, { row, table, mode: 'cell', ...props })]),
                h('td', row.original.name),
              ]),
            ),
          ),
        ])
    },
  })
  const wrapper = mount(Harness, { attachTo: document.body })
  const header = () => wrapper.get('thead button')
  const marks = () => wrapper.findAll('tbody button')
  return { wrapper, selection, rowClick, header, marks }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SelectColumn — row mark instead of a checkbox', () => {
  it('renders no checkbox: only labelled row-mark buttons with aria-pressed', () => {
    const { wrapper, header, marks } = mountTable()
    expect(wrapper.find('[role="checkbox"], input[type="checkbox"]').exists()).toBe(false)
    expect(header().classes()).toContain('hf-row-mark')
    expect(header().attributes('aria-label')).toBe('Seleccionar todos')
    expect(header().attributes('aria-pressed')).toBe('false')
    expect(marks()).toHaveLength(5)
    expect(marks().every((mark) => mark.classes().includes('hf-row-mark'))).toBe(true)
    expect(marks()[0]!.attributes('aria-label')).toBe('Seleccionar fila')
    expect(marks()[0]!.attributes('aria-pressed')).toBe('false')
  })

  it('names each row from the label function', () => {
    const { marks } = mountTable({ label: (person: Person) => `Seleccionar a ${person.name}` })
    expect(marks()[0]!.attributes('aria-label')).toBe('Seleccionar a Laura Méndez')
  })

  it('toggles one row without opening it (the click does not reach the row)', async () => {
    const { selection, rowClick, marks } = mountTable()
    await marks()[1]!.trigger('click')
    expect(selection.value).toEqual({ p1: true })
    expect(marks()[1]!.attributes('aria-pressed')).toBe('true')
    expect(rowClick).not.toHaveBeenCalled()
    await marks()[1]!.trigger('click')
    expect(selection.value.p1).toBeFalsy()
  })

  it('cycles the header empty → all, and shows mixed when only some are selected', async () => {
    const { selection, header, marks } = mountTable()
    await header().trigger('click')
    expect(Object.keys(selection.value).sort()).toEqual(['p0', 'p1', 'p2', 'p3', 'p4'])
    expect(header().attributes('aria-pressed')).toBe('true')
    await marks()[0]!.trigger('click')
    expect(header().attributes('aria-pressed')).toBe('mixed')
    // Mixed → all, then all → none.
    await header().trigger('click')
    expect(header().attributes('aria-pressed')).toBe('true')
    await header().trigger('click')
    expect(header().attributes('aria-pressed')).toBe('false')
    expect(Object.values(selection.value).some(Boolean)).toBe(false)
  })

  it('Shift+click selects the range from the last toggled row', async () => {
    const { selection, rowClick, marks } = mountTable()
    await marks()[1]!.trigger('click')
    await marks()[3]!.trigger('click', { shiftKey: true })
    expect(Object.keys(selection.value).filter((id) => selection.value[id]).sort()).toEqual([
      'p1',
      'p2',
      'p3',
    ])
    // Shift+click on a selected anchor range clears it the same way.
    await marks()[2]!.trigger('click')
    await marks()[1]!.trigger('click', { shiftKey: true })
    expect(Object.keys(selection.value).filter((id) => selection.value[id])).toEqual(['p3'])
    expect(rowClick).not.toHaveBeenCalled()
  })

  it('Shift+click without an anchor toggles only that row', async () => {
    const { selection, marks } = mountTable()
    await marks()[2]!.trigger('click', { shiftKey: true })
    expect(selection.value).toEqual({ p2: true })
  })
})
