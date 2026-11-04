/**
 * C1: the name column has priority. The default is the first data column after the selection
 * column, `meta: { primary: true }` overrides it, and the core CSS gives that column its floor
 * (`hf-col-primary`) so the other columns shrink first.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppDataTable from '../AppDataTable.vue'

type Row = { id: number; name: string; status: string }

const rows: Row[] = [{ id: 1, name: 'Alpha', status: 'a' }]
const actionsColumn = {
  id: 'actions',
  header: 'Acciones',
  meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
}

function mountTable(columns: unknown[], props: Record<string, unknown> = {}) {
  return mount(AppDataTable<Row>, {
    props: { columns: columns as never, data: rows, totalCount: 1, pageCount: 1, ...props },
    global: {
      stubs: {
        DataTableToolbar: true,
        DataTablePagination: true,
        DataTableBulkActions: true,
      },
    },
  })
}

const headerNames = (wrapper: ReturnType<typeof mountTable>, withClass: string) =>
  wrapper.findAll('thead th').filter(th => th.classes().includes(withClass)).map(th => th.text())
const cellTexts = (wrapper: ReturnType<typeof mountTable>, withClass: string) =>
  wrapper.findAll('tbody td').filter(td => td.classes().includes(withClass)).map(td => td.text())

describe('AppDataTable primary column', () => {
  it('defaults to the first data column after the selection column', () => {
    const wrapper = mountTable([
      { id: 'select', header: '' },
      { accessorKey: 'name', header: 'Nombre' },
      { accessorKey: 'status', header: 'Estado' },
      actionsColumn,
    ])
    expect(headerNames(wrapper, 'hf-col-primary')).toEqual(['Nombre'])
    expect(cellTexts(wrapper, 'hf-col-primary')).toEqual(['Alpha'])
  })

  it('takes the first column when there is no selection column', () => {
    const wrapper = mountTable([
      { accessorKey: 'name', header: 'Nombre' },
      { accessorKey: 'status', header: 'Estado' },
    ])
    expect(headerNames(wrapper, 'hf-col-primary')).toEqual(['Nombre'])
  })

  it('lets meta.primary pick another column', () => {
    const wrapper = mountTable([
      { accessorKey: 'status', header: 'Estado' },
      { accessorKey: 'name', header: 'Nombre', meta: { primary: true } },
    ])
    expect(headerNames(wrapper, 'hf-col-primary')).toEqual(['Nombre'])
    expect(cellTexts(wrapper, 'hf-col-primary')).toEqual(['Alpha'])
  })

  it('skips a hidden first column', () => {
    const wrapper = mountTable(
      [
        { accessorKey: 'status', header: 'Estado' },
        { accessorKey: 'name', header: 'Nombre' },
      ],
      { columnVisibility: { status: false } },
    )
    expect(headerNames(wrapper, 'hf-col-primary')).toEqual(['Nombre'])
  })

  it('keeps the classes the column already declares', () => {
    const wrapper = mountTable([
      { accessorKey: 'name', header: 'Nombre', meta: { class: { th: 'text-right', td: 'text-right' } } },
      actionsColumn,
    ])
    const th = wrapper.get('thead th')
    expect(th.classes()).toEqual(expect.arrayContaining(['hf-col-primary', 'text-right']))
    expect(wrapper.get('tbody td').classes()).toEqual(expect.arrayContaining(['hf-col-primary', 'text-right']))
    expect(headerNames(wrapper, 'w-16')).toEqual(['Acciones'])
  })

  it('never marks the Acciones column as primary', () => {
    const wrapper = mountTable([actionsColumn])
    expect(headerNames(wrapper, 'hf-col-primary')).toEqual([])
  })
})
