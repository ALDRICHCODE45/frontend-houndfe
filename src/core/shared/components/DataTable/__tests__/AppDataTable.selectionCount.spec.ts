/**
 * customers-bulk-actions T1: a server-side selection (ids across pages, or «todos los del filtro»)
 * is larger than the marks of the current page. `selectionCount` lets the screen tell the bulk bar
 * the real count; without it the bar keeps counting the page marks.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import AppDataTable from '../AppDataTable.vue'

type Row = { id: number; fullName: string }
const rows: Row[] = [
  { id: 1, fullName: 'Laura Méndez' },
  { id: 2, fullName: 'Pedro Ruiz' },
]
const columns = [{ accessorKey: 'fullName', header: 'Nombre' }]
const bulkActions = [{ id: 'csv', label: 'Exportar CSV', onClick: () => {} }]

function mountCards(props: Record<string, unknown> = {}) {
  return mount(AppDataTable<Row>, {
    attachTo: document.body,
    props: {
      columns,
      data: rows,
      showToolbar: false,
      displayMode: 'cards' as const,
      enableRowSelection: true,
      bulkActions,
      ...props,
    },
    slots: {
      'mobile-card': ({ row }: { row: Row }) => h('article', row.fullName),
      'bulk-summary': ({ count }: { count: number }) => h('span', { 'data-testid': 'summary-count' }, String(count)),
    },
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AppDataTable selectionCount', () => {
  it('shows the bar with the given count even with no mark on this page', () => {
    const wrapper = mountCards({ rowSelection: {}, selectionCount: 40 })
    expect(wrapper.find('[data-testid="bulk-selected-count"]').text()).toBe('40')
    expect(wrapper.find('[data-testid="summary-count"]').text()).toBe('40')
  })

  it('hides the bar when the given count is 0, even with marks', () => {
    const wrapper = mountCards({ rowSelection: { 0: true }, selectionCount: 0 })
    expect(wrapper.find('[data-testid="bulk-selected-count"]').exists()).toBe(false)
  })

  it('«Quitar selección» clears the page marks and tells the screen', async () => {
    const wrapper = mountCards({ rowSelection: { 0: true }, selectionCount: 40 })
    await wrapper.find('button[aria-label="Quitar selección"]').trigger('click')
    expect(wrapper.emitted('update:rowSelection')?.slice(-1)[0]).toEqual([{}])
    expect(wrapper.emitted('clear-selection')).toHaveLength(1)
  })

  it('counts the page marks without it', () => {
    const wrapper = mountCards({ rowSelection: { 0: true, 1: true } })
    expect(wrapper.find('[data-testid="bulk-selected-count"]').text()).toBe('2')
  })
})
