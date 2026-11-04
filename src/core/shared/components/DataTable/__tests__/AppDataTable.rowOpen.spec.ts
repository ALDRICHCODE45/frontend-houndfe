import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import AppDataTable from '../AppDataTable.vue'

vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => ({ value: false }) }) }
})

type Row = { id: number; name: string }
const rows: Row[] = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }]
const columns = [
  { accessorKey: 'name', header: 'Name' },
  { id: 'actions', header: 'Actions' },
]

// The REAL UTable is rendered: the contract lives in how AppDataTable drives it.
function mountTable(props: Record<string, unknown> = {}) {
  return mount(AppDataTable<Row>, {
    attachTo: document.body,
    props: { columns, data: rows, showToolbar: false, ...props },
    slots: {
      'name-cell': ({ row }: { row: { original: Row } }) =>
        h('span', { 'data-testid': 'name' }, [
          h('button', { type: 'button', 'data-testid': 'primary' }, row.original.name),
        ]),
      'actions-cell': () => h('button', { type: 'button', 'data-testid': 'menu' }, '⋮'),
    },
  })
}

const bodyRows = (wrapper: ReturnType<typeof mountTable>) => wrapper.findAll('tbody tr')
const cellOf = (wrapper: ReturnType<typeof mountTable>, index: number) => bodyRows(wrapper)[index]!.findAll('td')[0]!

afterEach(() => {
  document.body.innerHTML = ''
  window.getSelection()?.removeAllRanges()
})

describe('AppDataTable rowOpen (default path)', () => {
  it('adds no clickable class, no tabindex and no role to rows when rowOpen is unset', async () => {
    const wrapper = mountTable()
    expect(bodyRows(wrapper)).toHaveLength(2)
    for (const tr of bodyRows(wrapper)) {
      expect(tr.classes()).not.toContain('hf-clickable-row')
      expect(tr.attributes('tabindex')).toBeUndefined()
      expect(tr.attributes('role')).toBeUndefined()
    }
    expect(wrapper.find('.hf-clickable-row').exists()).toBe(false)
  })

  it('a click on a row has no effect when rowOpen is unset', async () => {
    const wrapper = mountTable()
    // No listener is attached, so a click reaches nothing; `click` itself is VTU's DOM record.
    await cellOf(wrapper, 0).trigger('click')
    expect(Object.keys(wrapper.emitted()).filter(name => name !== 'click')).toEqual([])
  })

  it('renders identical row markup with and without an explicit undefined rowOpen', () => {
    const plain = mountTable().find('tbody').html()
    const explicit = mountTable({ rowOpen: undefined }).find('tbody').html()
    expect(explicit).toBe(plain)
  })
})

describe('AppDataTable rowOpen (clickable rows)', () => {
  it('marks every body row as hf-clickable-row and keeps rows out of the tab order', () => {
    const wrapper = mountTable({ rowOpen: vi.fn() })
    for (const tr of bodyRows(wrapper)) {
      expect(tr.classes()).toContain('hf-clickable-row')
      expect(tr.attributes('tabindex')).toBeUndefined()
      expect(tr.attributes('role')).toBeUndefined()
    }
    expect(wrapper.find('thead tr').classes()).not.toContain('hf-clickable-row')
  })

  it('opens the clicked row with its original data', async () => {
    const rowOpen = vi.fn()
    const wrapper = mountTable({ rowOpen })
    await cellOf(wrapper, 0).trigger('click')
    await cellOf(wrapper, 1).trigger('click')
    expect(rowOpen).toHaveBeenCalledTimes(2)
    expect(rowOpen.mock.calls[0]![0]).toEqual(rows[0])
    expect(rowOpen.mock.calls[1]![0]).toEqual(rows[1])
  })

  it('opens when a non-interactive node inside the cell is clicked', async () => {
    const rowOpen = vi.fn()
    const wrapper = mountTable({ rowOpen })
    await bodyRows(wrapper)[1]!.get('[data-testid="name"]').trigger('click')
    expect(rowOpen).toHaveBeenCalledWith(rows[1])
  })

  it('ignores clicks that come from interactive children', async () => {
    const rowOpen = vi.fn()
    const wrapper = mountTable({ rowOpen })
    await bodyRows(wrapper)[0]!.get('[data-testid="primary"]').trigger('click')
    await bodyRows(wrapper)[0]!.get('[data-testid="menu"]').trigger('click')
    expect(rowOpen).not.toHaveBeenCalled()
  })

  it('ignores modified clicks and secondary buttons', async () => {
    const rowOpen = vi.fn()
    const wrapper = mountTable({ rowOpen })
    const cell = cellOf(wrapper, 0)
    await cell.trigger('click', { ctrlKey: true })
    await cell.trigger('click', { metaKey: true })
    await cell.trigger('click', { shiftKey: true })
    await cell.trigger('click', { altKey: true })
    await cell.trigger('click', { button: 2 })
    expect(rowOpen).not.toHaveBeenCalled()
  })

  it('does not open while the user is selecting text', async () => {
    const rowOpen = vi.fn()
    const wrapper = mountTable({ rowOpen })
    const name = bodyRows(wrapper)[0]!.get('[data-testid="name"]').element
    const range = document.createRange()
    range.selectNodeContents(name)
    window.getSelection()?.addRange(range)
    await cellOf(wrapper, 0).trigger('click')
    expect(rowOpen).not.toHaveBeenCalled()
  })

  it('does not open from the header row', async () => {
    const rowOpen = vi.fn()
    const wrapper = mountTable({ rowOpen })
    await wrapper.get('thead th').trigger('click')
    expect(rowOpen).not.toHaveBeenCalled()
  })
})
